import "server-only";
import { NextRequest, NextResponse } from "next/server";

/**
 * Shared-secret bearer auth for the DGX-side vater-observer MCP server.
 * The watcher posts notes + proposals to tolley-site over HTTPS. The token
 * lives in the watcher's state .env and in Vercel env (prod + preview).
 */
export function validateObserverBearer(req: NextRequest): {
  ok: true;
} | { ok: false; response: NextResponse } {
  const expected = process.env.VATER_OBSERVER_TOKEN || "";
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "VATER_OBSERVER_TOKEN not configured" },
        { status: 500 },
      ),
    };
  }
  const header = req.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token || token.trim() !== expected) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true };
}
