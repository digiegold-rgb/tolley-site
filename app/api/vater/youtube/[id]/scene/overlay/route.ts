/**
 * POST /api/vater/youtube/[id]/scene/overlay
 *
 * Update Smart Overlay flags on a single scene. Supports:
 *  - { sceneIdx, action: "clear" }                    → revert to image
 *  - { sceneIdx, action: "header", headerData }       → render as title card
 *  - { sceneIdx, action: "chart",  chartData }        → render as chart
 *  - { sceneIdx, action: "map",    mapData }          → render as map
 *
 * Mutually exclusive — setting one clears the others. Validated with the
 * shared video-spec schemas so bad data is rejected before persisting.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  chartDataSchema,
  mapDataSchema,
  headerDataSchema,
} from "@/lib/vater/video-spec";

type Ctx = { params: Promise<{ id: string }> };

interface OverlayBody {
  sceneIdx?: number;
  action?: "clear" | "chart" | "map" | "header";
  chartData?: unknown;
  mapData?: unknown;
  headerData?: unknown;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: OverlayBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.sceneIdx !== "number" || body.sceneIdx < 0) {
    return NextResponse.json({ error: "sceneIdx required" }, { status: 400 });
  }
  if (!body.action || !["clear", "chart", "map", "header"].includes(body.action)) {
    return NextResponse.json(
      { error: "action must be one of: clear | chart | map | header" },
      { status: 400 },
    );
  }

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const scenes = Array.isArray(project.scenesJson)
    ? (project.scenesJson as unknown[])
    : [];
  if (body.sceneIdx >= scenes.length) {
    return NextResponse.json(
      { error: `sceneIdx ${body.sceneIdx} out of bounds (scene count: ${scenes.length})` },
      { status: 400 },
    );
  }

  // Validate overlay data per action. Reject bad data before persisting so a
  // typo'd chart doesn't end up in scenesJson and silently fall back at render.
  let updates: Record<string, unknown> = {
    isChart: false,
    chartData: undefined,
    isMap: false,
    mapData: undefined,
    isHeader: false,
    headerData: undefined,
  };

  if (body.action === "chart") {
    const parsed = chartDataSchema.safeParse(body.chartData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid chartData", issues: parsed.error.issues.slice(0, 5) },
        { status: 400 },
      );
    }
    updates = { ...updates, isChart: true, chartData: parsed.data };
  } else if (body.action === "map") {
    const parsed = mapDataSchema.safeParse(body.mapData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid mapData", issues: parsed.error.issues.slice(0, 5) },
        { status: 400 },
      );
    }
    updates = { ...updates, isMap: true, mapData: parsed.data };
  } else if (body.action === "header") {
    const parsed = headerDataSchema.safeParse(body.headerData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid headerData", issues: parsed.error.issues.slice(0, 5) },
        { status: 400 },
      );
    }
    updates = { ...updates, isHeader: true, headerData: parsed.data };
  }
  // action === "clear" → updates already has all flags false / data undefined

  const currentScene = (scenes[body.sceneIdx] || {}) as Record<string, unknown>;
  const newScene = { ...currentScene, ...updates };
  const newScenes = [...scenes];
  newScenes[body.sceneIdx] = newScene;

  await prisma.youTubeProject.update({
    where: { id },
    data: { scenesJson: newScenes as unknown as object },
  });

  return NextResponse.json({ scene: newScene });
}
