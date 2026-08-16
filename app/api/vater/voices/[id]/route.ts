/**
 * DELETE /api/vater/voices/[id]
 *
 * Proxies a delete to the autopilot side. The `id` here is the voice
 * `name` (the autopilot library is keyed by name, not numeric id).
 *
 * The shared `autopilot` client doesn't currently expose a deleteVoice
 * helper, so we hand-roll the call here using the same env vars. If/when
 * the schema agent adds one, this can be simplified.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireVaterProxyAuth } from "@/lib/vater/proxy-auth";
import { canAccessVoice } from "@/lib/vater/voice-privacy";

const BASE = (process.env.AUTOPILOT_URL || "").replace(/\/$/, "");
const KEY = process.env.CONTENT_API_KEY || "";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: Ctx) {
  // Auth-gate: this permanently deletes a voice clone on the DGX, and the
  // library is SHARED — any signed-in user could wipe another customer's (or
  // the owner's) clone. Studio tier is the bar for writes (2026-08-15).
  const gate = await requireVaterProxyAuth(req);
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;

  // Owner-private clones can only be deleted by the owner. (No session =
  // x-sync-secret server-to-server caller, already fully trusted.)
  const session = await auth();
  if (session?.user?.id && !canAccessVoice(id, session.user.email ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!BASE || !KEY) {
    return NextResponse.json(
      { error: "AUTOPILOT_URL or CONTENT_API_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    const upstream = await fetch(
      `${BASE}/vater/voices/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${KEY}` },
        cache: "no-store",
      },
    );
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Upstream delete failed",
          status: upstream.status,
          detail: text || upstream.statusText,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Upstream delete failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
