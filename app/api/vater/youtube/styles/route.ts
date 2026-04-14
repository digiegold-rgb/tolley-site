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
    },
    orderBy: [{ isSystem: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ styles });
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
