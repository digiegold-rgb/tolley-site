/**
 * Headless RE-RENDER for the wealth-in-30s project (2026-08-09).
 *
 * The first approved render (job fc99cf570bcf4e4b) shipped 0 animated
 * scenes: the site's style snapshot never carries `animQuality`, vater.py's
 * fallback was the Veo tier, and Veo (Gemini) billing is blocked — so all
 * 25 selected scenes failed to animate and fell back to Ken Burns stills.
 * vater.py now defaults to modal-wan22; this script re-fires the approved
 * script through the same gate path (startRunCreation + scriptOverride) and
 * applies the finished job to the row the way /poll does, with the same
 * idempotent billing keys.
 *
 * Usage: npx tsx --env-file=.env scripts/tmp-vater-rekick-render-V0STBtC3eOU.ts
 */
import { prisma } from "@/lib/prisma";
import { autopilot } from "@/lib/vater/autopilot-client";
import { startRunCreation } from "@/lib/vater/script-gate";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { FLAT_ACTION_PRICES } from "@/lib/vater/pricing";
import { mergeVideoCost } from "@/lib/vater/video-cost";
import type { Prisma } from "@prisma/client";

const PROJECT_ID = "cmslxrqcq0001l4mi9labp07f";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AnyJob = {
  status: string;
  phase?: string;
  progress?: number;
  result?: Record<string, unknown> | null;
};

async function waitForJob(jobId: string, timeoutMs: number): Promise<AnyJob> {
  const t0 = Date.now();
  let lastPhase = "";
  while (Date.now() - t0 < timeoutMs) {
    const job = (await autopilot.getJob(jobId)) as unknown as AnyJob;
    const phase = job.phase ?? "";
    if (phase !== lastPhase) {
      console.log(`[render] phase=${phase} progress=${job.progress ?? "?"}`);
      lastPhase = phase;
    }
    if (job.status === "done" || job.status === "failed") return job;
    await sleep(15_000);
  }
  throw new Error(`render: timed out after ${timeoutMs / 1000}s`);
}

async function main() {
  const project = await prisma.youTubeProject.findUniqueOrThrow({
    where: { id: PROJECT_ID },
  });
  const script = (project.script ?? "").trim();
  if (!script) throw new Error("project has no approved script");
  if (!project.scriptApprovedAt) throw new Error("script not approved");
  console.log(
    `re-kicking render: ${script.split(/\s+/).length} words, animUntilS=${project.animUntilS}`,
  );

  const jobId = await startRunCreation(project, { scriptOverride: script });
  await prisma.youTubeProject.update({
    where: { id: PROJECT_ID },
    data: { autopilotJobId: jobId, status: "scripted", progress: 30, errorMessage: null },
  });
  console.log("run-creation job:", jobId);

  const done = await waitForJob(jobId, 4 * 60 * 60 * 1000);
  if (done.status === "failed") {
    const err = JSON.stringify(done.result ?? {}).slice(0, 800);
    await prisma.youTubeProject.update({
      where: { id: PROJECT_ID },
      data: { status: "failed", errorMessage: `render failed: ${err}`.slice(0, 1000) },
    });
    throw new Error(`render FAILED: ${err}`);
  }
  const r = (done.result ?? {}) as Record<string, unknown>;

  // ── Animation sanity check — the whole reason for this re-run ──────────
  const scenes = Array.isArray(r.scenes)
    ? (r.scenes as Array<Record<string, unknown>>)
    : [];
  const animated = scenes.filter((s) => s.videoPath || s.mediaType === "video");
  console.log(
    `scenes: ${scenes.length} total, ${animated.length} animated (mode=${r.animationModeUsed}, animCost=$${r.animationTotalCost ?? 0})`,
  );
  if (animated.length === 0) {
    console.error(
      "WARNING: still 0 animated scenes — backend routing fix did not take. Applying result anyway; investigate before shipping.",
    );
  }

  // ── Apply the done job to the row exactly like /poll's done branch ─────
  const data: Prisma.YouTubeProjectUpdateInput = {
    status: "ready",
    progress: 100,
    completedAt: new Date(),
    errorMessage: null,
  };
  if (typeof r.verifiedScript === "boolean") data.verifiedScript = r.verifiedScript;
  {
    const costs = r.costs;
    if (costs && typeof costs === "object") {
      const merged = mergeVideoCost(project.costJson, costs, jobId);
      if (merged) data.costJson = merged as Prisma.InputJsonValue;
    }
  }
  {
    const audioCandidate = (r.audioUrl as string) || (r.audioPath as string);
    if (audioCandidate) {
      if (audioCandidate.startsWith("/vater/file/")) {
        data.audioUrl = audioCandidate;
      } else {
        const m = audioCandidate.match(
          /\/([0-9a-fA-F]+)\/(?:final\.wav|audio\.wav|tts\.wav)$/,
        );
        data.audioUrl = m ? `/vater/file/${m[1]}/audio` : `/vater/file/${jobId}/audio`;
      }
    }
  }
  if (typeof r.audioDuration === "number") data.audioDuration = r.audioDuration;
  const caps = r.captionTimings ?? r.captions;
  if (caps !== undefined) data.captionTimings = caps as Prisma.InputJsonValue;
  let generatedSceneCount = 0;
  if (scenes.length > 0) {
    generatedSceneCount = scenes.length;
    data.scenesJson = scenes.map((s, i) => {
      const idx = typeof s.idx === "number" ? (s.idx as number) : i;
      return {
        idx,
        imageUrl: `/api/vater/youtube/${PROJECT_ID}/scene/${idx}`,
        startS: (s.startS as number) ?? 0,
        endS: (s.endS as number) ?? 0,
        beatText: (s.beatText as string) ?? "",
        imagePrompt: (s.prompt as string) ?? "",
        version: 0,
        overlays: Array.isArray(s.overlays) ? s.overlays : [],
        isChart: s.isChart === true,
        chartData: s.chartData ?? undefined,
        isMap: s.isMap === true,
        mapData: s.mapData ?? undefined,
        isHeader: s.isHeader === true,
        headerData: s.headerData ?? undefined,
        ...(s.videoPath || s.mediaType === "video"
          ? { mediaType: "video" }
          : {}),
      };
    }) as Prisma.InputJsonValue;
  }
  {
    const finalPath = (r.finalVideoUrl as string) || (r.finalVideoPath as string);
    if (finalPath) {
      if (finalPath.startsWith("https://")) {
        data.finalVideoUrl = finalPath;
      } else if (finalPath.startsWith("/vater/file/")) {
        data.finalVideoUrl = finalPath;
      } else {
        const m = finalPath.match(/\/([0-9a-fA-F]+)\/final\.mp4$/);
        data.finalVideoUrl = m
          ? `/vater/file/${m[1]}/video`
          : `/vater/file/${jobId}/video`;
      }
    } else {
      console.error("WARNING: done job has no final video path");
      data.status = "failed";
      data.errorMessage = "render done but no final video in result";
    }
  }
  await prisma.youTubeProject.update({ where: { id: PROJECT_ID }, data });

  // ── Idempotent owner billing, same keys as /poll ───────────────────────
  // Script: skipped — user-supplied (scriptMeta.source stamped by approve).
  if (project.userId) {
    if (data.audioUrl) {
      const audioS = typeof r.audioDuration === "number" ? (r.audioDuration as number) : null;
      const minutes = audioS ? Math.max(1, Math.ceil(audioS / 60)) : 1;
      await recordUsage({
        userId: project.userId,
        action: "voiceover",
        projectId: PROJECT_ID,
        idempotencyKey: `voiceover_${jobId}`,
        overrideCostCents: minutes * FLAT_ACTION_PRICES.voiceover.priceCents,
      }).catch((e) => console.error("voiceover charge failed:", e));
    }
    if (generatedSceneCount > 0) {
      await recordUsage({
        userId: project.userId,
        action: "scene",
        projectId: PROJECT_ID,
        idempotencyKey: `scenes_${jobId}`,
        overrideCostCents:
          generatedSceneCount * FLAT_ACTION_PRICES.scene.priceCents,
      }).catch((e) => console.error("scene charge failed:", e));
    }
  }

  console.log(
    `DONE — finalVideoUrl=${data.finalVideoUrl ?? "(none)"} animated=${animated.length}/${scenes.length} costs=${JSON.stringify((r.costs as Record<string, unknown>)?.totalUsd ?? r.costs ?? {}).slice(0, 200)}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("REKICK FAILED:", e);
  process.exit(1);
});
