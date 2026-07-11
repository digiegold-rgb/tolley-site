/**
 * lib/rate-limit.ts — DB-backed fixed-window rate limiting + lightweight
 * locks. No Redis in this stack; one atomic Neon round trip per check via
 * INSERT … ON CONFLICT. Window resets lazily when a consume() arrives after
 * windowStart + windowSeconds.
 *
 * Usage (rate limit):
 *   const rl = await consumeRateLimit(`anim:${userId}`, 6, 60);
 *   if (!rl.allowed) return tooManyRequests(rl);
 *
 * Usage (mutex-style lock — limit 1, window = max hold time):
 *   const lock = await consumeRateLimit(`lock:anim:${id}:${idx}`, 1, 900);
 *   if (!lock.allowed) return conflict();
 *   try { … } finally { await releaseLock(`lock:anim:${id}:${idx}`); }
 */

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export interface RateLimitResult {
  allowed: boolean;
  /** Requests used inside the current window (including this one). */
  count: number;
  limit: number;
  /** Seconds until the window resets (only meaningful when blocked). */
  retryAfterSeconds: number;
}

export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const rows = await prisma.$queryRaw<
    Array<{ count: number; windowStart: Date }>
  >`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${key}, NOW(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowStart" < NOW() - make_interval(secs => ${windowSeconds})
          THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimitBucket"."windowStart" < NOW() - make_interval(secs => ${windowSeconds})
          THEN NOW()
        ELSE "RateLimitBucket"."windowStart"
      END
    RETURNING "count", "windowStart"
  `;

  const row = rows[0];
  const count = row?.count ?? 1;
  const windowStart = row?.windowStart ?? new Date();
  const elapsed = (Date.now() - windowStart.getTime()) / 1000;
  return {
    allowed: count <= limit,
    count,
    limit,
    retryAfterSeconds: Math.max(1, Math.ceil(windowSeconds - elapsed)),
  };
}

/**
 * One-liner guard for public routes. Keys on the caller IP (x-forwarded-for /
 * x-real-ip on Vercel). Returns a 429 NextResponse when over budget, else null.
 *
 *   const limited = await rateLimitByIp(req, "lead:action", 5, 600);
 *   if (limited) return limited;
 */
export async function rateLimitByIp(
  req: Request,
  name: string,
  limit: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  const xff = req.headers.get("x-forwarded-for");
  const ip =
    (xff ? xff.split(",")[0].trim() : null) ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rl = await consumeRateLimit(`${name}:${ip}`, limit, windowSeconds);
  return rl.allowed ? null : rateLimited(rl);
}

/** Release a mutex-style bucket immediately (use in finally blocks). */
export async function releaseLock(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}

/** Standard 429 response with Retry-After. */
export function rateLimited(rl: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: `Rate limit exceeded (${rl.limit} per window). Try again shortly.`,
      retryAfterSeconds: rl.retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSeconds) },
    },
  );
}
