/**
 * GET    /api/vater/youtube/styles/[id]   — read full style + characters + customArtStyle
 * PATCH  /api/vater/youtube/styles/[id]   — partial update (autosave-friendly)
 * DELETE /api/vater/youtube/styles/[id]   — delete a user-owned style (system styles are immutable)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

type Ctx = { params: Promise<{ id: string }> };

const PATCHABLE_FIELDS = [
  "name",
  "emoji",
  "voice",
  "voiceBackend",
  "voiceSpeed",
  "voiceStability",
  "voiceSimilarity",
  "voiceExaggeration",
  "language",
  "defaultWordCount",
  "scriptMode",
  "webSearchDefault",
  "additionalContext",
  "artStylePresetId",
  "customArtStyleId",
  "defaultAspectRatio",
  "defaultQuality",
  "defaultVisualType",
  "defaultAnimMode",
  "defaultAnimMin",
  "defaultAnimMax",
  "defaultPacingSec",
  "defaultConsistency",
  "enableCharts",
  "enableMaps",
  "enableAutoHeaders",
  "overlayTheme",
] as const;

async function loadOwned(id: string, userId: string) {
  const style = await prisma.youTubeStyle.findUnique({
    where: { id },
    include: { characters: true, customArtStyle: true },
  });
  if (!style) return { error: "Not found", status: 404 as const };
  // System styles are public-read; only owners can read user styles
  if (style.userId && style.userId !== userId) {
    return { error: "Forbidden", status: 403 as const };
  }
  return { style };
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const r = await loadOwned(id, session.user.id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ style: r.style });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const r = await loadOwned(id, session.user.id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.style.isSystem) {
    return NextResponse.json(
      { error: "System styles are immutable. Clone first." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Whitelist what's settable. Reject anything else.
  const data: Record<string, unknown> = {};
  for (const key of PATCHABLE_FIELDS) {
    if (key in body) data[key] = body[key];
  }
  // referenceTranscripts is set via the dedicated POST route (transcribes
  // a YT URL via DGX). Don't accept inline overwrites here.

  const updated = await prisma.youTubeStyle.update({
    where: { id },
    data,
    include: { characters: true, customArtStyle: true },
  });
  return NextResponse.json({ style: updated });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const r = await loadOwned(id, session.user.id);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  if (r.style.isSystem) {
    return NextResponse.json(
      { error: "System styles cannot be deleted." },
      { status: 403 },
    );
  }
  // Projects with this styleId have their styleId set NULL via onDelete
  // (FK is SetNull). They keep using their legacy stylePreset path.
  await prisma.youTubeStyle.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
