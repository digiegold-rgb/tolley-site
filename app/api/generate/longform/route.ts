import { NextRequest, NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import { isBlockedStudioRequest } from "@/lib/generate-director";
import { concatMp4sCopy } from "@/lib/generate-ffmpeg";
import { serializeJob } from "@/lib/generate-job-store";
import { readableToBuffer } from "@/lib/generate-media";
import { falPublicLongformStatus, isFalConfigured, spawnFalWan30Motion, spawnInputForLongformCard } from "@/lib/generate-motion";
import { parseGenerateMotionCard } from "@/lib/generate-motion-card";
import { fetchStoredJobImage, persistJobMp4s } from "@/lib/generate-output-persist";
import {
  STITCH_RECIPE,
  approvedLongformJobIds,
  canGenerateLongformBeat,
  canStitchLongform,
  emptyLongformQueue,
  ensureBeatSourceFromPrev,
  estimateLongform,
  markLongformBeatGenerating,
  motionCardFromLongformBeat,
  nextGeneratableLongformBeat,
  parseLongformQueue,
  patchLongformBeat,
  planLongformQueue,
  setLongformBeatStatus,
  type BeatStatus,
  type LongformQueue,
} from "@/lib/generate-longform";
import { latestLongformJob, loadLongformJob, saveLongformQueue } from "@/lib/generate-longform-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

function publicEstimate(queue: LongformQueue) {
  return estimateLongform({
    targetSeconds: queue.target_seconds,
    beatSeconds: queue.beat_seconds,
    script: queue.script,
  });
}

/**
 * GET /api/generate/longform — latest Motion 2 queue for this HQ user.
 */
export async function GET(req: NextRequest) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  const id = req.nextUrl.searchParams.get("id")?.trim() || "";
  const loaded = id ? await loadLongformJob(id) : await latestLongformJob(gate.createdBy);
  if (!loaded) {
    const queue = emptyLongformQueue();
    return NextResponse.json({
      queue,
      job: null,
      estimate: publicEstimate(queue),
      fal: falPublicLongformStatus(),
    });
  }
  return NextResponse.json({
    queue: loaded.queue,
    job: serializeJob(loaded.row),
    estimate: publicEstimate(loaded.queue),
    fal: falPublicLongformStatus(),
  });
}

/**
 * POST /api/generate/longform
 *
 * Actions (never auto-stitch on generate; sequential only — last-frame chain):
 *   save | plan | estimate | generate | generate-next | approve | reject | reset | stitch
 */
export async function POST(req: NextRequest) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  let body: {
    action?: unknown;
    queueId?: unknown;
    queue?: unknown;
    beatId?: unknown;
    patch?: unknown;
    targetSeconds?: unknown;
    beatSeconds?: unknown;
    sourceImageUrl?: unknown;
    script?: unknown;
    fallbackPrompt?: unknown;
    aspect?: unknown;
    endImageUrl?: unknown;
    title?: unknown;
    ripple?: unknown;
    dryRun?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const action = typeof body.action === "string" ? body.action.trim() : "save";
  const queueId = typeof body.queueId === "string" ? body.queueId.trim() : "";

  let loaded = queueId ? await loadLongformJob(queueId) : await latestLongformJob(gate.createdBy);
  let queue: LongformQueue = loaded ? loaded.queue : emptyLongformQueue();
  if (!loaded && body.queue) {
    try {
      queue = parseLongformQueue(body.queue);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Invalid longform queue", 400);
    }
  }

  try {
    if (action === "estimate") {
      const estimate = estimateLongform({
        targetSeconds: body.targetSeconds ?? queue.target_seconds,
        beatSeconds: body.beatSeconds ?? queue.beat_seconds,
        script: typeof body.script === "string" ? body.script : queue.script,
      });
      return NextResponse.json({
        queue,
        job: loaded ? serializeJob(loaded.row) : null,
        estimate,
        fal: falPublicLongformStatus(),
        dryRun: true,
      });
    }

    if (action === "save") {
      if (body.queue) queue = parseLongformQueue(body.queue);
    } else if (action === "plan") {
      const source =
        typeof body.sourceImageUrl === "string" ? body.sourceImageUrl : queue.source_image_url;
      if (!source.trim()) return jsonError("Keep still required to plan beats", 400);
      queue = planLongformQueue({
        targetSeconds: body.targetSeconds ?? queue.target_seconds,
        beatSeconds: body.beatSeconds ?? queue.beat_seconds,
        sourceImageUrl: source,
        script: typeof body.script === "string" ? body.script : queue.script,
        fallbackPrompt: typeof body.fallbackPrompt === "string" ? body.fallbackPrompt : undefined,
        aspect: typeof body.aspect === "string" ? (body.aspect as LongformQueue["aspect"]) : queue.aspect,
        endImageUrl: typeof body.endImageUrl === "string" ? body.endImageUrl : queue.end_image_url,
        title: typeof body.title === "string" ? body.title : queue.title,
      });
    } else if (action === "patch") {
      const patch = (body.patch && typeof body.patch === "object" ? body.patch : {}) as Record<
        string,
        unknown
      >;
      queue = patchLongformBeat(queue, String(body.beatId || ""), patch);
    } else if (action === "generate" || action === "generate-next") {
      let beatId = String(body.beatId || "");
      if (action === "generate-next" && !beatId) {
        const next = nextGeneratableLongformBeat(queue);
        if (!next) return jsonError("No remaining beat is ready to generate", 400);
        beatId = next.id;
      }
      return await generateLongformBeat(gate.createdBy, queue, loaded?.row.id, beatId, {
        ripple: body.ripple === true,
        dryRun: body.dryRun === true,
      });
    } else if (action === "approve" || action === "reject" || action === "reset") {
      const status: BeatStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "draft";
      queue = setLongformBeatStatus(queue, String(body.beatId || ""), status);
    } else if (action === "stitch") {
      return await stitchLongform(gate.createdBy, queue, loaded?.row.id);
    } else {
      return jsonError(`Unknown longform action: ${action}`, 400);
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Longform update failed", 400);
  }

  const saved = await saveLongformQueue({ createdBy: gate.createdBy, queue, id: loaded?.row.id });
  return NextResponse.json({
    queue: saved.queue,
    job: serializeJob(saved.row),
    estimate: publicEstimate(saved.queue),
    fal: falPublicLongformStatus(),
  });
}

async function generateLongformBeat(
  createdBy: string,
  queue: LongformQueue,
  queueJobId: string | undefined,
  beatId: string,
  opts: { ripple: boolean; dryRun: boolean },
) {
  queue = ensureBeatSourceFromPrev(queue, beatId);
  const ready = canGenerateLongformBeat(queue, beatId);
  if (!ready.ok || !ready.beat) return jsonError(ready.reason || "Cannot generate this beat", 400);
  const beat = ready.beat;

  const safety = isBlockedStudioRequest(`${beat.prompt}\n${beat.negative_prompt}`);
  if (safety.blocked) {
    return NextResponse.json({
      reply: safety.reason,
      refused: true,
      queue,
      kind: "longform",
      estimate: publicEstimate(queue),
    });
  }

  let parsed;
  try {
    parsed = motionCardFromLongformBeat(beat);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Beat needs a source still", 400);
  }

  const estimate = publicEstimate(queue);
  if (opts.dryRun) {
    const saved = await saveLongformQueue({ createdBy, queue, id: queueJobId });
    return NextResponse.json({
      dryRun: true,
      kind: "longform",
      queue: saved.queue,
      job: serializeJob(saved.row),
      estimate,
      fal_input: spawnInputForLongformCard(parsed).input,
      note: estimate.note,
    });
  }

  const saved = await saveLongformQueue({ createdBy, queue, id: queueJobId });
  const storedCard = {
    ...parsed,
    queue_id: saved.row.id,
    beat_id: beat.id,
    longform: true,
    kind: "longform",
    ripple: opts.ripple,
    slow_mo: beat.slow_mo,
  };
  const child = await prisma.generateJob.create({
    data: {
      status: "queued",
      recipe: parsed.end_image_url ? "fal-wan-flf2v" : "fal-wan-i2v",
      cardJson: storedCard,
      createdBy,
    },
  });

  const generating = markLongformBeatGenerating(saved.queue, beat.id, child.id);
  await prisma.generateJob.update({
    where: { id: saved.row.id },
    data: { cardJson: generating },
  });

  if (!isFalConfigured()) {
    await prisma.generateJob.update({
      where: { id: child.id },
      data: {
        status: "failed",
        error: "fal.ai is not configured. Set FAL_KEY.",
        completedAt: new Date(),
      },
    });
    const failedQ = patchLongformBeat(generating, beat.id, {
      status: "rejected",
      error: "fal.ai is not configured. Set FAL_KEY.",
    });
    await prisma.generateJob.update({ where: { id: saved.row.id }, data: { cardJson: failedQ } });
    return jsonError("fal.ai is not configured. Set FAL_KEY on Vercel.", 503, {
      queue: failedQ,
      job: serializeJob(saved.row),
      estimate,
    });
  }

  try {
    const spawned = await spawnFalWan30Motion(parseGenerateMotionCard(parsed));
    await prisma.generateJob.update({
      where: { id: child.id },
      data: {
        status: "running",
        recipe: spawned.recipe,
        modalCallId: spawned.callId,
        startedAt: new Date(),
        cardJson: { ...storedCard, fal_model: spawned.falModelId },
      },
    });
    const parent = await prisma.generateJob.findUnique({ where: { id: saved.row.id } });
    return NextResponse.json({
      queue: generating,
      job: parent ? serializeJob(parent) : serializeJob(saved.row),
      child: serializeJob({
        ...child,
        status: "running",
        recipe: spawned.recipe,
        modalCallId: spawned.callId,
        startedAt: new Date(),
      }),
      started: true,
      kind: "longform",
      estimate,
    });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    await prisma.generateJob.update({
      where: { id: child.id },
      data: { status: "failed", error: messageText.slice(0, 2000), completedAt: new Date() },
    });
    const failedQ = patchLongformBeat(generating, beat.id, {
      status: "rejected",
      error: messageText.slice(0, 500),
    });
    await prisma.generateJob.update({ where: { id: saved.row.id }, data: { cardJson: failedQ } });
    return jsonError(messageText, 502, {
      queue: failedQ,
      job: serializeJob(saved.row),
      kind: "longform",
      estimate,
    });
  }
}

async function stitchLongform(createdBy: string, queue: LongformQueue, queueJobId: string | undefined) {
  const gate = canStitchLongform(queue);
  if (!gate.ok) return jsonError(gate.reason || "Approve every beat before stitch", 400);

  const saved = await saveLongformQueue({ createdBy, queue, id: queueJobId });
  const jobIds = approvedLongformJobIds(saved.queue);
  const clips: Buffer[] = [];
  for (const id of jobIds) {
    const row = await prisma.generateJob.findUnique({ where: { id } });
    if (!row || row.status !== "done" || !row.outputUrls[0]) {
      return jsonError(`Approved beat job ${id} has no clip yet`, 400);
    }
    const fetched = await fetchStoredJobImage(row.id, row.outputUrls[0]);
    clips.push(await readableToBuffer(fetched.body));
  }

  const stitchRow = await prisma.generateJob.create({
    data: {
      status: "running",
      recipe: STITCH_RECIPE,
      cardJson: {
        recipe: STITCH_RECIPE,
        queue_id: saved.row.id,
        beat_job_ids: jobIds,
        longform: true,
        stitch_mode: "concat_copy",
      },
      createdBy,
      startedAt: new Date(),
    },
  });

  try {
    const out = await concatMp4sCopy(clips);
    const refs = await persistJobMp4s(stitchRow.id, [out]);
    const done = await prisma.generateJob.update({
      where: { id: stitchRow.id },
      data: {
        status: "done",
        outputUrls: refs.length ? refs : [],
        completedAt: new Date(),
      },
    });
    const nextQueue = { ...saved.queue, stitch_job_id: done.id, stitch_error: "" };
    await prisma.generateJob.update({
      where: { id: saved.row.id },
      data: { cardJson: nextQueue },
    });
    const parent = await prisma.generateJob.findUnique({ where: { id: saved.row.id } });
    return NextResponse.json({
      queue: nextQueue,
      job: parent ? serializeJob(parent) : serializeJob(saved.row),
      stitch: serializeJob(done),
      started: false,
      kind: "longform",
      estimate: publicEstimate(nextQueue),
      stitch_mode: "concat_copy",
    });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    await prisma.generateJob.update({
      where: { id: stitchRow.id },
      data: { status: "failed", error: messageText.slice(0, 2000), completedAt: new Date() },
    });
    const nextQueue = { ...saved.queue, stitch_error: messageText.slice(0, 500) };
    await prisma.generateJob.update({
      where: { id: saved.row.id },
      data: { cardJson: nextQueue },
    });
    return jsonError(messageText, 502, { queue: nextQueue, kind: "longform" });
  }
}
