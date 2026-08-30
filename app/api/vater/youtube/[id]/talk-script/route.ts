/**
 * POST /api/vater/youtube/[id]/talk-script
 *
 * Talk to Claude about the CURRENT script in the Review editor.
 * Each send is a new charge. Editing the box stays free. Generate from
 * video/draft is a separate write-script charge.
 *
 * Quote counts the full prompt (system + rules + script + history + message).
 * Bills actual tokens × 1.30 after a real text reply lands. Empty / refusal
 * / error is not billed.
 *
 * Body:
 *   message: string
 *   script?: string          current box (defaults to project.script)
 *   model?: fable|opus|sonnet
 *   fidelity?: faithful|balanced|rewrite
 *   dryRun?: boolean
 *   requestId?: string
 *
 * → 201 { project, quote, billed, charge, reply, revisedScript }
 * → 402 budget · 409 gate · 400 bad input
 */
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { logLlmUsage } from "@/lib/llm-usage";
import {
  ScriptWriterError,
  loadScriptRulesForUser,
  talkScriptWithClaude,
} from "@/lib/vater/script-writer";
import {
  capScriptChatHistory,
  parseScriptChatTurns,
  quoteScriptChat,
  readScriptChatState,
  type ScriptChatCharge,
  type ScriptChatTurn,
} from "@/lib/vater/script-chat";
import {
  isScriptFidelity,
  isScriptWriterModelId,
  type ScriptFidelity,
  type ScriptWriterModelId,
} from "@/lib/vater/script-writer-models";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const MIN_MESSAGE_CHARS = 2;
const WRITABLE = new Set(["draft", "transcribed", "failed", "scripted", "awaiting_script_approval"]);

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    message?: unknown;
    script?: unknown;
    model?: unknown;
    fidelity?: unknown;
    dryRun?: unknown;
    requestId?: unknown;
  } | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  if (body.model !== undefined && body.model !== null && !isScriptWriterModelId(body.model)) {
    return NextResponse.json({ error: "model must be fable, opus, or sonnet" }, { status: 400 });
  }
  if (body.fidelity !== undefined && body.fidelity !== null && !isScriptFidelity(body.fidelity)) {
    return NextResponse.json(
      { error: "fidelity must be faithful, balanced, or rewrite" },
      { status: 400 },
    );
  }

  const model: ScriptWriterModelId = isScriptWriterModelId(body.model) ? body.model : "sonnet";
  const fidelity: ScriptFidelity = isScriptFidelity(body.fidelity) ? body.fidelity : "balanced";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < MIN_MESSAGE_CHARS) {
    return NextResponse.json({ error: "Type a message for Claude first." }, { status: 400 });
  }

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (!project || !canAccessProject(project.userId, session.user.id, session.user.email)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.status === "expired") {
    return NextResponse.json(
      { error: "This approval expired — reopen the project to continue", status: project.status, reason: "expired" },
      { status: 409 },
    );
  }
  if (!WRITABLE.has(project.status)) {
    return NextResponse.json(
      { error: `Project is '${project.status}' — the script is no longer open to talk` },
      { status: 409 },
    );
  }

  const script =
    typeof body.script === "string" && body.script.trim()
      ? body.script.trim()
      : (project.script ?? "").trim();

  const priorMeta =
    project.scriptMeta && typeof project.scriptMeta === "object" && !Array.isArray(project.scriptMeta)
      ? (project.scriptMeta as Record<string, unknown>)
      : {};
  const priorChat = readScriptChatState(priorMeta);
  const history = capScriptChatHistory(parseScriptChatTurns(priorChat.turns));

  const rules = await loadScriptRulesForUser(session.user.id, session.user.email);
  const quote = quoteScriptChat({
    model,
    script,
    message,
    history,
    fidelity,
    title: project.sourceTitle ?? project.topic,
    rules,
  });

  if (body.dryRun === true) {
    return NextResponse.json({ quote, dryRun: true });
  }

  const reserveCents = Math.max(quote.billedCents, Math.ceil(quote.billedCents * 1.25) || 1);
  const budget = await checkBudget(session.user.id, "script", null, reserveCents, {
    projectId: project.id,
  });
  if (!budget.allow) {
    return NextResponse.json({ error: "Billing check failed", budget }, { status: 402 });
  }

  const started = Date.now();
  let talked: Awaited<ReturnType<typeof talkScriptWithClaude>>;
  try {
    talked = await talkScriptWithClaude({
      model,
      script,
      message,
      history,
      fidelity,
      title: project.sourceTitle ?? project.topic,
      rules,
    });
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : "Talk to Claude failed";
    const detail = err instanceof ScriptWriterError ? err.detail : undefined;
    await logLlmUsage({
      userId: session.user.id,
      type: "script_chat",
      provider: "anthropic",
      model: quote.apiId,
      route: `/api/vater/youtube/${id}/talk-script`,
      statusCode: 502,
      errorMessage: detail ? `${errMessage} (${detail})` : errMessage,
      latencyMs: Date.now() - started,
    });
    return NextResponse.json(
      { error: errMessage, quote, ...(detail ? { detail } : {}) },
      { status: 502 },
    );
  }

  if (!talked.reply.trim()) {
    await logLlmUsage({
      userId: session.user.id,
      type: "script_chat",
      provider: "anthropic",
      model: talked.apiId,
      route: `/api/vater/youtube/${id}/talk-script`,
      statusCode: 502,
      errorMessage: "empty reply",
      latencyMs: Date.now() - started,
    });
    return NextResponse.json({ error: "Claude returned an empty reply. Nothing was billed.", quote }, { status: 502 });
  }

  const billed = talked.actual;
  const requestId =
    typeof body.requestId === "string" && body.requestId.trim().length >= 8
      ? body.requestId.trim().slice(0, 80)
      : `talk_${Date.now()}_${billed.inputTokens}_${billed.outputTokens}`;
  const usage = await recordUsage({
    userId: session.user.id,
    action: "script",
    projectId: project.id,
    overrideCostCents: billed.billedCents,
    idempotencyKey: `script_chat_${project.id}_${requestId}`,
  });

  const charge: ScriptChatCharge = {
    at: new Date().toISOString(),
    model,
    apiId: talked.apiId,
    fidelity,
    quotedCents: quote.billedCents,
    billedCents: billed.billedCents,
    providerCostCents: billed.providerCostCents,
    inputTokens: billed.inputTokens,
    outputTokens: billed.outputTokens,
    usageId: usage.usageId,
    revised: Boolean(talked.revisedScript),
  };

  const userTurn: ScriptChatTurn = { role: "user", text: message, at: charge.at };
  const assistantTurn: ScriptChatTurn = {
    role: "assistant",
    text: talked.reply,
    at: charge.at,
    model,
    quotedCents: charge.quotedCents,
    billedCents: charge.billedCents,
    usageId: usage.usageId,
    revised: charge.revised,
  };
  const turns = capScriptChatHistory([...history, userTurn, assistantTurn]);
  const scriptMeta = {
    ...priorMeta,
    chat: {
      turns,
      lastCharge: charge,
    },
  };

  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: {
      scriptMeta: scriptMeta as unknown as Prisma.InputJsonValue,
    },
  });

  await logLlmUsage({
    userId: session.user.id,
    type: "script_chat",
    provider: "anthropic",
    model: talked.apiId,
    route: `/api/vater/youtube/${id}/talk-script`,
    promptTokens: billed.inputTokens,
    completionTokens: billed.outputTokens,
    latencyMs: Date.now() - started,
    statusCode: 201,
    meta: {
      projectId: id,
      billedCents: billed.billedCents,
      quotedCents: quote.billedCents,
      fidelity,
      usageId: usage.usageId,
      revised: charge.revised,
    },
  });

  console.log(
    `[vater/talk-script] project=${id} model=${model} ` +
      `quoted=${quote.billedCents}¢ billed=${billed.billedCents}¢ ` +
      `tokens=${billed.inputTokens}+${billed.outputTokens} revised=${charge.revised}`,
  );

  return NextResponse.json(
    {
      project: updated,
      quote,
      billed,
      charge,
      reply: talked.reply,
      revisedScript: talked.revisedScript,
    },
    { status: 201 },
  );
}
