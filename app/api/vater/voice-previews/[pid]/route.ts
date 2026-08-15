/** GET /api/vater/voice-previews/[pid] — poll a Voice Tuner sample. */
import { NextRequest, NextResponse } from "next/server";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { requireVaterProxyRead } from "@/lib/vater/proxy-auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ pid: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyRead(req);
  if (!gate.ok) return gate.response;
  const pid = (await ctx.params).pid.replace(/[^a-f0-9]/g, "");
  if (!pid) return NextResponse.json({ error: "Invalid preview id" }, { status: 400 });
  try {
    return NextResponse.json(await autopilot.getVoicePreview(pid));
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: "Preview lookup failed", status: err.status, detail: err.body || err.message },
        { status: err.status === 404 ? 404 : 502 },
      );
    }
    return NextResponse.json({ error: "Preview lookup failed" }, { status: 502 });
  }
}
