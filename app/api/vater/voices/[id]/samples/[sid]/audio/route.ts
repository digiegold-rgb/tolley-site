/** GET /api/vater/voices/[id]/samples/[sid]/audio — stream one gallery sample WAV (signed-in). */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { canReadVoice, splitVoiceId, voiceWireId } from "@/lib/vater/voice-privacy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; sid: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, sid: rawSid } = await ctx.params;
  const { owner, stem } = splitVoiceId(id);
  const name = stem ? voiceWireId(owner, stem) : "";
  const sid = rawSid.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!name || !sid) return NextResponse.json({ error: "Invalid sample" }, { status: 400 });
  if (!canReadVoice(name, { userId: session.user.id, email: session.user.email ?? null })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const raw = req.nextUrl.searchParams.get("raw") === "1";
  try {
    const upstream = await autopilot.fetchVoiceSampleAudio(name, sid, raw);
    if (!upstream.body) {
      return NextResponse.json({ error: "Empty upstream body" }, { status: 502 });
    }
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "audio/wav",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=600",
    });
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: "Sample audio fetch failed", status: err.status },
        { status: err.status === 404 ? 404 : 502 },
      );
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
