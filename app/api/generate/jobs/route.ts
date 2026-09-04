import { NextRequest, NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import {
  defaultJobCard,
  parseGenerateJobCard,
  type GenerateJobCard,
} from "@/lib/generate-job-card";
import { fillJobCardFromChat, isJobCardLlmConfigured } from "@/lib/generate-job-llm";
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

/**
 * GET /api/generate/jobs — recent jobs + public Modal status (no tokens).
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
    llm: { configured: isJobCardLlmConfigured() },
    defaults: defaultJobCard(),
  });
}

/**
 * POST /api/generate/jobs
 *
 * Body: { card? , message? , currentCard? , start? , dryRun? }
 *   - message → LLM fills/patches the card (structured JSON only)
 *   - card    → structured card as-is
 *   - start:true (default when no message-only parse) → persist + spawn Modal
 *   - dryRun:true → persist queued, return kwargs, do not call Modal
 */
export async function POST(req: NextRequest) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  let body: {
    card?: unknown;
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
      createdBy: gate.createdBy,
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
