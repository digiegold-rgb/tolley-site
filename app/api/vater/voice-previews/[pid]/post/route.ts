/**
 * POST /api/vater/voice-previews/[pid]/post — re-apply ONLY the EQ/post chain
 * to a finished sample's cached raw take (~1-3s, no Modal spend). This is
 * what makes the tuner's EQ sliders feel live.
 */
import { NextRequest, NextResponse } from "next/server";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { requireVaterProxyAuth } from "@/lib/vater/proxy-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ pid: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyAuth(req);
  if (!gate.ok) return gate.response;
  const pid = (await ctx.params).pid.replace(/[^a-f0-9]/g, "");
  if (!pid) return NextResponse.json({ error: "Invalid preview id" }, { status: 400 });
  let body: { post?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json(await autopilot.repostVoicePreview(pid, (body.post ?? {}) as any));
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: "Re-process failed", status: err.status, detail: err.body || err.message },
        { status: err.status === 404 || err.status === 409 ? err.status : 502 },
      );
    }
    return NextResponse.json({ error: "Re-process failed" }, { status: 502 });
  }
}
