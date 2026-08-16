/**
 * POST /api/vater/voices/[id]/samples/[sid]/lock — make a gallery sample the
 * voice's locked tuning (writes vater_voices/<Name>.tuning.json on the DGX).
 * Same write scope as PUT /tuning: shared voices = owner account only.
 */
import { NextRequest, NextResponse } from "next/server";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { requireVaterProxyAuth } from "@/lib/vater/proxy-auth";
import { auth } from "@/auth";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import { canWriteVoice, ownerKeyForUser, splitVoiceId, voiceWireId } from "@/lib/vater/voice-privacy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; sid: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const gate = await requireVaterProxyAuth(req);
  if (!gate.ok) return gate.response;
  const { id, sid: rawSid } = await ctx.params;
  const { owner, stem } = splitVoiceId(id);
  const name = stem ? voiceWireId(owner, stem) : "";
  const sid = rawSid.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!name || !sid) return NextResponse.json({ error: "Invalid sample" }, { status: 400 });

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;
  let scope: { owner: string; admin: boolean } = { owner: "", admin: true };
  if (userId) {
    if (!canWriteVoice(name, { userId, email })) {
      return NextResponse.json({ error: "You can only tune voices you uploaded." }, { status: 403 });
    }
    scope = { owner: ownerKeyForUser(userId), admin: isVaterAdminEmail(email) };
  }
  try {
    return NextResponse.json(await autopilot.lockVoiceSample(name, sid, scope));
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: "Failed to lock sample", status: err.status, detail: err.body || err.message },
        { status: err.status === 404 || err.status === 403 ? err.status : 502 },
      );
    }
    return NextResponse.json({ error: "Failed to lock sample" }, { status: 502 });
  }
}
