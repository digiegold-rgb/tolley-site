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

const BASE = (process.env.AUTOPILOT_URL || "").replace(/\/$/, "");
const KEY = process.env.CONTENT_API_KEY || "";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
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
