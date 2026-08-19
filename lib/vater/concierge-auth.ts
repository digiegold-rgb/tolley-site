/**
 * lib/vater/concierge-auth.ts — who may drive a Fable 5 Concierge ticket.
 *
 * Two callers, two credentials, NO session fallback:
 *   - the DGX CLI (`~/vater-studio/fable5/fable5.mjs`) sends
 *     `Authorization: Bearer <CONTENT_API_KEY>` — the same secret the DGX
 *     already holds for /api/vater/latest, so the lane adds zero new secrets;
 *   - the /hq "📜 Fable 5" tab rides the HQ PIN cookie (`validateWdAdmin`).
 *
 * A NextAuth session — even the owner's — is deliberately NOT enough: these
 * routes kick renders and deliver videos on OTHER tenants' projects, and
 * /hq's "view-as" cookie must never be able to reach them by accident.
 *
 * `authorizeConcierge` returns the caller label (`"dgx"` / `"hq"`) for the
 * ticket history, or a ready-made 401/500 response.
 */
import "server-only";

import { NextResponse } from "next/server";

import { secretEquals } from "@/lib/secret-compare";
import { validateWdAdmin } from "@/lib/wd-auth";

export type ConciergeCaller = "dgx" | "hq";

export type ConciergeAuthResult =
  | { ok: true; by: ConciergeCaller }
  | { ok: false; response: NextResponse };

/** Bearer CONTENT_API_KEY (constant-time) OR /hq PIN cookie. */
export async function authorizeConcierge(req: Request): Promise<ConciergeAuthResult> {
  const key = process.env.CONTENT_API_KEY;
  if (!key) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "CONTENT_API_KEY not configured", code: "not_configured" },
        { status: 500 },
      ),
    };
  }

  const bearer = req.headers.get("authorization") ?? "";
  if (bearer && secretEquals(bearer, `Bearer ${key}`)) {
    return { ok: true, by: "dgx" };
  }

  const admin = await validateWdAdmin();
  if (admin.authed) {
    return { ok: true, by: "hq" };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized", code: "unauthorized" }, { status: 401 }),
  };
}

/** Optional `by` override from the body (CLI passes "claude"), else the caller label. */
export function actorLabel(by: ConciergeCaller, bodyBy?: unknown): string {
  return typeof bodyBy === "string" && bodyBy.trim() ? bodyBy.trim().slice(0, 40) : by;
}
