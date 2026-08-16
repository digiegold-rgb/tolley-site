/**
 * POST /api/vater/voices/[id]/preview — start a ~30s Voice Tuner sample.
 *
 * Async: the DGX kicks IndexTTS-2 on Modal (never the DGX GPU) and returns a
 * previewId immediately; poll /api/vater/voice-previews/[pid]. Studio-gated —
 * every sample is a (small) Modal spend.
 */
import { NextRequest, NextResponse } from "next/server";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { requireVaterProxyAuth } from "@/lib/vater/proxy-auth";
import { auth } from "@/auth";
import { canAccessVoice } from "@/lib/vater/voice-privacy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyAuth(req);
  if (!gate.ok) return gate.response;
  const name = (await ctx.params).id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!name) return NextResponse.json({ error: "Invalid voice name" }, { status: 400 });
  // Owner-private clones: no sampling the owner's voice.
  const session = await auth();
  if (session?.user?.id && !canAccessVoice(name, session.user.email ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: { text?: string; gen?: unknown; post?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.split(/\s+/).filter(Boolean).length < 3) {
    return NextResponse.json({ error: "Sample text too short" }, { status: 400 });
  }
  try {
    const out = await autopilot.startVoicePreview(name, {
      text: text.slice(0, 2000),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gen: (body.gen ?? {}) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      post: (body.post ?? {}) as any,
    });
    return NextResponse.json(out, { status: 202 });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: "Preview start failed", status: err.status, detail: err.body || err.message },
        { status: err.status === 404 ? 404 : 502 },
      );
    }
    return NextResponse.json(
      { error: "Preview start failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 },
    );
  }
}
