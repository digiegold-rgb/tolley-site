/**
 * POST /api/vater/youtube/[id]/scene/regen
 *
 * Proxies to the DGX `/vater/regen-scene` endpoint, then persists the new
 * scene version into `scenesJson[sceneIdx]` on the Prisma YouTubeProject
 * row. Also flips status to `editing` on first edit and stamps `editedAt`.
 *
 * Request body:
 *   { sceneIdx: number, imagePrompt: string, stylePreset?: string }
 *
 * Never silently catches — AutopilotError propagates as a 502 with the
 * upstream message so the toast in SceneEditorDrawer can show a real cause
 * (see feedback_silent_failures_leads.md).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autopilot, AutopilotError } from "@/lib/vater/autopilot-client";
import type { SceneSpec } from "@/lib/vater/video-spec";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    sceneIdx?: unknown;
    imagePrompt?: unknown;
    stylePreset?: unknown;
    customStylePrompt?: unknown;
    quality?: unknown;
  };

  const qualityOverride =
    typeof body.quality === "string" && body.quality.trim()
      ? body.quality.trim()
      : null;

  const sceneIdx =
    typeof body.sceneIdx === "number" && Number.isFinite(body.sceneIdx)
      ? Math.floor(body.sceneIdx)
      : null;
  const imagePrompt =
    typeof body.imagePrompt === "string" ? body.imagePrompt.trim() : "";

  if (sceneIdx === null || sceneIdx < 0) {
    return NextResponse.json(
      { error: "sceneIdx must be a non-negative integer" },
      { status: 400 },
    );
  }
  if (!imagePrompt) {
    return NextResponse.json(
      { error: "imagePrompt required" },
      { status: 400 },
    );
  }

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      autopilotJobId: true,
      scenesJson: true,
      stylePreset: true,
      customStylePrompt: true,
      styleId: true,
      status: true,
      style: {
        select: { defaultQuality: true },
      },
    },
  });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.autopilotJobId) {
    return NextResponse.json(
      { error: "Project has no autopilot job id — no work dir to regen into" },
      { status: 409 },
    );
  }

  // ── Billing gate (action "scene", 25¢): block BEFORE any DGX work ──
  const budget = await checkBudget(session.user.id, "scene");
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  // ── Rate limit: 10 scene regens per minute per user ──
  const rl = await consumeRateLimit(`vater:scene:${session.user.id}`, 10, 60);
  if (!rl.allowed) return rateLimited(rl);

  // Load character roster so the primary character's identity descriptor is
  // prepended server-side. Without this, regen renders forget the locked
  // identity and the model freestyles gender from context words.
  const charRows = project.styleId
    ? await prisma.youTubeCharacter.findMany({
        where: { styleId: project.styleId },
        select: { name: true, description: true },
      })
    : [];
  // Gender parsed from descriptor opener until the optional `gender` DB
  // column lands. Same parser as in style-snapshot.ts.
  const characters = charRows.map((c) => {
    const head = (c.description || "").slice(0, 200).toLowerCase();
    let gender = "female";
    if (/\bandrogynous\b/.test(head)) gender = "androgynous";
    else if (/\bmale\b/.test(head) && !/\bfemale\b/.test(head)) gender = "male";
    else if (/\bfemale\b/.test(head) || /\b(woman|girl|lady)\b/.test(head))
      gender = "female";
    else if (/\b(man|boy|gentleman)\b/.test(head)) gender = "male";
    return { name: c.name, description: c.description, gender };
  });

  // Call the DGX. Any upstream failure bubbles up as AutopilotError and
  // gets surfaced to the frontend as a 502 below. No silent catch.
  // quality: per-request `quality` override wins; otherwise use what the
  // project's style was generated with, default to firered-local for
  // consistency with original generation.
  const projectQuality =
    qualityOverride ||
    project.style?.defaultQuality ||
    "firered-local";

  let result;
  try {
    result = await autopilot.regenScene({
      jobId: project.autopilotJobId,
      sceneIdx,
      imagePrompt,
      stylePreset:
        (typeof body.stylePreset === "string" ? body.stylePreset : null) ||
        project.stylePreset ||
        "cinematic",
      customStylePrompt:
        typeof body.customStylePrompt === "string"
          ? body.customStylePrompt
          : project.customStylePrompt ?? undefined,
      projectId: project.id,
      characters,
      quality: projectQuality,
    });
  } catch (err) {
    if (err instanceof AutopilotError) {
      return NextResponse.json(
        { error: err.message, endpoint: err.endpoint, upstream: err.status },
        { status: 502 },
      );
    }
    throw err;
  }

  // ── Charge only after confirmed success (failed regens never charge) ──
  // try/catch: the user already has the new image — a billing hiccup must
  // not 500 the response (reconciler can backfill from the error log).
  try {
    await recordUsage({
      userId: session.user.id,
      action: "scene",
      projectId: id,
      idempotencyKey: `scene_regen_${project.autopilotJobId}_${sceneIdx}_v${result.version}`,
    });
  } catch (err) {
    console.error(
      `[vater/scene-regen] recordUsage failed project=${id} sceneIdx=${sceneIdx}`,
      err,
    );
  }

  // Merge the new version into scenesJson[sceneIdx]. Prisma stores the
  // column as Json, so we have to round-trip through an array copy.
  const scenes = Array.isArray(project.scenesJson)
    ? (project.scenesJson as unknown as SceneSpec[])
    : [];
  if (sceneIdx >= scenes.length) {
    return NextResponse.json(
      {
        error: `sceneIdx ${sceneIdx} out of range (have ${scenes.length} scenes)`,
      },
      { status: 400 },
    );
  }
  const existing = scenes[sceneIdx] ?? ({} as SceneSpec);
  const nextScenes: SceneSpec[] = scenes.slice();
  nextScenes[sceneIdx] = {
    ...existing,
    idx: sceneIdx,
    // Rewrite to the browser-safe proxy URL (versioned) instead of storing
    // the DGX /vater/file path, which Remotion can't load without the bearer.
    imageUrl: `/api/vater/youtube/${id}/scene/${sceneIdx}?v=${result.version}`,
    imagePrompt,
    version: result.version,
    overlays: existing.overlays ?? [],
    beatText: existing.beatText ?? "",
    startS: existing.startS ?? 0,
    endS: existing.endS ?? 0,
    // A regen invalidates any prior animation: the old clip was generated
    // from the previous image and no longer matches the new one. Reset the
    // animation state so the editor reverts to the still until the user
    // re-animates.
    mediaType: "image",
    videoUrl: undefined,
    videoVersion: 0,
    animate: false,
  };

  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: {
      scenesJson: nextScenes as unknown as object,
      editedAt: new Date(),
      status: project.status === "ready" ? "editing" : project.status,
    },
    select: {
      id: true,
      status: true,
      editedAt: true,
      scenesJson: true,
    },
  });

  return NextResponse.json({
    ok: true,
    scene: nextScenes[sceneIdx],
    regen: result,
    project: updated,
  });
}
