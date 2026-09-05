import { NextRequest, NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import {
  addBeat,
  applyPrevLastSource,
  approvedBeatJobIds,
  canGenerateBeat,
  canStitchBeats,
  emptyBeat,
  emptyBeatQueue,
  markBeatGenerating,
  motionCardFromBeat,
  moveBeat,
  parseBeatQueue,
  parseMotionBeat,
  patchBeat,
  removeBeat,
  setBeatStatus,
  type BeatQueue,
  type BeatStatus,
} from "@/lib/generate-beats";
import {
  latestBeatQueueJob,
  loadBeatQueueJob,
  saveBeatQueue,
  STITCH_RECIPE,
} from "@/lib/generate-beats-store";
import { concatMp4s } from "@/lib/generate-ffmpeg";
import { isBlockedStudioRequest } from "@/lib/generate-director";
import { serializeJob } from "@/lib/generate-job-store";
import { falPublicStatus, isFalConfigured, spawnFalMotion } from "@/lib/generate-motion";
import { parseGenerateMotionCard } from "@/lib/generate-motion-card";
import { readableToBuffer } from "@/lib/generate-media";
import { persistJobMp4s, fetchStoredJobImage } from "@/lib/generate-output-persist";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * GET /api/generate/beats — latest beat queue for this HQ user.
 */
export async function GET(req: NextRequest) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  const id = req.nextUrl.searchParams.get("id")?.trim() || "";
  const loaded = id ? await loadBeatQueueJob(id) : await latestBeatQueueJob(gate.createdBy);
  if (!loaded) {
    return NextResponse.json({
      queue: emptyBeatQueue(),
      job: null,
      fal: falPublicStatus(),
    });
  }
  return NextResponse.json({
    queue: loaded.queue,
    job: serializeJob(loaded.row),
    fal: falPublicStatus(),
  });
}

/**
 * POST /api/generate/beats
 *
 * Actions (never auto-stitch on generate):
 *   save | add | remove | move | patch | generate | approve | reject | reset | stitch
 */
export async function POST(req: NextRequest) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  let body: {
    action?: unknown;
    queueId?: unknown;
    queue?: unknown;
    beat?: unknown;
    beatId?: unknown;
    delta?: unknown;
    patch?: unknown;
    crossfade?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  const action = typeof body.action === "string" ? body.action.trim() : "save";
  const queueId = typeof body.queueId === "string" ? body.queueId.trim() : "";

  let loaded = queueId ? await loadBeatQueueJob(queueId) : await latestBeatQueueJob(gate.createdBy);
  let queue: BeatQueue = loaded ? loaded.queue : emptyBeatQueue();
  if (!loaded && body.queue) {
    try {
      queue = parseBeatQueue(body.queue);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Invalid beat queue", 400);
    }
  }

  try {
    if (action === "save") {
      if (body.queue) queue = parseBeatQueue(body.queue);
    } else if (action === "add") {
      const beat = body.beat ? parseMotionBeat(body.beat) : emptyBeat();
      queue = addBeat(queue, beat);
    } else if (action === "remove") {
      const beatId = String(body.beatId || "");
      queue = removeBeat(queue, beatId);
    } else if (action === "move") {
      const delta = body.delta === -1 || body.delta === "-1" ? -1 : 1;
      queue = moveBeat(queue, String(body.beatId || ""), delta);
    } else if (action === "patch") {
      const patch = (body.patch && typeof body.patch === "object" ? body.patch : {}) as Record<string, unknown>;
      queue = patchBeat(queue, String(body.beatId || ""), patch);
      const beat = queue.beats.find((b) => b.id === String(body.beatId || ""));
      if (beat?.from_prev_last) queue = applyPrevLastSource(queue, beat.id);
    } else if (action === "generate") {
      return await generateBeat(gate.createdBy, queue, loaded?.row.id, String(body.beatId || ""));
    } else if (action === "approve" || action === "reject" || action === "reset") {
      const status: BeatStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "draft";
      queue = setBeatStatus(queue, String(body.beatId || ""), status);
    } else if (action === "stitch") {
      return await stitchBeats(gate.createdBy, queue, loaded?.row.id, body.crossfade === true);
    } else {
      return jsonError(`Unknown beats action: ${action}`, 400);
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Beat queue update failed", 400);
  }

  const saved = await saveBeatQueue({ createdBy: gate.createdBy, queue, id: loaded?.row.id });
  return NextResponse.json({
    queue: saved.queue,
    job: serializeJob(saved.row),
    fal: falPublicStatus(),
  });
}

async function generateBeat(
  createdBy: string,
  queue: BeatQueue,
  queueJobId: string | undefined,
  beatId: string,
) {
  const beat = queue.beats.find((b) => b.id === beatId);
  if (!beat) return jsonError("Beat not found", 404);
  const ready = canGenerateBeat(beat);
  if (!ready.ok) return jsonError(ready.reason || "Cannot generate this beat", 400);

  const safety = isBlockedStudioRequest(`${beat.prompt}\n${beat.negative_prompt}`);
  if (safety.blocked) {
    return NextResponse.json({ reply: safety.reason, refused: true, queue, kind: "beats" });
  }

  let parsed;
  try {
    parsed = motionCardFromBeat(beat);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Beat needs a source still", 400);
  }

  const saved = await saveBeatQueue({ createdBy, queue, id: queueJobId });
  const storedCard = {
    ...parsed,
    queue_id: saved.row.id,
    beat_id: beat.id,
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

  const generating = markBeatGenerating(saved.queue, beat.id, child.id);
  await prisma.generateJob.update({
    where: { id: saved.row.id },
    data: { cardJson: generating },
  });

  if (!isFalConfigured()) {
    await prisma.generateJob.update({
      where: { id: child.id },
      data: { status: "failed", error: "fal.ai is not configured. Set FAL_KEY.", completedAt: new Date() },
    });
    const failedQ = patchBeat(generating, beat.id, {
      status: "rejected",
      error: "fal.ai is not configured. Set FAL_KEY.",
    });
    await prisma.generateJob.update({ where: { id: saved.row.id }, data: { cardJson: failedQ } });
    return jsonError("fal.ai is not configured. Set FAL_KEY on Vercel.", 503, {
      queue: failedQ,
      job: serializeJob(saved.row),
    });
  }

  try {
    const spawned = await spawnFalMotion(parseGenerateMotionCard(parsed));
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
      kind: "beats",
    });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    await prisma.generateJob.update({
      where: { id: child.id },
      data: { status: "failed", error: messageText.slice(0, 2000), completedAt: new Date() },
    });
    const failedQ = patchBeat(generating, beat.id, { status: "rejected", error: messageText.slice(0, 500) });
    await prisma.generateJob.update({ where: { id: saved.row.id }, data: { cardJson: failedQ } });
    return jsonError(messageText, 502, { queue: failedQ, job: serializeJob(saved.row), kind: "beats" });
  }
}

async function stitchBeats(
  createdBy: string,
  queue: BeatQueue,
  queueJobId: string | undefined,
  crossfade: boolean,
) {
  const gate = canStitchBeats(queue);
  if (!gate.ok) return jsonError(gate.reason || "Approve every beat before stitch", 400);

  const saved = await saveBeatQueue({ createdBy, queue, id: queueJobId });
  const jobIds = approvedBeatJobIds(saved.queue);
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
      cardJson: { recipe: STITCH_RECIPE, queue_id: saved.row.id, beat_job_ids: jobIds, crossfade },
      createdBy,
      startedAt: new Date(),
    },
  });

  try {
    const out = await concatMp4s(clips, { crossfadeSec: crossfade ? 0.25 : 0 });
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
      kind: "beats",
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
    return jsonError(messageText, 502, { queue: nextQueue, kind: "beats" });
  }
}
