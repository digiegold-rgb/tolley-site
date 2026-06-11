/**
 * POST /api/vater/youtube/[id]/scene/animate
 *
 * Animate ONE scene's still image into an MP4 clip via image-to-video
 * (TubeGen parity — free-form animationPrompt + fixedCamera + quality
 * tiers). Proxies to the DGX `/vater/animate-scene` endpoint, then
 * persists the new animation into `scenesJson[sceneIdx]`:
 *   - sets `mediaType: "video"`, `videoUrl`, `videoVersion`
 *   - records `animate: true`, `animationPrompt`, `fixedCamera`
 *   - writes cost + backend + model for the UI meter
 *
 * Request body:
 *   {
 *     sceneIdx: number,
 *     animationPrompt: string,
 *     fixedCamera?: boolean,
 *     quality?: "turbo" | "default" | "default_1080p" | "high" | "ltx-local",
 *     duration?: number,           // 4-8s, else derived from scene timing
 *     aspectRatio?: "16:9" | "9:16" | "1:1",
 *   }
 *
 * Never silently catches — AutopilotError bubbles up as a 502 so the
 * SceneEditorDrawer toast can show a real cause
 * (per feedback_silent_failures_leads.md).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  autopilot,
  AutopilotError,
  type AnimationQuality,
  type AnimateSceneResult,
} from "@/lib/vater/autopilot-client";
import type { SceneSpec } from "@/lib/vater/video-spec";
import { canAccessProject } from "@/lib/vater/project-access";
import { getAnimationPriceCents } from "@/lib/vater/pricing";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import {
  consumeRateLimit,
  rateLimited,
  releaseLock,
} from "@/lib/rate-limit";

// Animation is long (30-300s for Veo/LTX, up to ~5 min for Kling-Standard
// on a busy queue). The DGX endpoint is async — we kick off a job and poll
// from here until it finishes, so the browser still sees a single
// request/response. maxDuration lets the Vercel function outlive
// the old CF-tunnel 100s cap. Bumped 2026-04-21: Kling-Standard hit 293.8s
// on a real run and 504'd against the previous 290s polling deadline.
export const maxDuration = 800;

type Ctx = { params: Promise<{ id: string }> };

const VALID_QUALITIES = new Set<AnimationQuality>([
  "turbo",
  "default",
  "default_1080p",
  "high",
  "kling-standard",
  "kling-pro",
  "kling-master",
  "luma",
  "ltx-local",
  // Wan2.2 / Modal / EasyAnimate tiers — added 2026-04-21 after a user
  // selection of "EasyAnimate v5 Anime" silently fell through to "default"
  // (Veo) because the whitelist was stale, and Veo's person-generation
  // safety filter then blocked the cartoon face. Any new tier added to
  // AnimationQuality MUST also be added here, else it'll get coerced.
  "wan22-local",
  "modal-wan22",
  "modal-wan22-fast",
  "modal-wan22-narrative",
  "modal-wan22-narrative-fast",
  "modal-hunyuan-narrative",
  "modal-hunyuan-narrative-fast",
  "modal-easyanimate-anime",
]);

const VALID_ASPECTS = new Set(["16:9", "9:16", "1:1"]);

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    sceneIdx?: unknown;
    animationPrompt?: unknown;
    fixedCamera?: unknown;
    quality?: unknown;
    duration?: unknown;
    aspectRatio?: unknown;
    motionIntensity?: unknown;
    holdStartPose?: unknown;
  };

  const sceneIdx =
    typeof body.sceneIdx === "number" && Number.isFinite(body.sceneIdx)
      ? Math.floor(body.sceneIdx)
      : null;
  const animationPrompt =
    typeof body.animationPrompt === "string" ? body.animationPrompt.trim() : "";
  const fixedCamera = body.fixedCamera === true;
  // Fail loud on invalid quality rather than silent-falling-back to "default"
  // (which is Veo and blocks cartoons). If we ever get here with a tier not
  // in VALID_QUALITIES, it means the frontend dropdown drifted from this
  // whitelist — surface it so we can fix it instead of burning a Veo call.
  if (
    body.quality !== undefined &&
    !(typeof body.quality === "string" &&
      VALID_QUALITIES.has(body.quality as AnimationQuality))
  ) {
    return NextResponse.json(
      {
        error: `Unknown quality "${String(body.quality)}". Valid: ${Array.from(VALID_QUALITIES).join(", ")}`,
      },
      { status: 400 },
    );
  }
  const quality: AnimationQuality =
    typeof body.quality === "string"
      ? (body.quality as AnimationQuality)
      : "modal-wan22"; // cartoon-safe default; was "default" which is Veo

  const duration =
    typeof body.duration === "number" && Number.isFinite(body.duration)
      ? Math.floor(body.duration)
      : undefined;
  const aspectRatio: "16:9" | "9:16" | "1:1" =
    typeof body.aspectRatio === "string" && VALID_ASPECTS.has(body.aspectRatio)
      ? (body.aspectRatio as "16:9" | "9:16" | "1:1")
      : "16:9";

  // Motion dampening controls. When omitted, DGX falls back to "normal" +
  // no-hold (current behaviour preserved for back-compat). Unknown values
  // for motionIntensity are silently coerced to "normal" on the DGX side.
  const motionIntensity: "subtle" | "normal" | "bold" | undefined =
    body.motionIntensity === "subtle" ||
    body.motionIntensity === "normal" ||
    body.motionIntensity === "bold"
      ? body.motionIntensity
      : undefined;
  const holdStartPose =
    body.holdStartPose === true ? true : body.holdStartPose === false ? false : undefined;

  if (sceneIdx === null || sceneIdx < 0) {
    return NextResponse.json(
      { error: "sceneIdx must be a non-negative integer" },
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
      status: true,
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
      {
        error:
          "Project has no autopilot job id — can't animate without a work dir",
      },
      { status: 409 },
    );
  }

  // Grab scene timing from scenesJson so the DGX can clamp duration to
  // max(4, min(8, ceil(endS-startS))) — matching TubeGen exactly.
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

  // ── Billing gate (pay-per-video): block BEFORE any DGX work ──
  const priceCents = getAnimationPriceCents(quality);
  const budget = await checkBudget(
    session.user.id,
    "animation",
    quality,
    priceCents,
  );
  if (!budget.allow) {
    return NextResponse.json(
      { error: "Billing check failed", budget },
      { status: 402 },
    );
  }

  // ── Rate limit + per-scene lock ──
  const rl = await consumeRateLimit(`vater:anim:${session.user.id}`, 6, 60);
  if (!rl.allowed) return rateLimited(rl);

  // Mutex: two parallel animates on the same sceneIdx collide on version
  // slots (slower run overwrites faster). 900s max hold covers the 780s poll.
  const lockKey = `lock:anim:${id}:${sceneIdx}`;
  const lock = await consumeRateLimit(lockKey, 1, 900);
  if (!lock.allowed) {
    return NextResponse.json(
      { error: `Scene ${sceneIdx} already has an animation running` },
      { status: 409 },
    );
  }

  let result: AnimateSceneResult;
  let animateJobIdForBilling = "";
  try {
    try {
      const { animateJobId } = await autopilot.animateScene({
        jobId: project.autopilotJobId,
        sceneIdx,
        animationPrompt,
        fixedCamera,
        quality,
        duration,
        sceneStartS:
          typeof existing.startS === "number" ? existing.startS : undefined,
        sceneEndS: typeof existing.endS === "number" ? existing.endS : undefined,
        aspectRatio,
        imagePrompt:
          typeof existing.imagePrompt === "string"
            ? existing.imagePrompt
            : undefined,
        motionIntensity,
        holdStartPose,
      });
      animateJobIdForBilling = animateJobId;

      // Poll the DGX job until the animator worker finishes. Each poll is
      // fast (<1s), so we never exceed CF's 100s request cap — only the
      // Vercel function's maxDuration (800s) bounds total wall time.
      const deadline = Date.now() + 780_000;
      let pollMs = 2500;
      while (true) {
        if (Date.now() > deadline) {
          // NOTE: no usage recorded on timeout — the job may still finish on
          // DGX, but we never charge for work the user didn't get back.
          return NextResponse.json(
            {
              error:
                "animate-scene timed out — job still running on DGX. " +
                `Check /vater/jobs/${animateJobId} for final state.`,
              animateJobId,
            },
            { status: 504 },
          );
        }
        await new Promise((r) => setTimeout(r, pollMs));
        pollMs = Math.min(pollMs + 500, 5000);
        const job = await autopilot.getJob(animateJobId);
        if (job.status === "failed") {
          const raw = (job as unknown as { errorStatus?: unknown }).errorStatus;
          const status = typeof raw === "number" ? raw : 502;
          return NextResponse.json(
            {
              error: job.error || "animation failed",
              animateJobId,
            },
            { status },
          );
        }
        if (job.status === "done" && job.result) {
          result = job.result as AnimateSceneResult;
          break;
        }
      }
    } catch (err) {
      if (err instanceof AutopilotError) {
        return NextResponse.json(
          { error: err.message, endpoint: err.endpoint, upstream: err.status },
          { status: 502 },
        );
      }
      throw err;
    }

    // ── Charge only after confirmed success (failed renders never charge) ──
    await recordUsage({
      userId: session.user.id,
      action: "animation",
      tier: quality,
      projectId: id,
      idempotencyKey: `anim_${id}_${sceneIdx}_${animateJobIdForBilling}`,
      overrideCostCents: priceCents,
    });

    // Re-fetch scenesJson before writing: the poll above can run for many
    // minutes, and writing the stale array we read at request start would
    // clobber every concurrent edit to OTHER scenes. Merge only [sceneIdx].
    const fresh = await prisma.youTubeProject.findUnique({
      where: { id },
      select: { scenesJson: true, status: true },
    });
    const freshScenes: SceneSpec[] = Array.isArray(fresh?.scenesJson)
      ? (fresh.scenesJson as unknown as SceneSpec[]).slice()
      : scenes.slice();
    const freshExisting = freshScenes[sceneIdx] ?? existing;

    const nextScenes = freshScenes;
    nextScenes[sceneIdx] = {
      ...freshExisting,
      idx: sceneIdx,
      mediaType: "video",
      videoUrl: result.url,
      videoVersion: result.version,
      animate: true,
      // Use the values the DGX actually animated with — may be planner-
      // auto-filled when the UI submitted an empty prompt.
      animationPrompt: result.animationPrompt || animationPrompt,
      fixedCamera: result.fixedCamera,
      animQuality: result.quality as AnimationQuality,
      animCost: result.cost,
      animBackend: result.backend,
      animModel: result.model,
      animDurationSeconds: result.durationSeconds,
      motionIntensity:
        result.motionIntensity ?? motionIntensity ?? freshExisting.motionIntensity ?? "normal",
      holdStartPose:
        result.holdStartPose ?? holdStartPose ?? freshExisting.holdStartPose ?? false,
      overlays: freshExisting.overlays ?? [],
      beatText: freshExisting.beatText ?? "",
      startS: freshExisting.startS ?? 0,
      endS: freshExisting.endS ?? 0,
      imageUrl: freshExisting.imageUrl ?? "",
    };

    const currentStatus = fresh?.status ?? project.status;
    const updated = await prisma.youTubeProject.update({
      where: { id },
      data: {
        scenesJson: nextScenes as unknown as object,
        editedAt: new Date(),
        status: currentStatus === "ready" ? "editing" : currentStatus,
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
      animate: result,
      project: updated,
      billing: { chargedCents: priceCents, isTrial: budget.isTrial },
    });
  } finally {
    await releaseLock(lockKey);
  }
}
