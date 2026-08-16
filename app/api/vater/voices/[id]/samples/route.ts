/**
 * /api/vater/voices/[id]/samples — Voice sample gallery (2026-08-16).
 *
 *   GET  → the 10 advisor variants for a voice (labels, why, tuning, status,
 *          top-3 picks) — Studio-gated like the rest of the Tuner.
 *   POST → (re)build the gallery on Modal (async; ~$0.01–0.03 per sample).
 *          Write-scoped like tuning: shared voices = owner account only.
 *
 * Thin proxy to the DGX autopilot (`vater_voice_tuning.py`), which keeps the
 * WAVs durably beside the clone (`vater_voices/<Name>.samples/`).
 */
import { NextRequest, NextResponse } from "next/server";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { requireVaterProxyRead, requireVaterProxyAuth } from "@/lib/vater/proxy-auth";
import { auth } from "@/auth";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import {
  canReadVoice,
  canWriteVoice,
  ownerKeyForUser,
  splitVoiceId,
  voiceWireId,
} from "@/lib/vater/voice-privacy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function fail(err: unknown, what: string) {
  if (err instanceof AutopilotError) {
    return NextResponse.json(
      { error: what, status: err.status, detail: err.body || err.message },
      { status: [403, 404, 409].includes(err.status) ? err.status : 502 },
    );
  }
  return NextResponse.json(
    { error: what, detail: err instanceof Error ? err.message : "unknown" },
    { status: 502 },
  );
}

function safeVoiceId(id: string): string {
  const { owner, stem } = splitVoiceId(id);
  return stem ? voiceWireId(owner, stem) : "";
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyRead(req);
  if (!gate.ok) return gate.response;
  const name = safeVoiceId((await ctx.params).id);
  if (!name) return NextResponse.json({ error: "Invalid voice name" }, { status: 400 });
  const session = await auth();
  if (
    session?.user?.id &&
    !canReadVoice(name, { userId: session.user.id, email: session.user.email ?? null })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json(await autopilot.getVoiceSamples(name));
  } catch (err) {
    return fail(err, "Failed to load voice samples");
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyAuth(req);
  if (!gate.ok) return gate.response;
  const name = safeVoiceId((await ctx.params).id);
  if (!name) return NextResponse.json({ error: "Invalid voice name" }, { status: 400 });
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;
  let scope: { owner: string; admin: boolean } = { owner: "", admin: true };
  if (userId) {
    if (!canWriteVoice(name, { userId, email })) {
      return NextResponse.json({ error: "You can only build samples for voices you own." }, { status: 403 });
    }
    scope = { owner: ownerKeyForUser(userId), admin: isVaterAdminEmail(email) };
  }
  let body: { text?: string; only?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  try {
    return NextResponse.json(
      await autopilot.generateVoiceSamples(
        name,
        {
          text: typeof body.text === "string" ? body.text.slice(0, 2000) : undefined,
          only: Array.isArray(body.only) ? body.only.map(String).slice(0, 20) : undefined,
        },
        scope,
      ),
      { status: 202 },
    );
  } catch (err) {
    return fail(err, "Failed to start sample build");
  }
}
