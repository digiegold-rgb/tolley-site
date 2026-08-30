/**
 * POST /api/vater/youtube/[id]/write-script
 *
 * On-site Claude script generation for the Create Video Writing step.
 * Does not wait for the DGX. Quote is computed from published token rates
 * × expected size BEFORE the call; the customer is billed ACTUAL
 * input+output tokens × 1.30 AFTER the API returns.
 *
 * Body:
 *   model?: "fable"|"opus"|"sonnet"   default Sonnet (Trey default is client-side)
 *   fidelity?: "faithful"|"balanced"|"rewrite"
 *   source?: "transcript"|"edited"    edited = generate from the text in the box
 *   editedScript?: string             required when source=edited
 *
 * → 201 { project, quote, billed, charge }
 * → 402 budget · 409 gate · 400 bad input
 */
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { appendScriptVersion } from "@/lib/vater/script-versions";
import { nextApprovalExpiry } from "@/lib/vater/approval-expiry";
import { WORDS_PER_MINUTE, wordCountForDuration } from "@/lib/vater/youtube-types";
import { logLlmUsage } from "@/lib/llm-usage";
import {
  ScriptWriterError,
  generateScriptWithClaude,
  loadScriptRulesForUser,
  quoteScriptJob,
} from "@/lib/vater/script-writer";
import {
  isScriptFidelity,
  isScriptWriterModelId,
  type ScriptFidelity,
  type ScriptWriterCharge,
  type ScriptWriterModelId,
  type ScriptWriterSource,
} from "@/lib/vater/script-writer-models";
import { settingsBag } from "@/lib/vater/youtube-posted";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

const MIN_SOURCE_WORDS = 20;
const WRITABLE = new Set(["draft", "transcribed", "failed", "scripted", "awaiting_script_approval"]);

function wordsIn(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function asSource(v: unknown): ScriptWriterSource {
  return v === "edited" ? "edited" : "transcript";
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as {
    model?: unknown;
    fidelity?: unknown;
    source?: unknown;
    editedScript?: unknown;
    /** Quote only — no write, no charge. */
    dryRun?: unknown;
    /** Per-click id so a retry cannot bill the same generate twice. */
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
  const sourceKind = asSource(body.source);

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
      { error: `Project is '${project.status}' — the script is no longer open to generate` },
      { status: 409 },
    );
  }

  const edited =
    typeof body.editedScript === "string" ? body.editedScript.trim() : "";
  const transcript = (project.transcript ?? "").trim();
  const sourceText = sourceKind === "edited" ? edited || (project.script ?? "").trim() : transcript;
  if (wordsIn(sourceText) < MIN_SOURCE_WORDS) {
    return NextResponse.json(
      {
        error:
          sourceKind === "edited"
            ? "Paste or generate a draft first — then generate from the text in the editor."
            : "There is no transcript to write from. Import the source, or generate from the edited script.",
      },
      { status: 400 },
    );
  }

  const targetWordCount =
    project.targetWordCount > 0
      ? project.targetWordCount
      : project.targetDuration > 0
        ? wordCountForDuration(project.targetDuration)
        : Math.max(80, Math.ceil(wordsIn(sourceText)));

  const rules = await loadScriptRulesForUser(session.user.id, session.user.email);
  const quote = quoteScriptJob({
    model,
    source: sourceText,
    sourceKind,
    fidelity,
    targetWordCount,
    title: project.sourceTitle ?? project.topic,
    rules,
  });

  if (body.dryRun === true) {
    return NextResponse.json({ quote, dryRun: true });
  }

  // Reserve the quote (plus a small overrun buffer). Actual is billed after.
  const reserveCents = Math.max(quote.billedCents, Math.ceil(quote.billedCents * 1.25) || 1);
  const budget = await checkBudget(session.user.id, "script", null, reserveCents, {
    projectId: project.id,
  });
  if (!budget.allow) {
    return NextResponse.json({ error: "Billing check failed", budget }, { status: 402 });
  }

  const started = Date.now();
  let generated: Awaited<ReturnType<typeof generateScriptWithClaude>>;
  try {
    generated = await generateScriptWithClaude({
      model,
      source: sourceText,
      sourceKind,
      fidelity,
      targetWordCount,
      title: project.sourceTitle ?? project.topic,
      rules,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Script writer failed";
    const detail = err instanceof ScriptWriterError ? err.detail : undefined;
    await logLlmUsage({
      userId: session.user.id,
      type: "script_writer",
      provider: "anthropic",
      model: quote.apiId,
      route: `/api/vater/youtube/${id}/write-script`,
      statusCode: 502,
      errorMessage: detail ? `${message} (${detail})` : message,
      latencyMs: Date.now() - started,
    });
    return NextResponse.json(
      { error: message, quote, ...(detail ? { detail } : {}) },
      { status: 502 },
    );
  }

  const billed = generated.actual;
  const requestId =
    typeof body.requestId === "string" && body.requestId.trim().length >= 8
      ? body.requestId.trim().slice(0, 80)
      : `auto_${Date.now()}_${billed.inputTokens}_${billed.outputTokens}`;
  const usage = await recordUsage({
    userId: session.user.id,
    action: "script",
    projectId: project.id,
    overrideCostCents: billed.billedCents,
    idempotencyKey: `script_writer_${project.id}_${requestId}`,
  });

  const charge: ScriptWriterCharge = {
    at: new Date().toISOString(),
    model,
    apiId: generated.apiId,
    source: sourceKind,
    fidelity,
    quotedCents: quote.billedCents,
    billedCents: billed.billedCents,
    providerCostCents: billed.providerCostCents,
    inputTokens: billed.inputTokens,
    outputTokens: billed.outputTokens,
    markup: billed.markup,
    usageId: usage.usageId,
  };

  const priorMeta =
    project.scriptMeta && typeof project.scriptMeta === "object" && !Array.isArray(project.scriptMeta)
      ? (project.scriptMeta as Record<string, unknown>)
      : {};
  const priorCharges = Array.isArray(priorMeta.charges) ? priorMeta.charges : [];
  const scriptMeta = {
    ...priorMeta,
    source: "claude",
    writer: charge,
    charges: [...priorCharges, charge].slice(-20),
  };

  const settings = settingsBag(project.settingsJson);
  settings.scriptWriter = {
    lastModel: model,
    lastFidelity: fidelity,
    lastCharge: charge,
  };

  const duration =
    project.targetDuration > 0
      ? project.targetDuration
      : Math.max(1, Math.ceil(wordsIn(generated.script) / WORDS_PER_MINUTE));

  const updated = await prisma.youTubeProject.update({
    where: { id },
    data: {
      script: generated.script,
      scriptVersions: appendScriptVersion(project.scriptVersions, "generated", generated.script),
      scriptMeta: scriptMeta as unknown as Prisma.InputJsonValue,
      settingsJson: settings as unknown as Prisma.InputJsonValue,
      status: "awaiting_script_approval",
      flowStep: 5,
      flowStepAt: new Date(),
      approvalExpiresAt: nextApprovalExpiry(),
      scriptApprovedAt: null,
      notifiedScriptReadyAt: null,
      progress: 40,
      errorMessage: null,
      targetDuration: duration,
      targetWordCount: Math.max(project.targetWordCount || 0, wordsIn(generated.script)),
    },
  });

  await logLlmUsage({
    userId: session.user.id,
    type: "script_writer",
    provider: "anthropic",
    model: generated.apiId,
    route: `/api/vater/youtube/${id}/write-script`,
    promptTokens: billed.inputTokens,
    completionTokens: billed.outputTokens,
    latencyMs: Date.now() - started,
    statusCode: 201,
    meta: {
      projectId: id,
      billedCents: billed.billedCents,
      quotedCents: quote.billedCents,
      fidelity,
      source: sourceKind,
      usageId: usage.usageId,
    },
  });

  console.log(
    `[vater/write-script] project=${id} model=${model} ${sourceKind}/${fidelity} ` +
      `quoted=${quote.billedCents}¢ billed=${billed.billedCents}¢ ` +
      `tokens=${billed.inputTokens}+${billed.outputTokens}`,
  );

  return NextResponse.json({ project: updated, quote, billed, charge }, { status: 201 });
}
