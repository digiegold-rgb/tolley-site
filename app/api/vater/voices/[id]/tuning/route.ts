/**
 * /api/vater/voices/[id]/tuning — Voice Tuner persistence (2026-08-15).
 *
 *   GET    → locked tuning (or env defaults) for a voice the caller can read
 *   PUT    → lock in a tuning: every render of this voice honors it
 *   DELETE → back to factory/env defaults
 *
 * Thin proxy to the DGX autopilot (`vater_voice_tuning.py`), which owns the
 * truth at `<ownerDir>/<Name>.tuning.json`.
 *
 * Scope (per-user namespaces, Phase 3): reads follow the same rule as the
 * catalog — shared voices plus your own. WRITES are narrower: only your own
 * clones. The shared library stays read-only for everyone but the owner
 * account, because a locked tuning is global — one tenant re-EQ'ing Monroe
 * would change her in every other tenant's renders.
 */
import { NextRequest, NextResponse } from "next/server";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { requireVaterProxyRead } from "@/lib/vater/proxy-auth";
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
      { status: err.status === 404 || err.status === 403 ? err.status : 502 },
    );
  }
  return NextResponse.json(
    { error: what, detail: err instanceof Error ? err.message : "unknown" },
    { status: 502 },
  );
}

/** Namespaced-safe id, or "" when the segment carries no usable name. */
function safeVoiceId(id: string): string {
  const { owner, stem } = splitVoiceId(id);
  return stem ? voiceWireId(owner, stem) : "";
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyRead(req);
  if (!gate.ok) return gate.response;
  const name = safeVoiceId((await ctx.params).id);
  if (!name) return NextResponse.json({ error: "Invalid voice name" }, { status: 400 });

  // No session = x-sync-secret server-to-server caller → always allowed.
  const session = await auth();
  if (
    session?.user?.id &&
    !canReadVoice(name, { userId: session.user.id, email: session.user.email ?? null })
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    return NextResponse.json(await autopilot.getVoiceTuning(name));
  } catch (err) {
    return fail(err, "Failed to load voice tuning");
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyRead(req);
  if (!gate.ok) return gate.response;
  const name = safeVoiceId((await ctx.params).id);
  if (!name) return NextResponse.json({ error: "Invalid voice name" }, { status: 400 });

  const session = await auth();
  const scope = writeScope(session, name);
  if ("response" in scope) return scope.response;

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
    return NextResponse.json(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await autopilot.putVoiceTuning(name, body.tuning as any, scope),
    );
  } catch (err) {
    return fail(err, "Failed to save voice tuning");
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyRead(req);
  if (!gate.ok) return gate.response;
  const name = safeVoiceId((await ctx.params).id);
  if (!name) return NextResponse.json({ error: "Invalid voice name" }, { status: 400 });

  const session = await auth();
  const scope = writeScope(session, name);
  if ("response" in scope) return scope.response;

  try {
    return NextResponse.json(await autopilot.deleteVoiceTuning(name, scope));
  } catch (err) {
    return fail(err, "Failed to reset voice tuning");
  }
}

/**
 * Owner fields for an upstream tuning write, or the 403 that stops it.
 * A sessionless caller is the x-sync-secret server/DGX path — already trusted,
 * so it writes with the admin flag.
 */
function writeScope(
  session: { user?: { id?: string | null; email?: string | null } | null } | null,
  name: string,
): { owner: string; admin: boolean } | { response: NextResponse } {
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;
  if (!userId) return { owner: "", admin: true };
  if (!canWriteVoice(name, { userId, email })) {
    return {
      response: NextResponse.json(
        { error: "You can only tune voices you uploaded." },
        { status: 403 },
      ),
    };
  }
  return { owner: ownerKeyForUser(userId), admin: isVaterAdminEmail(email) };
}
