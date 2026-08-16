import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import {
  hasApiKeyTable,
  resolveApiKey,
  touchApiKey,
  type ResolvedKey,
} from "@/lib/vater/api-keys";

/**
 * Shared-secret bearer auth for the DGX-side vater-direct-runner (Trey's
 * dictation lane). Bearer-ONLY on purpose — no session fallback — so a
 * studio-only browser session can never reach the runner routes even though
 * proxy.ts allows the /api/vater prefix. Token lives in the runner's env
 * file on the DGX and in Vercel env (prod + preview).
 */
export function validateDirectRunnerBearer(req: NextRequest): {
  ok: true;
} | { ok: false; response: NextResponse } {
  const expected = process.env.VATER_DIRECT_RUNNER_TOKEN || "";
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "VATER_DIRECT_RUNNER_TOKEN not configured" },
        { status: 500 },
      ),
    };
  }
  const header = req.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token || !secretEquals(token.trim(), expected)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true };
}

/**
 * Bearer auth for the PUBLIC API (`/api/v1/*`).
 *
 * Distinct from validateDirectRunnerBearer above in one important way: that
 * one checks a single shared secret owned by us, this one resolves a
 * per-customer credential and tells the caller WHOSE tenant the request runs
 * in. Everything downstream — project creation, credit checks, project reads —
 * must be scoped to the returned `userId` exactly as a session would be.
 *
 * Bearer-ONLY, no session fallback. A browser that happens to have an
 * /animate cookie must not be able to drive the public API by accident, and
 * more importantly a cookie-authenticated /api/v1 would be CSRF-able: these
 * routes have no same-origin requirement and no CSRF token.
 *
 * 503, not 401, when the table has not been migrated yet: "your key is wrong"
 * would be a lie, and an integrator would go regenerate a perfectly good key.
 */
export interface ApiKeyAuthOk {
  ok: true;
  userId: string;
  keyId: string;
  webhookUrl: string | null;
}
export interface ApiKeyAuthFail {
  ok: false;
  response: NextResponse;
}

function apiError(status: number, error: string, message: string): NextResponse {
  return NextResponse.json(
    { error, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function requireApiKey(
  req: NextRequest,
): Promise<ApiKeyAuthOk | ApiKeyAuthFail> {
  const header = req.headers.get("authorization") || "";
  const [scheme, ...rest] = header.split(" ");
  const token = rest.join(" ").trim();

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return {
      ok: false,
      response: apiError(
        401,
        "unauthorized",
        "Send your key as an Authorization: Bearer <key> header. Create one in Jelly Studio → API Keys.",
      ),
    };
  }

  if (!(await hasApiKeyTable())) {
    return {
      ok: false,
      response: apiError(
        503,
        "not_ready",
        "The public API is deployed but its database migration has not been applied yet. Try again shortly.",
      ),
    };
  }

  let key: ResolvedKey | null;
  try {
    key = await resolveApiKey(token);
  } catch (err) {
    console.error("[v1/auth] key lookup failed", err);
    return {
      ok: false,
      response: apiError(503, "not_ready", "Could not verify the key right now."),
    };
  }

  if (!key) {
    return {
      ok: false,
      response: apiError(
        401,
        "unauthorized",
        "That key is not recognised, or it has been revoked.",
      ),
    };
  }

  // Best-effort usage stamp. Awaited (not fire-and-forget) because a Vercel
  // function can be frozen the instant the response is returned, which would
  // drop a floating promise — see feedback_vercel_after_not_fire_forget.
  await touchApiKey(key.id);

  return { ok: true, userId: key.userId, keyId: key.id, webhookUrl: key.webhookUrl };
}
