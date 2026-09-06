import { NextRequest, NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import { isBlockedStudioRequest } from "@/lib/generate-director";
import { concatMp4sCopy } from "@/lib/generate-ffmpeg";
import { serializeJob } from "@/lib/generate-job-store";
import { readableToBuffer } from "@/lib/generate-media";
import { cinemaSpawnInput, falPublicCinemaStatus } from "@/lib/generate-cinema-card";
import { spawnCinemaBeat } from "@/lib/generate-cinema-fal";
import { fetchStoredJobImage, persistJobMp4s } from "@/lib/generate-output-persist";
import {
  STITCH_RECIPE,
  approvedCinemaJobIds,
  canGenerateCinemaBeat,
  canStitchCinema,
  cinemaAlreadyRunningReason,
  cinemaParentJobStatus,
  emptyCinemaQueue,
  estimateCinema,
  isInFlightJobStatus,
  loadEstateProofTemplate,
  markCinemaBeatGenerating,
  nextGeneratableCinemaBeat,
  parseCinemaQueue,
  patchCinemaBeat,
  planCinemaQueue,
  type BeatStatus,
  type CinemaQueue,
} from "@/lib/generate-cinema";
import { reconcileCinemaParent } from "@/lib/generate-cinema-advance";
import { cardBeatId, latestCinemaJob, loadCinemaJob, saveCinemaQueue } from "@/lib/generate-cinema-store";
import { isFalConfigured } from "@/lib/generate-motion-card";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

function publicEstimate(queue: CinemaQueue) {
  return estimateCinema(queue);
}

/**
 * GET /api/generate/cinema — bound Cinema queue, or latest among operator aliases.
 */
export async function GET(req: NextRequest) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  const id =
    req.nextUrl.searchParams.get("id")?.trim() ||
    req.nextUrl.searchParams.get("cinema")?.trim() ||
    req.nextUrl.searchParams.get("queue_id")?.trim() ||
    "";
  const loaded = id ? await loadCinemaJob(id) : await latestCinemaJob(gate.createdBy);
  if (!loaded) {
    const queue = emptyCinemaQueue();
    return NextResponse.json({
      queue,
      job: null,
      children: [],
      estimate: publicEstimate(queue),
      fal: falPublicCinemaStatus(),
    });
  }
  const reconciled = await reconcileCinemaParent(loaded);
  const parent = (await loadCinemaJob(reconciled.row.id)) || loaded;
  const childIds = parent.queue.beats.map((b) => b.job_id).filter(Boolean);
  const children = childIds.length
    ? (await prisma.generateJob.findMany({ where: { id: { in: childIds } } })).map(serializeJob)
    : [];
  return NextResponse.json({
    queue: parent.queue,
    job: serializeJob(parent.row),
    children,
    estimate: publicEstimate(parent.queue),
    fal: falPublicCinemaStatus(),
  });
}

/**
 * POST /api/generate/cinema
 * Actions: save | plan | estimate | load-estate | generate | generate-next | run-remaining
 *          | approve | reject | reset | stitch
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
    script?: unknown;
    shotlist?: unknown;
    imageUrls?: unknown;
    audioUrl?: unknown;
    priorVideoUrl?: unknown;
    model?: unknown;
    generateAudio?: unknown;
    passPrevVideo?: unknown;
    title?: unknown;
    dryRun?: unknown;
    retry?: unknown;
    confirmSpend?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const action = typeof body.action === "string" ? body.action.trim() : "save";
  const queueId = typeof body.queueId === "string" ? body.queueId.trim() : "";

  let loaded = queueId ? await loadCinemaJob(queueId) : null;
  let queue: CinemaQueue = loaded ? loaded.queue : emptyCinemaQueue();
  if (!loaded && body.queue) {
    try {
      queue = parseCinemaQueue(body.queue);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Invalid cinema queue", 400);
    }
  }

  try {
    if (action === "estimate") {
      if (body.queue) queue = parseCinemaQueue(body.queue);
      return NextResponse.json({
        queue,
        job: loaded ? serializeJob(loaded.row) : null,
        estimate: publicEstimate(queue),
        fal: falPublicCinemaStatus(),
        dryRun: true,
      });
    }

    if (action === "load-estate") {
      queue = loadEstateProofTemplate({
        imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.map(String) : queue.image_urls,
        audioUrl: typeof body.audioUrl === "string" ? body.audioUrl : queue.audio_url,
        priorVideoUrl: typeof body.priorVideoUrl === "string" ? body.priorVideoUrl : queue.prior_video_url,
      });
    } else if (action === "save") {
      if (body.queue) queue = parseCinemaQueue(body.queue);
    } else if (action === "plan") {
      queue = planCinemaQueue({
        script: typeof body.script === "string" ? body.script : queue.script,
        shotlist: body.shotlist,
        imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.map(String) : queue.image_urls,
        audioUrl: typeof body.audioUrl === "string" ? body.audioUrl : queue.audio_url,
        priorVideoUrl: typeof body.priorVideoUrl === "string" ? body.priorVideoUrl : queue.prior_video_url,
        model: body.model === "kling" ? "kling" : queue.model,
        generateAudio: body.generateAudio !== false,
        passPrevVideo: body.passPrevVideo !== false,
        title: typeof body.title === "string" ? body.title : queue.title,
      });
    } else if (action === "patch") {
      const patch = (body.patch && typeof body.patch === "object" ? body.patch : {}) as Record<
        string,
        unknown
      >;
      queue = patchCinemaBeat(queue, String(body.beatId || ""), patch);
    } else if (action === "generate" || action === "generate-next" || action === "run-remaining") {
      if (loaded) queue = loaded.queue;
      else if (body.queue) {
        try {
          queue = parseCinemaQueue(body.queue);
        } catch (err) {
          return jsonError(err instanceof Error ? err.message : "Invalid cinema queue", 400);
        }
      }
      let beatId = String(body.beatId || "");
      if ((action === "generate-next" || action === "run-remaining") && !beatId) {
        const generating = queue.beats.find((b) => b.status === "generating");
        if (generating) beatId = generating.id;
        else {
          const next = nextGeneratableCinemaBeat(queue);
          if (!next) {
            const hold = queue.beats.find((b) => b.status === "rejected" && b.error.trim());
            return jsonError(
              hold
                ? "Dismiss or retry the failed beat first"
                : "No remaining beat is ready to generate",
              400,
            );
          }
          beatId = next.id;
        }
      }
      return await generateCinemaBeat(gate.createdBy, queue, loaded?.row.id, beatId, {
        dryRun: body.dryRun === true,
        retry: body.retry === true,
        confirmSpend: body.confirmSpend === true,
      });
    } else if (action === "approve" || action === "reject" || action === "reset") {
      const status: BeatStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "draft";
      const idx = queue.beats.findIndex((b) => b.id === String(body.beatId || ""));
      if (idx < 0) return jsonError("Cinema beat not found", 400);
      queue = patchCinemaBeat(queue, queue.beats[idx].id, {
        status,
        error: status === "rejected" ? queue.beats[idx].error : "",
      });
    } else if (action === "stitch") {
      return await stitchCinema(gate.createdBy, queue, loaded?.row.id);
    } else {
      return jsonError(`Unknown cinema action: ${action}`, 400);
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Cinema update failed", 400);
  }

  const saved = await saveCinemaQueue({ createdBy: gate.createdBy, queue, id: loaded?.row.id });
  return NextResponse.json({
    queue: saved.queue,
    job: serializeJob(saved.row),
    estimate: publicEstimate(saved.queue),
    fal: falPublicCinemaStatus(),
  });
}

async function existingInFlightChild(
  createdBy: string,
  queue: CinemaQueue,
  queueJobId: string | undefined,
  beatId: string,
) {
  const beat = queue.beats.find((b) => b.id === beatId);
  if (beat?.job_id) {
    const child = await prisma.generateJob.findUnique({ where: { id: beat.job_id } });
    if (child && isInFlightJobStatus(child.status)) return child;
  }
  if (!queueJobId) return null;
  const recent = await prisma.generateJob.findMany({
    where: {
      createdBy,
      status: { in: ["queued", "running"] },
      recipe: { in: ["fal-seedance-ref", "fal-kling-elements"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return (
    recent.find((row) => {
      const rec =
        row.cardJson && typeof row.cardJson === "object" && !Array.isArray(row.cardJson)
          ? (row.cardJson as Record<string, unknown>)
          : {};
      return rec.queue_id === queueJobId && rec.beat_id === beatId;
    }) || null
  );
}

async function generateCinemaBeat(
  createdBy: string,
  queue: CinemaQueue,
  queueJobId: string | undefined,
  beatId: string,
  opts: { dryRun: boolean; retry: boolean; confirmSpend: boolean },
) {
  const liveChild =
    (await existingInFlightChild(createdBy, queue, queueJobId, beatId)) ||
    (await (async () => {
      const other = queue.beats.find((b) => b.id !== beatId && b.status === "generating" && b.job_id);
      if (!other?.job_id) return null;
      const row = await prisma.generateJob.findUnique({ where: { id: other.job_id } });
      return row && isInFlightJobStatus(row.status) ? row : null;
    })());
  if (liveChild) {
    const bindId =
      cardBeatId(liveChild.cardJson) ||
      queue.beats.find((b) => b.job_id === liveChild.id)?.id ||
      beatId;
    const generating = markCinemaBeatGenerating(queue, bindId, liveChild.id);
    const saved = await saveCinemaQueue({ createdBy, queue: generating, id: queueJobId });
    return NextResponse.json({
      already_running: true,
      note: cinemaAlreadyRunningReason(generating, bindId, liveChild) || "Beat is already generating",
      kind: "cinema",
      queue: saved.queue,
      job: serializeJob(saved.row),
      child: serializeJob(liveChild),
      estimate: publicEstimate(saved.queue),
    });
  }
  const ready = canGenerateCinemaBeat(queue, beatId, null, { retry: opts.retry });
  if (!ready.ok || !ready.beat) return jsonError(ready.reason || "Cannot generate this beat", 400);
  const beat = ready.beat;

  const safety = isBlockedStudioRequest(beat.prompt);
  if (safety.blocked) {
    return jsonError(safety.reason || "Request refused", 400, {
      refused: true,
      reply: safety.reason,
      queue,
      kind: "cinema",
      estimate: publicEstimate(queue),
    });
  }

  const estimate = publicEstimate(queue);
  if (!opts.dryRun && estimate.needs_confirm && !opts.confirmSpend) {
    return jsonError(
      `About $${estimate.usd.toFixed(2)} for ${estimate.fal_calls} remaining Cinema beat(s) ` +
        `(${estimate.planned_seconds}s). Continue?`,
      402,
      { needs_confirm: true, estimate, queue, kind: "cinema" },
    );
  }

  const planned = cinemaSpawnInput(queue, beat);
  if (opts.dryRun) {
    const saved = await saveCinemaQueue({ createdBy, queue, id: queueJobId });
    return NextResponse.json({
      dryRun: true,
      kind: "cinema",
      queue: saved.queue,
      job: serializeJob(saved.row),
      estimate,
      fal_input: planned.input,
      note: estimate.note,
    });
  }

  const saved = await saveCinemaQueue({ createdBy, queue, id: queueJobId });
  const storedCard = {
    ...planned.input,
    queue_id: saved.row.id,
    beat_id: beat.id,
    cinema: true,
    kind: "cinema",
    fal_model: planned.falModelId,
    model: planned.model,
  };
  const child = await prisma.generateJob.create({
    data: {
      status: "queued",
      recipe: planned.recipe,
      cardJson: storedCard,
      createdBy,
    },
  });

  const generating = markCinemaBeatGenerating(saved.queue, beat.id, child.id);
  await prisma.generateJob.update({
    where: { id: saved.row.id },
    data: {
      cardJson: generating,
      status: cinemaParentJobStatus(generating),
      startedAt: saved.row.startedAt || new Date(),
    },
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
    const failedQ = patchCinemaBeat(generating, beat.id, {
      status: "rejected",
      error: "fal.ai is not configured. Set FAL_KEY.",
    });
    await prisma.generateJob.update({
      where: { id: saved.row.id },
      data: { cardJson: failedQ, status: cinemaParentJobStatus(failedQ) },
    });
    return jsonError("fal.ai is not configured. Set FAL_KEY on Vercel.", 503, {
      queue: failedQ,
      job: serializeJob(saved.row),
      estimate,
    });
  }

  try {
    const spawned = await spawnCinemaBeat(saved.queue, beat);
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
      kind: "cinema",
      estimate,
    });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    await prisma.generateJob.update({
      where: { id: child.id },
      data: { status: "failed", error: messageText.slice(0, 2000), completedAt: new Date() },
    });
    const failedQ = patchCinemaBeat(generating, beat.id, {
      status: "rejected",
      error: messageText.slice(0, 500),
    });
    await prisma.generateJob.update({
      where: { id: saved.row.id },
      data: { cardJson: failedQ, status: cinemaParentJobStatus(failedQ) },
    });
    return jsonError(messageText, 502, {
      queue: failedQ,
      job: serializeJob(saved.row),
      kind: "cinema",
      estimate,
    });
  }
}

async function stitchCinema(createdBy: string, queue: CinemaQueue, queueJobId: string | undefined) {
  const gate = canStitchCinema(queue);
  if (!gate.ok) return jsonError(gate.reason || "Approve every beat before stitch", 400);

  const saved = await saveCinemaQueue({ createdBy, queue, id: queueJobId });
  const jobIds = approvedCinemaJobIds(saved.queue);
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
        cinema: true,
        stitch_mode: "concat_copy",
        music_bed: false,
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
      kind: "cinema",
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
    return jsonError(messageText, 502, { queue: nextQueue, kind: "cinema" });
  }
}
