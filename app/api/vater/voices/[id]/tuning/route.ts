/**
 * /api/vater/voices/[id]/tuning — Voice Tuner persistence (2026-08-15).
 *
 *   GET    → locked tuning (or env defaults) for a voice clone   (any signed-in)
 *   PUT    → lock in a tuning: every render of this voice honors it   (studio)
 *   DELETE → back to factory/env defaults                             (studio)
 *
 * Thin proxy to the DGX autopilot (`vater_voice_tuning.py`), which owns the
 * truth at vater_voices/<Name>.tuning.json.
 */
import { NextRequest, NextResponse } from "next/server";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import {
  requireVaterProxyAuth,
  requireVaterProxyRead,
} from "@/lib/vater/proxy-auth";
import { auth } from "@/auth";
import { canAccessVoice } from "@/lib/vater/voice-privacy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Owner-private clones (Jared-A..D) are hidden from every non-owner surface,
 * tuning included. Returns a 403 response when denied, null when allowed.
 * No session = x-sync-secret server-to-server caller → always allowed.
 */
async function denyPrivateVoice(name: string) {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (canAccessVoice(name, session.user.email ?? null)) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function fail(err: unknown, what: string) {
  if (err instanceof AutopilotError) {
    return NextResponse.json(
      { error: what, status: err.status, detail: err.body || err.message },
      { status: err.status === 404 ? 404 : 502 },
    );
  }
  return NextResponse.json(
    { error: what, detail: err instanceof Error ? err.message : "unknown" },
    { status: 502 },
  );
}

function safeName(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyRead(req);
  if (!gate.ok) return gate.response;
  const name = safeName((await ctx.params).id);
  if (!name) return NextResponse.json({ error: "Invalid voice name" }, { status: 400 });
  const denied = await denyPrivateVoice(name);
  if (denied) return denied;
  try {
    return NextResponse.json(await autopilot.getVoiceTuning(name));
  } catch (err) {
    return fail(err, "Failed to load voice tuning");
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyAuth(req);
  if (!gate.ok) return gate.response;
  const name = safeName((await ctx.params).id);
  if (!name) return NextResponse.json({ error: "Invalid voice name" }, { status: 400 });
  const denied = await denyPrivateVoice(name);
  if (denied) return denied;
  let body: { tuning?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.tuning || typeof body.tuning !== "object") {
    return NextResponse.json({ error: "tuning object required" }, { status: 400 });
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return NextResponse.json(await autopilot.putVoiceTuning(name, body.tuning as any));
  } catch (err) {
    return fail(err, "Failed to save voice tuning");
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyAuth(req);
  if (!gate.ok) return gate.response;
  const name = safeName((await ctx.params).id);
  if (!name) return NextResponse.json({ error: "Invalid voice name" }, { status: 400 });
  const denied = await denyPrivateVoice(name);
  if (denied) return denied;
  try {
    return NextResponse.json(await autopilot.deleteVoiceTuning(name));
  } catch (err) {
    return fail(err, "Failed to reset voice tuning");
  }
}
