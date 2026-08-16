/**
 * DELETE /api/vater/voices/[id]
 *
 * `id` is the voice's wire id — a bare stem for a shared/system voice
 * ("Monroe") or `u_<userId>~Stem` for a tenant's own clone.
 *
 * Per-user namespaces (2026-08-15): a customer may delete their OWN clones and
 * nothing else. The shared library is read-only for everyone but the owner
 * account, which sends `X-Vater-Owner-Admin: 1` upstream. Before this, any
 * studio-tier session could wipe Monroe — or another customer's voice — out of
 * the one flat directory.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import { canWriteVoice, ownerKeyForUser } from "@/lib/vater/voice-privacy";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const userId = session.user.id;
  const email = session.user.email ?? null;

  if (!canWriteVoice(id, { userId, email })) {
    return NextResponse.json(
      { error: "You can only delete voices you uploaded." },
      { status: 403 },
    );
  }

  try {
    const result = await autopilot.deleteVoice(id, {
      owner: ownerKeyForUser(userId),
      admin: isVaterAdminEmail(email),
    });
    return NextResponse.json({ ...result, ok: true });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        {
          error: "Upstream delete failed",
          status: err.status,
          detail: err.body || err.message,
        },
        { status: err.status === 404 || err.status === 403 ? err.status : 502 },
      );
    }
    return NextResponse.json(
      {
        error: "Upstream delete failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
