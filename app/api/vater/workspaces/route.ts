/**
 * GET  /api/vater/workspaces — every studio TAB this login owns
 * POST /api/vater/workspaces — mint a new tab  { name }
 *
 * A tab is a fully separate studio under one login (lib/vater/workspaces.ts).
 * The owner is always the ROOT login, whichever tab the request arrives from,
 * so the strip looks identical from every tab.
 *
 * 503 FEATURE_NOT_READY until the VaterWorkspace migration has run; the
 * client hides the strip on that answer.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { FEATURE_NOT_READY } from "@/lib/vater/beta-schema";
import { logVaterEvent } from "@/lib/vater/events";
import {
  MAX_WORKSPACES,
  createWorkspace,
  hasWorkspaceTable,
  listWorkspaces,
  reorderWorkspaces,
  shapeWorkspace as shapeRow,
} from "@/lib/vater/workspaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasWorkspaceTable())) {
    return NextResponse.json({ ...FEATURE_NOT_READY, workspaces: [] }, { status: 503, headers: NO_STORE });
  }
  const rootUserId = session.workspace?.rootUserId ?? session.user.id;
  const includeArchived = request.nextUrl.searchParams.get("archived") === "1";
  const rows = await listWorkspaces(rootUserId, { includeArchived });
  return NextResponse.json(
    {
      workspaces: rows.map((r) => shapeRow(r, session.user!.id)),
      activeId: session.user.id,
      rootUserId,
      max: MAX_WORKSPACES,
    },
    { headers: NO_STORE },
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  let body: { name?: unknown; order?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }
  const rootUserId = session.workspace?.rootUserId ?? session.user.id;

  // { order: [id, id, …] } — persist a drag-reorder. Same route so the strip
  // has one place to talk to.
  if (Array.isArray(body.order)) {
    if (!(await hasWorkspaceTable())) {
      return NextResponse.json(FEATURE_NOT_READY, { status: 503, headers: NO_STORE });
    }
    await reorderWorkspaces(rootUserId, body.order.filter((x): x is string => typeof x === "string"));
    const rows = await listWorkspaces(rootUserId);
    return NextResponse.json(
      { ok: true, workspaces: rows.map((r) => shapeRow(r, session.user!.id)) },
      { headers: NO_STORE },
    );
  }

  const result = await createWorkspace(rootUserId, typeof body.name === "string" ? body.name : "");
  if (!result.ok) {
    if (result.reason === "not_ready") {
      return NextResponse.json(FEATURE_NOT_READY, { status: 503, headers: NO_STORE });
    }
    if (result.reason === "limit") {
      return NextResponse.json(
        { error: "WORKSPACE_LIMIT", message: `You can have up to ${MAX_WORKSPACES} studios. Archive one to add another.` },
        { status: 409, headers: NO_STORE },
      );
    }
    return NextResponse.json({ error: "Give the studio a name." }, { status: 400, headers: NO_STORE });
  }

  await logVaterEvent({
    userId: rootUserId,
    kind: "workspace.created",
    message: `New studio tab “${result.row.name}”`,
  }).catch(() => undefined);
  await logVaterEvent({
    userId: result.row.userId,
    kind: "workspace.created",
    message: `Studio “${result.row.name}” created — a fresh library, cast, voices, connections and balance.`,
  }).catch(() => undefined);

  return NextResponse.json(
    { ok: true, workspace: shapeRow(result.row, session.user.id) },
    { status: 201, headers: NO_STORE },
  );
}
