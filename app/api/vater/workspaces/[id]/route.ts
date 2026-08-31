/**
 * PATCH  /api/vater/workspaces/:id  { name }            — rename
 * PATCH  /api/vater/workspaces/:id  { restore: true }   — un-archive
 * DELETE /api/vater/workspaces/:id                      — archive (never delete)
 *
 * `:id` is the tab's userId (what the strip and the cookie use). Ownership is
 * enforced by the WHERE ownerUserId in lib/vater/workspaces.ts, not here.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { FEATURE_NOT_READY } from "@/lib/vater/beta-schema";
import { logVaterEvent } from "@/lib/vater/events";
import {
  archiveWorkspace,
  clearWsCookie,
  hasWorkspaceTable,
  renameWorkspace,
  restoreWorkspace,
  sessionRootUserId,
  shapeWorkspace as shapeRow,
} from "@/lib/vater/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasWorkspaceTable())) {
    return NextResponse.json(FEATURE_NOT_READY, { status: 503, headers: NO_STORE });
  }
  const { id } = await ctx.params;
  const rootUserId = await sessionRootUserId(session);

  let body: { name?: unknown; restore?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  if (body.restore === true) {
    const ok = await restoreWorkspace(rootUserId, id);
    if (!ok) {
      return NextResponse.json(
        { error: "WORKSPACE_LIMIT", message: "At the studio limit — archive another tab first." },
        { status: 409, headers: NO_STORE },
      );
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "name (string) required" }, { status: 400, headers: NO_STORE });
  }
  const row = await renameWorkspace(rootUserId, id, body.name);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true, workspace: shapeRow(row, session.user.id) }, { headers: NO_STORE });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasWorkspaceTable())) {
    return NextResponse.json(FEATURE_NOT_READY, { status: 503, headers: NO_STORE });
  }
  const { id } = await ctx.params;
  const rootUserId = await sessionRootUserId(session);

  const outcome = await archiveWorkspace(rootUserId, id);
  if (outcome === "primary") {
    return NextResponse.json(
      { error: "PRIMARY_WORKSPACE", message: "Your main studio can't be archived." },
      { status: 400, headers: NO_STORE },
    );
  }
  if (outcome === "missing") {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }

  await logVaterEvent({
    userId: rootUserId,
    kind: "workspace.archived",
    message: "Studio tab archived (renders and balance kept — restore from Settings → Studios).",
  }).catch(() => undefined);

  const res = NextResponse.json(
    { ok: true, switched: id === session.user.id },
    { headers: NO_STORE },
  );
  // Archiving the tab you're standing in drops you back to the primary.
  if (id === session.user.id) res.cookies.set(clearWsCookie());
  return res;
}
