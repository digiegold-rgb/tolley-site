/**
 * DELETE /api/vater/drivers/:id — remove one of the caller's OWN driver clips.
 *
 * `:id` is "<owner>~<stem>". Only the session's own namespace is deletable;
 * the shared starter library and the house library are owner-side tooling.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import { ownerKeyForUser } from "@/lib/vater/voice-ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const { id } = await ctx.params;
  const [owner, stem] = decodeURIComponent(id).split("~");
  if (!owner || !stem || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(stem)) {
    return NextResponse.json({ error: "Invalid driver id" }, { status: 400, headers: NO_STORE });
  }
  if (owner !== ownerKeyForUser(session.user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  try {
    await autopilot.deleteDriver(owner, stem);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    const status = err instanceof AutopilotError ? err.status : 502;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: status === 404 ? 404 : 502, headers: NO_STORE },
    );
  }
}
