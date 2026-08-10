/**
 * Apply a finished DGX run-creation job to its YouTubeProject row the way
 * /poll does (status/artifacts/costs + idempotent owner billing). For jobs
 * that completed while nobody had the portal open — the poll route only
 * fires from the browser.
 *
 * Usage: npx tsx --env-file=.env scripts/tmp-vater-apply-job.ts <projectId> <jobId>
 */
import { prisma } from "@/lib/prisma";
import { autopilot } from "@/lib/vater/autopilot-client";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { FLAT_ACTION_PRICES } from "@/lib/vater/pricing";
import { mergeVideoCost } from "@/lib/vater/video-cost";
import type { Prisma } from "@prisma/client";

const [projectId, jobId] = process.argv.slice(2);
if (!projectId || !jobId) {
  console.error("usage: tmp-vater-apply-job.ts <projectId> <jobId>");
  process.exit(1);
}

async function main() {
  const project = await prisma.youTubeProject.findUniqueOrThrow({
    where: { id: projectId },
  });
  const job = (await autopilot.getJob(jobId)) as unknown as {
    status: string;
    result?: Record<string, unknown> | null;
  };
  if (job.status !== "done") throw new Error(`job is ${job.status}, not done`);
  const r = (job.result ?? {}) as Record<string, unknown>;

  const data: Prisma.YouTubeProjectUpdateInput = {
    status: "ready",
    progress: 100,
    completedAt: new Date(),
    errorMessage: null,
    autopilotJobId: jobId,
  };
  if (typeof r.verifiedScript === "boolean") data.verifiedScript = r.verifiedScript;
  if (r.script && !project.scriptApprovedAt) data.script = r.script as string;
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
      const m = audioCandidate.match(
        /\/([0-9a-fA-F]+)\/(?:final\.wav|audio\.wav|tts\.wav)$/,
      );
      data.audioUrl = audioCandidate.startsWith("/vater/file/")
        ? audioCandidate
        : m
          ? `/vater/file/${m[1]}/audio`
          : `/vater/file/${jobId}/audio`;
    }
  }
  if (typeof r.audioDuration === "number") data.audioDuration = r.audioDuration;
  const caps = r.captionTimings ?? r.captions;
  if (caps !== undefined) data.captionTimings = caps as Prisma.InputJsonValue;
  const scenes = Array.isArray(r.scenes)
    ? (r.scenes as Array<Record<string, unknown>>)
    : [];
  if (scenes.length > 0) {
    data.scenesJson = scenes.map((s, i) => {
      const idx = typeof s.idx === "number" ? (s.idx as number) : i;
      return {
        idx,
        imageUrl: `/api/vater/youtube/${projectId}/scene/${idx}`,
        startS: (s.startS as number) ?? 0,
        endS: (s.endS as number) ?? 0,
        beatText: (s.beatText as string) ?? "",
        imagePrompt: (s.prompt as string) ?? "",
        version: 0,
        overlays: Array.isArray(s.overlays) ? s.overlays : [],
        isChart: s.isChart === true,
        isMap: s.isMap === true,
        isHeader: s.isHeader === true,
        ...(s.videoPath || s.mediaType === "video" ? { mediaType: "video" } : {}),
      };
    }) as Prisma.InputJsonValue;
  }
  {
    const finalPath = (r.finalVideoUrl as string) || (r.finalVideoPath as string);
    if (!finalPath) throw new Error("done job has no final video");
    if (finalPath.startsWith("https://") || finalPath.startsWith("/vater/file/")) {
      data.finalVideoUrl = finalPath;
    } else {
      const m = finalPath.match(/\/([0-9a-fA-F]+)\/final\.mp4$/);
      data.finalVideoUrl = m
        ? `/vater/file/${m[1]}/video`
        : `/vater/file/${jobId}/video`;
    }
  }
  await prisma.youTubeProject.update({ where: { id: projectId }, data });

  if (project.userId) {
    const userSuppliedScript =
      typeof project.scriptMeta === "object" &&
      project.scriptMeta !== null &&
      (project.scriptMeta as { source?: unknown }).source === "user-supplied";
    if (r.script && !userSuppliedScript) {
      await recordUsage({
        userId: project.userId,
        action: "script",
        projectId,
        idempotencyKey: `script_${jobId}`,
        overrideCostCents: FLAT_ACTION_PRICES.script.priceCents,
      }).catch((e) => console.error("script charge failed:", e));
    }
    if (data.audioUrl) {
      const audioS = typeof r.audioDuration === "number" ? (r.audioDuration as number) : null;
      const minutes = audioS ? Math.max(1, Math.ceil(audioS / 60)) : 1;
      await recordUsage({
        userId: project.userId,
        action: "voiceover",
        projectId,
        idempotencyKey: `voiceover_${jobId}`,
        overrideCostCents: minutes * FLAT_ACTION_PRICES.voiceover.priceCents,
      }).catch((e) => console.error("voiceover charge failed:", e));
    }
    if (scenes.length > 0) {
      await recordUsage({
        userId: project.userId,
        action: "scene",
        projectId,
        idempotencyKey: `scenes_${jobId}`,
        overrideCostCents: scenes.length * FLAT_ACTION_PRICES.scene.priceCents,
      }).catch((e) => console.error("scene charge failed:", e));
    }
  }

  console.log(
    `APPLIED — project=${projectId} status=ready final=${String(data.finalVideoUrl).slice(0, 90)} scenes=${scenes.length}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("APPLY FAILED:", e);
  process.exit(1);
});
