/**
 * POST /api/v1/videos — public API: turn a script into a finished video.
 *
 * Auth: `Authorization: Bearer jly_live_…` (Jelly Studio → API Keys).
 * Body: { script, title?, styleId?, features? }
 * 201:  { id, status, pollUrl }
 *
 * This is the one write endpoint of the public API, so it carries every gate
 * the browser lane carries — see lib/vater/public-api.ts, which holds the
 * shared logic precisely so the two cannot drift.
 *
 * ── RATE LIMIT ───────────────────────────────────────────────────────────
 * Per KEY, not per IP: an agent framework behind one NAT is one customer, and
 * a customer running from ten Lambdas is still one customer. 10 creations per
 * hour is roughly ten times a heavy human day and still bounded — the real
 * spending limit is the prepaid balance, which the credit gate enforces one
 * layer down. The limit exists so a runaway loop burns a 429 instead of a
 * wallet.
 *
 * ── HTTP SHAPE ───────────────────────────────────────────────────────────
 * Errors are always { error: "<machine_code>", message: "<human sentence>" }.
 * Integrators branch on `error`; `message` is for their logs. Notable codes:
 *   401 unauthorized · 402 insufficient_credits · 404 style_not_found
 *   409 no_style · 429 rate_limited · 502 render_kickoff_failed
 *   503 not_ready (deployed ahead of its migration)
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/vater/direct-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createVideoFromScript } from "@/lib/vater/public-api";
import { publicSiteUrl } from "@/lib/vater/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Creations per key per hour. */
const CREATE_LIMIT = 10;
const CREATE_WINDOW_SEC = 3600;

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return auth.response;

  const rl = await consumeRateLimit(
    `v1:videos:${auth.keyId}`,
    CREATE_LIMIT,
    CREATE_WINDOW_SEC,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `This key may create ${CREATE_LIMIT} videos per hour. Try again in ${rl.retryAfterSeconds}s.`,
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Body must be valid JSON." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "invalid_request", message: "Body must be a JSON object." },
      { status: 400, headers: NO_STORE },
    );
  }

  // The owner tier is exempt from the beta length cap, so the shared logic
  // needs the caller's address, not just their id.
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  });

  const result = await createVideoFromScript(auth.userId, user?.email ?? null, body);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message, ...(result.detail ? { detail: result.detail } : {}) },
      { status: result.status, headers: NO_STORE },
    );
  }

  const base = publicSiteUrl();
  return NextResponse.json(
    {
      id: result.projectId,
      status: result.status,
      pollUrl: `${base}/api/v1/videos/${result.projectId}`,
    },
    { status: 201, headers: NO_STORE },
  );
}

/** Anything but POST here is a mistake worth naming rather than a bare 405. */
export async function GET() {
  return NextResponse.json(
    {
      error: "method_not_allowed",
      message:
        "POST a script to this endpoint to create a video. To read one, GET /api/v1/videos/{id}.",
    },
    { status: 405, headers: { ...NO_STORE, Allow: "POST" } },
  );
}
