/**
 * Draft snapshots for the vater/youtube editor. Each save appends a snapshot
 * to `YouTubeProject.draftSnapshots` (a JSON array) so the user can revert.
 *
 * POST  /api/vater/youtube/[id]/draft         — append a new snapshot
 * GET   /api/vater/youtube/[id]/draft         — list existing snapshots
 *
 * Snapshot shape:
 *   { ts: string (ISO), scenesJson: unknown, audioUrl: string|null,
 *     backgroundMusicId: string|null, thumbnailUrl: string|null,
 *     note?: string }
 *
 * Snapshots are append-only; revert is a separate endpoint (phase 2).
 * Never truncates — eventually we'll cap at 50 and drop oldest.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessProject,
  checkProjectAccess,
} from "@/lib/vater/project-access";

type Ctx = { params: Promise<{ id: string }> };

const MAX_SNAPSHOTS = 50;

type Snapshot = {
  ts: string;
  scenesJson: unknown;
  audioUrl: string | null;
  backgroundMusicId: string | null;
  thumbnailUrl: string | null;
  note?: string;
};

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { draftSnapshots: true, editedAt: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const snapshots = Array.isArray(project.draftSnapshots)
    ? (project.draftSnapshots as unknown as Snapshot[])
    : [];

  return NextResponse.json({
    snapshots,
    editedAt: project.editedAt,
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    note?: unknown;
    scenesJson?: unknown;
  };
  const note =
    typeof body.note === "string" ? body.note.slice(0, 200) : undefined;
  // Editor passes its current local scenesJson so in-drawer edits (beat text,
  // image prompts) actually reach the server. Without this they're local-only
  // and disappear on refresh. Must be a plain array of scene objects; any
  // other shape is rejected to prevent garbage writes.
  const incomingScenes =
    Array.isArray(body.scenesJson) ? body.scenesJson : null;

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      userId: true,
      scenesJson: true,
      audioUrl: true,
      backgroundMusicId: true,
      thumbnailUrl: true,
      draftSnapshots: true,
      status: true,
    },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Merge client's scenesJson (if supplied) per-idx with server's current
  // scenesJson. Preserves UI fields (mediaType, videoUrl, videoVersion) that
  // the client might not know about; only overwrites pipeline-text fields
  // the user actually edited.
  let nextScenesJson: unknown = project.scenesJson;
  if (incomingScenes) {
    const existingByIdx: Record<number, Record<string, unknown>> = {};
    if (Array.isArray(project.scenesJson)) {
      for (const s of project.scenesJson as Array<Record<string, unknown>>) {
        const idx = typeof s?.idx === "number" ? s.idx : -1;
        if (idx >= 0) existingByIdx[idx] = s;
      }
    }
    nextScenesJson = incomingScenes.map((s, i) => {
      const scene = s as Record<string, unknown>;
      const idx = typeof scene.idx === "number" ? scene.idx : i;
      const existing = existingByIdx[idx] ?? {};
      return {
        ...existing,
        idx,
        beatText:
          typeof scene.beatText === "string"
            ? scene.beatText
            : (existing.beatText as string | undefined) ?? "",
        imagePrompt:
          typeof scene.imagePrompt === "string"
            ? scene.imagePrompt
            : (existing.imagePrompt as string | undefined) ?? "",
      };
    });
  }

  const existingSnapshots = Array.isArray(project.draftSnapshots)
    ? (project.draftSnapshots as unknown as Snapshot[])
    : [];

  const snapshot: Snapshot = {
    ts: new Date().toISOString(),
    scenesJson: nextScenesJson,
    audioUrl: project.audioUrl,
    backgroundMusicId: project.backgroundMusicId,
    thumbnailUrl: project.thumbnailUrl,
    ...(note ? { note } : {}),
  };

  // Append new, keep last N. Old entries get trimmed from the front.
  const nextSnapshots = [...existingSnapshots, snapshot].slice(-MAX_SNAPSHOTS);

  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: {
      // Persist the merged scenesJson ONLY if client sent one — otherwise
      // leave server's copy untouched. Empty payload = pure snapshot-only.
      ...(incomingScenes
        ? { scenesJson: nextScenesJson as unknown as object }
        : {}),
      draftSnapshots: nextSnapshots as unknown as object,
      editedAt: new Date(),
      status: project.status === "ready" ? "editing" : project.status,
    },
    select: {
      id: true,
      status: true,
      editedAt: true,
      draftSnapshots: true,
    },
  });

  return NextResponse.json({
    ok: true,
    snapshot,
    count: nextSnapshots.length,
    project: updated,
  });
}
