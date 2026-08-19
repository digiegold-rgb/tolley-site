/**
 * lib/vater/public-api.ts
 *
 * The server logic behind POST /api/v1/videos, factored out of the route so
 * the public API and the in-app Script-first lane cannot drift apart.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────
 * It is NOT a second, looser path into the renderer. Every gate the browser
 * lane goes through, an API caller goes through too, in the same order and
 * through the same modules:
 *
 *   1. script sanity      — MIN_WORDS / MAX_CHARS, same numbers as
 *                           /api/vater/youtube/from-script
 *   2. beta runtime cap   — lib/vater/script-limits (owner exempt)
 *   3. style authorization— a supplied styleId must be a system style or the
 *                           caller's own; the locked-style fallback refuses to
 *                           hand a public account somebody else's look
 *   4. credits            — lib/vater/billing/check-budget at "scene" scale,
 *                           with the project id so the real estimate is
 *                           reserved rather than the $1 floor
 *   5. render kickoff     — lib/vater/script-gate.startRunCreation, which is
 *                           what stamps ownerId / ownerTier / maxWords for the
 *                           DGX's per-tenant fairness cap
 *
 * ── ONE DELIBERATE DIFFERENCE ────────────────────────────────────────────
 * The browser lane parks at `awaiting_script_approval` and waits for a human
 * to click Approve & Animate. An API caller has already made that decision by
 * calling us — there is nobody to click — so this creates the project and
 * kicks the render in one step. The credit check therefore happens HERE,
 * before the DGX is touched, rather than at the approval gate.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { appendScriptVersion } from "@/lib/vater/script-versions";
import { resolveLockedStyle, LOCKED_STYLE_NAME } from "@/lib/vater/locked-style";
import { isVaterAdminEmail, isVaterStudioEmail } from "@/lib/admin-auth";
import {
  BETA_LENGTH_MESSAGE,
  BETA_MAX_WORDS,
  WORDS_PER_MINUTE,
  isOverBetaLength,
  runtimeClock,
} from "@/lib/vater/script-limits";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { startRunCreation, ScriptGateError } from "@/lib/vater/script-gate";
import { AutopilotError } from "@/lib/vater/autopilot-client";
import { readFeatures } from "@/lib/vater/project-features";
import { isMissingRelationError } from "@/lib/vater/beta-schema";

/** Same guard rails as /api/vater/youtube/from-script. Keep the two in step. */
export const MIN_WORDS = 20;
const MAX_CHARS = 200_000;

export interface CreateVideoInput {
  script?: unknown;
  title?: unknown;
  styleId?: unknown;
  features?: unknown;
}

export interface CreateVideoFailure {
  ok: false;
  status: number;
  error: string;
  message: string;
  detail?: unknown;
}

export interface CreateVideoSuccess {
  ok: true;
  projectId: string;
  status: string;
  jobId: string;
}

const fail = (
  status: number,
  error: string,
  message: string,
  detail?: unknown,
): CreateVideoFailure => ({ ok: false, status, error, message, detail });

/** Title from the script's first non-empty line when the caller didn't name it. */
function firstLineAsTitle(script: string): string {
  const line = script
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  if (!line) return "Untitled script";
  const words = line.split(/\s+/);
  return words.length > 12 ? `${words.slice(0, 12).join(" ")}…` : line;
}

/**
 * Persist the feature bag.
 *
 * Raw, guarded UPDATE rather than a Prisma write: `settingsJson` arrives with
 * a sibling migration that may not be applied on this environment yet, and a
 * caller who passed `features` should still get their video rendered with
 * today's defaults instead of a 500. Unknown keys are dropped by
 * readFeatures(), so nothing unvalidated reaches the column.
 */
async function persistFeatures(projectId: string, features: unknown): Promise<void> {
  const parsed = readFeatures(features);
  if (Object.keys(parsed).length === 0) return;
  try {
    await prisma.$executeRaw`
      UPDATE "YouTubeProject"
         SET "settingsJson" = ${JSON.stringify(parsed)}::jsonb
       WHERE "id" = ${projectId}
    `;
  } catch (err) {
    if (isMissingRelationError(err)) {
      console.warn(
        `[v1/create] settingsJson not migrated — features ignored for project=${projectId}`,
      );
      return;
    }
    console.error(`[v1/create] feature persist failed project=${projectId}`, err);
  }
}

/**
 * Style resolution + authorization shared by the public API, the Script-first
 * lane and the Fable 5 Concierge batch submit. A supplied styleId must be a
 * system style or the caller's own; with no styleId the account's locked style
 * is used, but never another account's locked look (VATER_LOCKED_STYLE_ID pins
 * the owner's row for every caller).
 *
 * Pure extraction of the block that used to live inline in
 * createVideoFromScript — same lookups, same status codes, same messages.
 */
export async function resolveStyleForUser(
  userId: string,
  email: string | null,
  styleId: unknown,
): Promise<
  | {
      ok: true;
      styleId: string;
      /** Seed values the row must carry so the render matches the Style
       *  (createProjectFromStyle does the same; without these the row keeps
       *  the schema defaults — `stylePreset:"cinematic"` — and a "Pixar 3D"
       *  project renders cinematic. Found on concierge ticket F5-7HR425.) */
      seed: { stylePreset: string | null; voiceName: string | null; voiceCloneId: string | null };
    }
  | CreateVideoFailure
> {
  if (typeof styleId === "string" && styleId) {
    const style = await prisma.youTubeStyle.findUnique({
      where: { id: styleId },
      select: { id: true, userId: true, isSystem: true, artStylePresetId: true, voice: true, voiceCloneId: true },
    });
    if (!style) {
      return fail(404, "style_not_found", "No style with that id.");
    }
    if (!style.isSystem && style.userId && style.userId !== userId) {
      return fail(403, "forbidden", "That style belongs to another account.");
    }
    return {
      ok: true,
      styleId: style.id,
      seed: { stylePreset: style.artStylePresetId ?? null, voiceName: style.voice ?? null, voiceCloneId: style.voiceCloneId ?? null },
    };
  }
  const locked = await resolveLockedStyle(userId);
  if (!locked) {
    return fail(
      409,
      "no_style",
      `No “${LOCKED_STYLE_NAME}” style on this account — create one in Jelly Studio → Styles, or pass a styleId.`,
    );
  }
  // With VATER_LOCKED_STYLE_ID pinned, resolveLockedStyle() returns the
  // owner's row for ANY caller. A public account must never silently render
  // in someone else's locked look.
  if (!isVaterStudioEmail(email)) {
    const owner = await prisma.youTubeStyle.findUnique({
      where: { id: locked.id },
      select: { userId: true, isSystem: true },
    });
    if (owner && !owner.isSystem && owner.userId && owner.userId !== userId) {
      return fail(
        409,
        "no_style",
        "This account has no style of its own yet — create one in Jelly Studio → Styles, or pass a styleId.",
      );
    }
  }
  const lockedRow = await prisma.youTubeStyle.findUnique({
    where: { id: locked.id },
    select: { artStylePresetId: true, voice: true, voiceCloneId: true },
  });
  return {
    ok: true,
    styleId: locked.id,
    seed: {
      stylePreset: lockedRow?.artStylePresetId ?? null,
      voiceName: lockedRow?.voice ?? null,
      voiceCloneId: lockedRow?.voiceCloneId ?? null,
    },
  };
}

export async function createVideoFromScript(
  userId: string,
  email: string | null,
  input: CreateVideoInput,
): Promise<CreateVideoSuccess | CreateVideoFailure> {
  const script = typeof input.script === "string" ? input.script.trim() : "";
  if (!script) {
    return fail(
      400,
      "invalid_request",
      "`script` is required and must be a non-empty string.",
    );
  }
  if (script.length > MAX_CHARS) {
    return fail(
      400,
      "script_too_long",
      `Script is ${script.length} characters; the maximum is ${MAX_CHARS}.`,
    );
  }

  const wordCount = script.split(/\s+/).filter(Boolean).length;
  if (wordCount < MIN_WORDS) {
    return fail(
      400,
      "script_too_short",
      `Script is only ${wordCount} words — at least ${MIN_WORDS} are needed.`,
    );
  }

  // Beta runtime cap. Stopped here for the same reason the browser lane stops
  // it at intake: the DGX rejects an over-cap script anyway, and finding out
  // after the project exists leaves an unrenderable row behind. Owner exempt.
  if (!isVaterAdminEmail(email) && isOverBetaLength(wordCount)) {
    return fail(
      400,
      "script_too_long",
      `${BETA_LENGTH_MESSAGE} That script is ${wordCount.toLocaleString()} words (≈ ${runtimeClock(wordCount)}).`,
      { wordCount, maxWords: BETA_MAX_WORDS },
    );
  }

  const title = (
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim()
      : firstLineAsTitle(script)
  ).slice(0, 200);

  // ── Style resolution + authorization (mirrors from-script) ──────────────
  const resolved = await resolveStyleForUser(userId, email, input.styleId);
  if (!resolved.ok) return resolved;
  const styleId = resolved.styleId;

  // `targetDuration` is minutes and drives nothing at render time now that the
  // script is fixed — it is the Library/estimate figure. Round up so a 40s
  // script doesn't display as a zero-minute video.
  const targetDuration = Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));

  const project = await prisma.youTubeProject.create({
    data: {
      userId,
      mode: "topic",
      sourceType: "topic",
      topic: title,
      sourceTitle: title,
      goal: title,
      script,
      scriptVersions: appendScriptVersion(null, "edited", script),
      scriptMeta: { wordCount, targetWordCount: wordCount, source: "api" },
      targetDuration,
      targetWordCount: wordCount,
      styleId,
      // Seed look + voice from the Style (same as createProjectFromStyle) so the
      // render matches what the caller picked instead of the schema defaults.
      ...(resolved.seed.stylePreset ? { stylePreset: resolved.seed.stylePreset } : {}),
      voiceName: resolved.seed.voiceName,
      voiceCloneId: resolved.seed.voiceCloneId,
      // The API call IS the approval — there is no human to click the gate.
      scriptApprovedAt: new Date(),
      status: "scripted",
      progress: 30,
    },
  });

  await persistFeatures(project.id, input.features);

  // ── Credits ─────────────────────────────────────────────────────────────
  // AFTER the row exists so the gate can reserve this project's real estimate
  // (planned minutes × rate) instead of the $1 floor. A blocked call leaves a
  // `draft` row the caller can top up and retry against — never a charge.
  const budget = await checkBudget(userId, "scene", null, undefined, {
    projectId: project.id,
  });
  if (!budget.allow) {
    await prisma.youTubeProject.update({
      where: { id: project.id },
      data: {
        status: "draft",
        errorMessage: "Not enough credit to start this render.",
      },
    });
    return fail(
      402,
      "insufficient_credits",
      "Not enough credit to start this render. Top up in Jelly Studio → Billing.",
      {
        id: project.id,
        balanceUsd: (budget.balanceCents ?? 0) / 100,
        estimateUsd: (budget.estimateCents ?? 0) / 100,
        reason: budget.reason,
      },
    );
  }

  // ── Kick the render ─────────────────────────────────────────────────────
  try {
    const jobId = await startRunCreation(project, { scriptOverride: script });
    await prisma.youTubeProject.update({
      where: { id: project.id },
      data: { autopilotJobId: jobId },
    });
    console.log(
      `[v1/create] user=${userId} project=${project.id} job=${jobId} — ${wordCount} words, style=${styleId}`,
    );
    return { ok: true, projectId: project.id, status: "scripted", jobId };
  } catch (err) {
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    // A fixable project problem (no voice, missing style) is the caller's to
    // correct, so it is a 400 with the row left in a re-runnable state; a
    // transport failure is ours, so it is a 502.
    const recoverable = err instanceof ScriptGateError;
    await prisma.youTubeProject.update({
      where: { id: project.id },
      data: {
        status: recoverable ? "awaiting_script_approval" : "failed",
        errorMessage: `render kickoff failed: ${detail}`.slice(0, 1000),
      },
    });
    return fail(
      recoverable ? 400 : 502,
      "render_kickoff_failed",
      detail,
      { id: project.id },
    );
  }
}
