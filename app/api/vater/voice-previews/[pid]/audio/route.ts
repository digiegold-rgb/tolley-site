/**
 * GET /api/vater/voice-previews/[pid]/audio?v=N[&raw=1] — stream a Voice
 * Tuner sample WAV (signed-in only; bearer added server-side).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { denyPrivateVoicePreview } from "@/lib/vater/voice-preview-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ pid: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pid = (await ctx.params).pid.replace(/[^a-f0-9]/g, "");
  if (!pid) return NextResponse.json({ error: "Invalid preview id" }, { status: 400 });
  const denied = await denyPrivateVoicePreview(pid);
  if (denied) return denied;
  const v = Number(req.nextUrl.searchParams.get("v") || "") || null;
  const raw = req.nextUrl.searchParams.get("raw") === "1";
  try {
    const upstream = await autopilot.fetchVoicePreviewAudio(pid, v, raw);
    if (!upstream.body) {
      return NextResponse.json({ error: "Empty upstream body" }, { status: 502 });
    }
    const headers = new Headers({
      "Content-Type": upstream.headers.get("content-type") || "audio/wav",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
    });
    const len = upstream.headers.get("content-length");
    if (len) headers.set("Content-Length", len);
    return new Response(upstream.body, { status: 200, headers });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: "Preview audio fetch failed", status: err.status },
        { status: err.status === 404 ? 404 : 502 },
      );
    }
    return NextResponse.json({ error: "Unknown error" }, { status: 500 });
  }
}
