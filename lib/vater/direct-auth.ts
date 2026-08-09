import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";

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
