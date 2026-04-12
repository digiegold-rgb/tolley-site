/**
 * GET /api/vater/voices/[id]/sample
 *
 * Streaming passthrough for a voice clone's reference WAV. Used by the
 * `<YouTubeVoiceClonePanel>` card audio elements so users can audition a
 * voice before burning a 15-minute render. Bearer auth is injected
 * server-side via `autopilot.fetchVoiceFile()`.
 *
 * Note on naming: this file sits under `[id]` (not `[name]`) because Next.js
 * doesn't allow sibling dynamic segments at the same level, and the existing
 * DELETE handler at `app/api/vater/voices/[id]/route.ts` already owns `[id]`.
 * The param value is still the voice name.
 */
import { NextRequest, NextResponse } from "next/server";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) {
    return NextResponse.json({ error: "Invalid voice name" }, { status: 400 });
  }
  try {
    const upstream = await autopilot.fetchVoiceFile(safe);
    if (!upstream.body) {
      console.error(`[vater/voices/sample] voice=${safe} empty upstream body`);
      return NextResponse.json(
        { error: "Empty upstream body" },
        { status: 502 },
      );
    }
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "audio/wav",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=3600",
    });
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof AutopilotError) {
      console.error(
        `[vater/voices/sample] voice=${safe} upstream ${err.status}: ${err.body || err.message}`,
      );
      return NextResponse.json(
        { error: "Upstream voice fetch failed", status: err.status },
        { status: err.status === 404 ? 404 : 502 },
      );
    }
    console.error(
      `[vater/voices/sample] voice=${safe} unknown error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
