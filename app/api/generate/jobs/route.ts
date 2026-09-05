import { NextRequest, NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import {
  defaultJobCard,
  parseGenerateJobCard,
  type GenerateJobCard,
} from "@/lib/generate-job-card";
import { fillJobCardFromChat, isJobCardLlmConfigured } from "@/lib/generate-job-llm";
import {
  emptyMotionCard,
  parseGenerateMotionCard,
  type GenerateMotionCard,
} from "@/lib/generate-motion-card";
import { fillMotionCardFromChat } from "@/lib/generate-motion-llm";
import {
  parseGenerateEngineCard,
  falEnginePublicStatus,
  type GenerateEngineCard,
} from "@/lib/generate-engine-card";
import {
  spawnFalT2I,
  spawnFalT2V,
  spawnT2IInput,
  spawnT2VInput,
} from "@/lib/generate-engine";
import {
  falPublicStatus,
  isFalConfigured,
  spawnFalMotion,
  spawnInputForCard,
} from "@/lib/generate-motion";
import {
  buildWebhookUrl,
  isModalConfigured,
  modalPublicStatus,
  spawnKwargsForCard,
  spawnQwenImageEdit,
} from "@/lib/generate-modal";
import { serializeJob } from "@/lib/generate-job-store";
import { isBlockedStudioRequest } from "@/lib/generate-director";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

function isMotionKind(body: { kind?: unknown; card?: unknown; currentCard?: unknown }): boolean {
  if (body.kind === "motion" || body.kind === "i2v") return true;
  const raw = (body.card || body.currentCard) as { recipe?: unknown } | undefined;
  return raw?.recipe === "fal-wan-i2v" || raw?.recipe === "fal-wan-flf2v";
}

function isEngineKind(body: { kind?: unknown }): body is { kind: "t2i" | "t2v" } {
  return body.kind === "t2i" || body.kind === "t2v";
}

/**
 * GET /api/generate/jobs — recent jobs + public Modal / fal status (no tokens).
 */
export async function GET() {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  const rows = await prisma.generateJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  return NextResponse.json({
    jobs: rows.map(serializeJob),
    modal: modalPublicStatus(),
    fal: falPublicStatus(),
    llm: { configured: isJobCardLlmConfigured() },
    defaults: defaultJobCard(),
    motion_defaults: emptyMotionCard(),
    engines: falEnginePublicStatus(),
  });
}

/**
 * POST /api/generate/jobs
 *
 * Body: { kind?: "still"|"motion"|"t2i"|"t2v"|"i2v", card?, prompt?, aspect?, seconds?, message?, currentCard?, start?, dryRun? }
 *   - kind:"motion"|"i2v" → fal Wan I2V / FLF2V (source still URL)
 *   - kind:"t2i" → fal FLUX.1 [dev] (no Gemini keyframe)
 *   - kind:"t2v" → fal Wan T2V (no Gemini keyframe)
 *   - default / still → existing Modal Qwen stills path (unchanged)
 */
export async function POST(req: NextRequest) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  let body: {
    kind?: unknown;
    card?: unknown;
    prompt?: unknown;
    aspect?: unknown;
    seconds?: unknown;
    message?: unknown;
    currentCard?: unknown;
    start?: unknown;
    dryRun?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }

  if (body.kind === "v2v") {
    return jsonError(
      "Video → Video is not wired on fal. Use Motion or Image → Video with a still. There is no Wan V2V / Animate path in this repo.",
      400,
      { v2v: "not-wired" },
    );
  }

  if (isEngineKind(body)) {
    return postEngine(body, gate.createdBy);
  }
  if (isMotionKind(body)) {
    return postMotion(body, gate.createdBy);
  }
  return postStill(body, gate.createdBy);
}

async function postMotion(
  body: {
    card?: unknown;
    message?: unknown;
    currentCard?: unknown;
    start?: unknown;
    dryRun?: unknown;
  },
  createdBy: string,
) {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const dryRun = body.dryRun === true;
  const explicitStart = body.start === true;

  let card: GenerateMotionCard | ReturnType<typeof emptyMotionCard>;
  let reply: string | undefined;
  let model: string | undefined;

  try {
    if (body.card && typeof body.card === "object") {
      const rec = body.card as { source_image_url?: unknown };
      if (!String(rec.source_image_url || "").trim() && (message || !explicitStart && !dryRun)) {
        card = emptyMotionCard();
        Object.assign(card, body.card);
      } else {
        card = parseGenerateMotionCard(body.card);
      }
    } else if (body.currentCard && typeof body.currentCard === "object") {
      const rec = body.currentCard as { source_image_url?: unknown };
      if (!String(rec.source_image_url || "").trim()) {
        card = { ...emptyMotionCard(), ...(body.currentCard as object) } as ReturnType<typeof emptyMotionCard>;
      } else {
        card = parseGenerateMotionCard(body.currentCard);
      }
    } else {
      card = emptyMotionCard();
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Invalid motion card", 400);
  }

  if (message) {
    const safety = isBlockedStudioRequest(message);
    if (safety.blocked) {
      return NextResponse.json({
        reply: safety.reason,
        card,
        refused: true,
        kind: "motion",
      });
    }
    try {
      const filled = await fillMotionCardFromChat(message, card);
      card = filled.card;
      reply = filled.reply;
      model = filled.model;
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Chat→motion card failed", 502);
    }
  }

  if (message && !explicitStart && !dryRun) {
    return NextResponse.json({
      reply,
      card,
      model,
      started: false,
      kind: "motion",
    });
  }

  const shouldPersist = explicitStart || dryRun || !message;
  if (!shouldPersist) {
    return NextResponse.json({ reply, card, model, started: false, kind: "motion" });
  }

  let parsed: GenerateMotionCard;
  try {
    parsed = parseGenerateMotionCard(card);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Motion card needs an HTTPS source still", 400);
  }

  const planned = spawnInputForCard(parsed);
  const storedCard = { ...parsed, recipe: planned.recipe, fal_model: planned.falModelId };
  const row = await prisma.generateJob.create({
    data: {
      status: "queued",
      recipe: planned.recipe,
      cardJson: storedCard,
      createdBy,
    },
  });

  if (dryRun) {
    return NextResponse.json({
      job: serializeJob(row),
      card: storedCard,
      reply,
      dryRun: true,
      fal_input: planned.input,
      fal: falPublicStatus(),
      started: false,
      kind: "motion",
    });
  }

  const shouldSpawn = !dryRun && (explicitStart || !message);
  if (!shouldSpawn) {
    return NextResponse.json({
      job: serializeJob(row),
      card: storedCard,
      reply,
      started: false,
      kind: "motion",
    });
  }

  if (!isFalConfigured()) {
    await prisma.generateJob.update({
      where: { id: row.id },
      data: {
        status: "failed",
        error: "fal.ai is not configured. Set FAL_KEY.",
        completedAt: new Date(),
      },
    });
    return jsonError(
      "fal.ai is not configured. Set FAL_KEY on Vercel.",
      503,
      { job: serializeJob({ ...row, status: "failed", error: "fal.ai is not configured." }), kind: "motion" },
    );
  }

  try {
    const spawned = await spawnFalMotion(parsed);
    const running = await prisma.generateJob.update({
      where: { id: row.id },
      data: {
        status: "running",
        recipe: spawned.recipe,
        modalCallId: spawned.callId,
        startedAt: new Date(),
        cardJson: { ...storedCard, fal_model: spawned.falModelId },
      },
    });
    return NextResponse.json({
      job: serializeJob(running),
      card: storedCard,
      reply,
      started: true,
      fal_request_id: spawned.callId,
      kind: "motion",
    });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    const failed = await prisma.generateJob.update({
      where: { id: row.id },
      data: {
        status: "failed",
        error: messageText.slice(0, 2000),
        completedAt: new Date(),
      },
    });
    return jsonError(messageText, 502, { job: serializeJob(failed), kind: "motion" });
  }
}

async function postEngine(
  body: {
    kind?: unknown;
    card?: unknown;
    prompt?: unknown;
    aspect?: unknown;
    seconds?: unknown;
    start?: unknown;
    dryRun?: unknown;
  },
  createdBy: string,
) {
  const kind = body.kind === "t2v" ? "t2v" : "t2i";
  const dryRun = body.dryRun === true;
  const explicitStart = body.start === true;

  const rawCard =
    body.card && typeof body.card === "object"
      ? (body.card as Record<string, unknown>)
      : {};
  const prompt =
    (typeof body.prompt === "string" && body.prompt.trim()) ||
    (typeof rawCard.prompt === "string" && rawCard.prompt.trim()) ||
    "";

  if (!prompt) {
    return jsonError("Prompt is required", 400, { kind });
  }

  const safety = isBlockedStudioRequest(prompt);
  if (safety.blocked) {
    return NextResponse.json({ reply: safety.reason, refused: true, kind });
  }

  let parsed: GenerateEngineCard;
  try {
    parsed = parseGenerateEngineCard(
      {
        ...rawCard,
        prompt,
        aspect: body.aspect ?? rawCard.aspect,
        seconds: body.seconds ?? rawCard.seconds,
      },
      kind,
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Invalid engine card", 400, { kind });
  }

  const planned = kind === "t2v" ? spawnT2VInput(parsed) : spawnT2IInput(parsed);
  const storedCard = { ...parsed, recipe: planned.recipe, fal_model: planned.falModelId };
  const row = await prisma.generateJob.create({
    data: {
      status: "queued",
      recipe: planned.recipe,
      cardJson: storedCard,
      createdBy,
    },
  });

  if (dryRun) {
    return NextResponse.json({
      job: serializeJob(row),
      card: storedCard,
      dryRun: true,
      fal_input: planned.input,
      fal: falPublicStatus(),
      engines: falEnginePublicStatus(),
      started: false,
      kind,
    });
  }

  const shouldSpawn = explicitStart || !dryRun;
  if (!shouldSpawn) {
    return NextResponse.json({
      job: serializeJob(row),
      card: storedCard,
      started: false,
      kind,
    });
  }

  if (!isFalConfigured()) {
    await prisma.generateJob.update({
      where: { id: row.id },
      data: {
        status: "failed",
        error: "fal.ai is not configured. Set FAL_KEY.",
        completedAt: new Date(),
      },
    });
    return jsonError(
      "fal.ai is not configured. Set FAL_KEY on Vercel.",
      503,
      { job: serializeJob({ ...row, status: "failed", error: "fal.ai is not configured." }), kind },
    );
  }

  try {
    const spawned = kind === "t2v" ? await spawnFalT2V(parsed) : await spawnFalT2I(parsed);
    const running = await prisma.generateJob.update({
      where: { id: row.id },
      data: {
        status: "running",
        recipe: spawned.recipe,
        modalCallId: spawned.callId,
        startedAt: new Date(),
        cardJson: { ...storedCard, fal_model: spawned.falModelId },
      },
    });
    return NextResponse.json({
      job: serializeJob(running),
      card: storedCard,
      started: true,
      fal_request_id: spawned.callId,
      kind,
    });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    const failed = await prisma.generateJob.update({
      where: { id: row.id },
      data: {
        status: "failed",
        error: messageText.slice(0, 2000),
        completedAt: new Date(),
      },
    });
    return jsonError(messageText, 502, { job: serializeJob(failed), kind });
  }
}

async function postStill(
  body: {
    card?: unknown;
    message?: unknown;
    currentCard?: unknown;
    start?: unknown;
    dryRun?: unknown;
  },
  createdBy: string,
) {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const dryRun = body.dryRun === true;
  const explicitStart = body.start === true;

  let card: GenerateJobCard;
  let reply: string | undefined;
  let model: string | undefined;

  try {
    if (body.card && typeof body.card === "object") {
      card = parseGenerateJobCard(body.card);
    } else if (body.currentCard && typeof body.currentCard === "object") {
      card = parseGenerateJobCard(body.currentCard);
    } else {
      card = defaultJobCard();
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Invalid job card", 400);
  }

  if (message) {
    const safety = isBlockedStudioRequest(message);
    if (safety.blocked) {
      return NextResponse.json({
        reply: safety.reason,
        card,
        refused: true,
      });
    }
    try {
      const filled = await fillJobCardFromChat(message, card);
      card = filled.card;
      reply = filled.reply;
      model = filled.model;
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Chat→card failed", 502);
    }
  }

  // Chat-only turn: return the filled card, do not enqueue a GPU job.
  if (message && !explicitStart && !dryRun) {
    return NextResponse.json({
      reply,
      card,
      model,
      started: false,
    });
  }

  const shouldPersist = explicitStart || dryRun || !message;
  if (!shouldPersist) {
    return NextResponse.json({ reply, card, model, started: false });
  }

  const shouldSpawn = !dryRun && (explicitStart || !message);

  const kwargs = spawnKwargsForCard(card);
  const row = await prisma.generateJob.create({
    data: {
      status: dryRun ? "queued" : "queued",
      recipe: card.recipe,
      cardJson: card,
      createdBy,
    },
  });

  if (dryRun) {
    return NextResponse.json({
      job: serializeJob(row),
      card,
      reply,
      dryRun: true,
      modal_kwargs: kwargs,
      modal: modalPublicStatus(),
      started: false,
    });
  }

  if (!shouldSpawn) {
    return NextResponse.json({
      job: serializeJob(row),
      card,
      reply,
      started: false,
    });
  }

  if (!isModalConfigured()) {
    await prisma.generateJob.update({
      where: { id: row.id },
      data: {
        status: "failed",
        error: "Modal is not configured. Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET.",
        completedAt: new Date(),
      },
    });
    return jsonError(
      "Modal is not configured. Set MODAL_TOKEN_ID and MODAL_TOKEN_SECRET on Vercel.",
      503,
      { job: serializeJob({ ...row, status: "failed", error: "Modal is not configured." }) },
    );
  }

  try {
    const webhook = buildWebhookUrl();
    const spawned = await spawnQwenImageEdit(
      spawnKwargsForCard(card, { job_id: row.id, webhook_url: webhook }),
    );
    const running = await prisma.generateJob.update({
      where: { id: row.id },
      data: {
        status: "running",
        modalCallId: spawned.callId,
        startedAt: new Date(),
      },
    });
    return NextResponse.json({
      job: serializeJob(running),
      card,
      reply,
      started: true,
      modal_call_id: spawned.callId,
    });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    const failed = await prisma.generateJob.update({
      where: { id: row.id },
      data: {
        status: "failed",
        error: messageText.slice(0, 2000),
        completedAt: new Date(),
      },
    });
    return jsonError(messageText, 502, { job: serializeJob(failed) });
  }
}
