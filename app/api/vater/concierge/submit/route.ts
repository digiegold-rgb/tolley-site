/**
 * POST /api/vater/concierge/submit — Fable 5 Concierge batch submit.
 *
 * The Dashboard's "Create Video → I already have a script → Fable 5" lane:
 * N pasted scripts become N projects + N tickets in one call.
 *
 * Body `{ styleId?: string, scripts: Array<{ script: string, title?: string }>, note?: string }`
 *   · 1 ≤ scripts.length ≤ 10
 *   · every script ≥ 20 words and ≤ the account's cap (validated BEFORE any
 *     row is created — one bad script fails the whole batch, nothing half-made)
 *   · styleId is resolved/authorised exactly like the public API
 *     (lib/vater/public-api.resolveStyleForUser) — a system style or the
 *     caller's own; omitted → the account's locked style
 *   · cumulative credit pre-check against the live balance (skipped for
 *     unmetered studio accounts) so ten scripts can't each pass the per-project
 *     gate while the sum can't be covered. A pre-check, not a reservation —
 *     the debit happens at delivery, same as Auto.
 *
 * Responses
 *   200 `{ tickets:[{ projectId, code, words, estMinutes, estimateUsd, title }], failures:[] }`
 *   400 `{ error:'invalid_request'|'script_too_short'|'script_too_long', message, detail?, index?, wordCount?, maxWords? }`
 *   402 `{ error:'Billing check failed', needUsd, haveUsd, budget:{ reason:'insufficient_credits', balanceCents, estimateCents } }`
 *   403/404/409 from style resolution (`{ error, message }`) · 409 `{ error, reason }` when the style can't render
 *
 * One Telegram + one ack email for the batch (per-ticket notifies are
 * suppressed via `quiet`).
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/budget/notify";
import { appendScriptVersion } from "@/lib/vater/script-versions";
import { resolveStyleForUser } from "@/lib/vater/public-api";
import { hasUnmeteredStudioAccess } from "@/lib/vater/billing/check-budget";
import { estimateUsdFor, getBalance } from "@/lib/vater/billing/ledger";
import { maxWordsFor } from "@/lib/vater/billing/script-cap";
import { quoteMinutes } from "@/lib/vater/billing/estimate";
import { isOverLength, lengthMessageFor, runtimeClock } from "@/lib/vater/script-limits";
import { sendConciergeBatchQueuedEmail } from "@/lib/vater/animate-email";
import { CONCIERGE_MIN_WORDS, isKickable, wordCount } from "@/lib/vater/concierge";
import {
  CONCIERGE_LIBRARY_URL,
  submitConcierge,
  tgSafe,
  type SubmitConciergeResult,
} from "@/lib/vater/concierge-submit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SCRIPTS = 10;
const MAX_CHARS = 200_000;

interface Body {
  styleId?: unknown;
  scripts?: unknown;
  note?: unknown;
}

function firstLineAsTitle(script: string): string {
  const line = script
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  if (!line) return "Untitled script";
  const words = line.split(/\s+/);
  return words.length > 12 ? `${words.slice(0, 12).join(" ")}…` : line;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const email = session.user.email ?? null;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_request", message: "Invalid JSON body" }, { status: 400 });
  }

  // ── Parse + validate every script before touching the database ───────────
  const rawScripts = Array.isArray(body.scripts) ? body.scripts : [];
  if (rawScripts.length === 0) {
    return NextResponse.json(
      { error: "invalid_request", message: "`scripts` must be a non-empty array of { script, title? }." },
      { status: 400 },
    );
  }
  if (rawScripts.length > MAX_SCRIPTS) {
    return NextResponse.json(
      { error: "invalid_request", message: `At most ${MAX_SCRIPTS} scripts per batch.` },
      { status: 400 },
    );
  }
  const maxWords = await maxWordsFor(userId, email);
  const scripts: Array<{ script: string; title: string; words: number; targetDuration: number }> = [];
  for (let i = 0; i < rawScripts.length; i++) {
    const item = rawScripts[i] as { script?: unknown; title?: unknown } | string;
    const text = (typeof item === "string" ? item : typeof item?.script === "string" ? item.script : "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "invalid_request", message: `Script ${i + 1} is empty.`, index: i },
        { status: 400 },
      );
    }
    if (text.length > MAX_CHARS) {
      return NextResponse.json(
        { error: "script_too_long", message: `Script ${i + 1} is ${text.length} characters; the maximum is ${MAX_CHARS}.`, index: i },
        { status: 400 },
      );
    }
    const words = wordCount(text);
    if (words < CONCIERGE_MIN_WORDS) {
      return NextResponse.json(
        {
          error: "script_too_short",
          message: `Fable 5 renders a finished script — paste at least ${CONCIERGE_MIN_WORDS} words.`,
          detail: `Script ${i + 1} is ${words} word${words === 1 ? "" : "s"}; Fable 5 needs at least ${CONCIERGE_MIN_WORDS}.`,
          index: i,
          wordCount: words,
          minWords: CONCIERGE_MIN_WORDS,
        },
        { status: 400 },
      );
    }
    if (isOverLength(words, maxWords)) {
      const message = lengthMessageFor(maxWords);
      return NextResponse.json(
        {
          error: "script_too_long",
          message,
          detail: `Script ${i + 1} is ${words.toLocaleString()} words (≈ ${runtimeClock(words)}). ${message}`,
          index: i,
          wordCount: words,
          maxWords,
        },
        { status: 400 },
      );
    }
    const titleRaw = typeof item === "object" && item && typeof item.title === "string" ? item.title.trim() : "";
    const title = (titleRaw || firstLineAsTitle(text)).slice(0, 200);
    scripts.push({ script: text, title, words, targetDuration: quoteMinutes(words) });
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 2000) : null;

  // ── Style (authorised) + kickability, once for the batch ─────────────────
  const resolved = await resolveStyleForUser(userId, email, body.styleId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error, message: resolved.message }, { status: resolved.status });
  }
  const styleId = resolved.styleId;
  const kick = await isKickable({ id: "", userId, styleId, voiceName: null, script: scripts[0].script });
  if (!kick.ok) {
    return NextResponse.json({ error: kick.message, reason: kick.reason }, { status: 409 });
  }

  // ── Cumulative credit pre-check BEFORE any row exists ────────────────────
  const estimates = scripts.map((s) => estimateUsdFor({ targetDuration: s.targetDuration }));
  const needUsd = Math.round(estimates.reduce((a, b) => a + b, 0) * 100) / 100;
  if (!(await hasUnmeteredStudioAccess(userId))) {
    const balance = await getBalance(userId);
    if (balance.ready) {
      const haveUsd = balance.balanceCents / 100;
      if (balance.balanceCents < Math.round(needUsd * 100)) {
        return NextResponse.json(
          {
            error: "Billing check failed",
            needUsd,
            haveUsd,
            budget: {
              reason: "insufficient_credits",
              balanceCents: balance.balanceCents,
              estimateCents: Math.round(needUsd * 100),
            },
          },
          { status: 402 },
        );
      }
    }
  }

  // ── Create rows + tickets ────────────────────────────────────────────────
  const tickets: Array<{
    projectId: string;
    code: string;
    words: number;
    estMinutes: number;
    estimateUsd: number;
    title: string;
  }> = [];
  const failures: Array<{ index: number; status: number; body: unknown }> = [];
  let firstFailure: Exclude<SubmitConciergeResult, { ok: true }> | null = null;

  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i];
    // Same row createVideoFromScript makes (the call IS the approval), parked
    // at `scripted` for the one tick before submitConcierge flips it to
    // `concierge_queued` with the ticket in the same transaction.
    const project = await prisma.youTubeProject.create({
      data: {
        userId,
        mode: "topic",
        sourceType: "topic",
        topic: s.title,
        sourceTitle: s.title,
        goal: s.title,
        script: s.script,
        scriptVersions: appendScriptVersion(null, "edited", s.script),
        scriptMeta: { wordCount: s.words, targetWordCount: s.words, source: "user-supplied" },
        targetDuration: s.targetDuration,
        targetWordCount: s.words,
        styleId,
        // Seed look + voice from the Style (mirrors createProjectFromStyle) —
        // otherwise the row keeps `stylePreset:"cinematic"` and a "Pixar 3D"
        // ticket renders cinematic (seen on F5-7HR425).
        ...(resolved.seed.stylePreset ? { stylePreset: resolved.seed.stylePreset } : {}),
        voiceName: resolved.seed.voiceName,
        voiceCloneId: resolved.seed.voiceCloneId,
        scriptApprovedAt: new Date(),
        status: "scripted",
        progress: 30,
      },
    });

    const result = await submitConcierge({
      project,
      userId,
      email,
      script: s.script,
      customerNote: note,
      quiet: true,
    });
    if (!result.ok) {
      // Nothing else references a row that failed its own submit — drop it so
      // the Library doesn't fill with half-made projects.
      await prisma.youTubeProject.delete({ where: { id: project.id } }).catch(() => undefined);
      failures.push({ index: i, status: result.status, body: result.body });
      if (!firstFailure) firstFailure = result;
      continue;
    }
    tickets.push({
      projectId: project.id,
      code: result.ticket.code,
      words: result.words,
      estMinutes: result.estMinutes,
      estimateUsd: result.estimateUsd,
      title: s.title,
    });
  }

  if (tickets.length === 0 && firstFailure) {
    return NextResponse.json(firstFailure.body, { status: firstFailure.status });
  }

  // ── One Telegram + one email for the batch ───────────────────────────────
  const totalWords = tickets.reduce((a, t) => a + t.words, 0);
  const totalEst = tickets.reduce((a, t) => a + t.estimateUsd, 0);
  const lines = tickets.map(
    (t) => `  • ${tgSafe(t.code)} · ${t.words} words (~${t.estMinutes} min) · est $${t.estimateUsd.toFixed(2)}`,
  );
  void notifyTelegram(
    tickets.length === 1
      ? `📜 Fable 5 ticket ${tgSafe(tickets[0].code)} · ${tgSafe(email || "—")} · ${tickets[0].words} words (~${tickets[0].estMinutes} min) · est $${tickets[0].estimateUsd.toFixed(2)} · /fable5 ${tgSafe(tickets[0].code)}`
      : [
          `📜 Fable 5 batch · ${tickets.length} tickets · ${tgSafe(email || "—")} · ${totalWords} words · est $${totalEst.toFixed(2)}`,
          ...lines,
          `/fable5 ${tgSafe(tickets[0].code)}`,
        ].join("\n"),
  ).catch(() => undefined);
  if (email) {
    sendConciergeBatchQueuedEmail(email, {
      tickets: tickets.map((t) => ({ code: t.code, title: t.title, words: t.words })),
      libraryUrl: CONCIERGE_LIBRARY_URL,
    }).catch((err) => {
      console.error("[concierge/submit] batch ack email failed", err);
    });
  }

  console.log(
    `[concierge/submit] user=${userId} tickets=${tickets.map((t) => t.code).join(",")} failures=${failures.length}`,
  );
  return NextResponse.json({ tickets, failures });
}
