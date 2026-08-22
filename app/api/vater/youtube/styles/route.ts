/**
 * GET  /api/vater/youtube/styles      — list user-owned + system styles
 * POST /api/vater/youtube/styles      — create empty style for the user
 *
 * Phase 1 surface: enough for the picker UI and for the existing context
 * route to resolve a styleId. Edit/delete routes live at /[id].
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { resolveOwnedLockedStyle } from "@/lib/vater/locked-style";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const styles = await prisma.youTubeStyle.findMany({
    where: {
      OR: [{ userId: session.user.id }, { isSystem: true }],
    },
    include: {
      _count: { select: { characters: true } },
      // The confirm-before-money modal and style-card avatars need to SHOW
      // the cast, not just count it (2026-08-20 walkthrough: modal said
      // "Character: none" on a style that had one). Oldest-first mirrors
      // style-snapshot.ts — characters[0] is the show HOST.
      characters: {
        orderBy: { createdAt: "asc" },
        take: 3,
        select: { id: true, name: true, imageUrl: true },
      },
    },
    orderBy: [{ isSystem: "asc" }, { updatedAt: "desc" }],
  });

  // Which row is CANON (2026-08-22). Every picker used to render N equal
  // cards, so the style carrying the locked Jeff Whitfield host looked exactly
  // like a scratch style — and picking the wrong one silently swapped the host
  // of the show. The client stars it, sorts it first, and warns on anything
  // else. Resolution lives in lib/vater/locked-style.ts so the UI and the
  // render kickoff can never disagree about which row that is.
  let lockedStyleId: string | null = null;
  try {
    const locked = await resolveOwnedLockedStyle(session.user.id, session.user.email);
    lockedStyleId = locked?.id ?? null;
  } catch {
    lockedStyleId = null;
  }

  return NextResponse.json({ styles, lockedStyleId });
}

interface CreateBody {
  name?: string;
  artStylePresetId?: string;
  cloneFromId?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // cloneFromId path — copy a system style or another user-owned style we own
  if (body.cloneFromId) {
    const source = await prisma.youTubeStyle.findUnique({
      where: { id: body.cloneFromId },
      include: { characters: true },
    });
    if (!source) {
      return NextResponse.json(
        { error: "cloneFromId not found" },
        { status: 404 },
      );
    }
    if (source.userId && source.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const clone = await prisma.youTubeStyle.create({
      data: {
        userId: session.user.id,
        name: body.name,
        emoji: source.emoji,
        voice: source.voice,
        voiceBackend: source.voiceBackend,
        voiceSpeed: source.voiceSpeed,
        voiceStability: source.voiceStability,
        voiceSimilarity: source.voiceSimilarity,
        voiceExaggeration: source.voiceExaggeration,
        language: source.language,
        defaultWordCount: source.defaultWordCount,
        scriptMode: source.scriptMode,
        webSearchDefault: source.webSearchDefault,
        additionalContext: source.additionalContext,
        artStylePresetId: source.artStylePresetId,
        customArtStyleId: source.customArtStyleId,
        defaultAspectRatio: source.defaultAspectRatio,
        defaultQuality: source.defaultQuality,
        defaultVisualType: source.defaultVisualType,
        defaultAnimMode: source.defaultAnimMode,
        defaultAnimMin: source.defaultAnimMin,
        defaultAnimMax: source.defaultAnimMax,
        defaultPacingSec: source.defaultPacingSec,
        defaultConsistency: source.defaultConsistency,
        enableCharts: source.enableCharts,
        enableMaps: source.enableMaps,
        enableAutoHeaders: source.enableAutoHeaders,
        overlayTheme: source.overlayTheme,
        isSystem: false,
        clonedFromId: source.id,
        characters: {
          create: source.characters.map((c) => ({
            name: c.name,
            description: c.description,
            briefDescription: c.briefDescription,
            imageUrl: c.imageUrl,
            imageKey: c.imageKey,
            permanent: c.permanent,
            placeInEveryImage: c.placeInEveryImage,
            customArtStyleId: c.customArtStyleId,
          })),
        },
      },
      include: { characters: true },
    });
    return NextResponse.json({ style: clone }, { status: 201 });
  }

  // Empty-style path
  const created = await prisma.youTubeStyle.create({
    data: {
      userId: session.user.id,
      name: body.name,
      artStylePresetId:
        typeof body.artStylePresetId === "string"
          ? body.artStylePresetId
          : "cinematic",
    },
  });
  return NextResponse.json({ style: created }, { status: 201 });
}
