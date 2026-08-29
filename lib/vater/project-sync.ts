/**
 * lib/vater/project-sync.ts — the poll core, extracted VERBATIM from
 * `app/api/vater/youtube/[id]/poll/route.ts` (2026-08-19, Phase A4) so the
 * same job→project sync can run from the GET /poll route AND from the
 * Concierge lane's server-side tick without duplicating the 600-line body.
 *
 * Polls the Content Autopilot job tracked on a `YouTubeProject` row, translates
 * the DGX-side phase into a tolley-site-side `YouTubeProjectStatus`, and on
 * completion copies all artifacts (script, audio, scenes, captions, final
 * video) into the project row.
 *
 * No silent catches — autopilot client errors bubble up to the caller with the
 * specific endpoint that failed (per `feedback_silent_failures_leads.md`). The
 * ONLY autopilot error handled here is the DGX 404 (job vanished); every other
 * AutopilotConfigError / AutopilotError propagates so the route can map it to
 * 500 / 502 exactly as before.
 *
 * Billing: this is the server-side completion hook for the async kickoff
 * routes (project-create/title-channel → fetch-source, context →
 * run-creation, compose → re-render). When a job flips to "done" we record
 * usage for the artifacts it actually produced — transcription, voiceover,
 * scene images, and (for compose-only jobs) the render. All charges are
 * idempotent per autopilotJobId, charged to the project OWNER (not the
 * polling session — admins polling customer projects must not be billed),
 * and wrapped in try/catch so a billing hiccup never 500s a successful
 * generation (the reconciler can backfill from logs).
 *
 * Policy:
 *   - "auto" (default) — byte-for-byte the legacy /poll behaviour.
 *   - "concierge" — the customer's `concierge_*` status is never overwritten
 *     with DGX phase names or "failed" (only the transition into `ready` is
 *     persisted); `stepDetails` still records the truth for HQ; a DGX 404
 *     writes `errorMessage` and returns `job_missing` instead of flipping the
 *     row to `failed`. Everything else is identical.
 */
import { Prisma, type YouTubeProject } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import {
  autopilot,
  AutopilotError,
  type JobStatus,
  type RunCreationResult,
  type FetchSourceResult,
} from "@/lib/vater/autopilot-client";
import {
  phaseToStatus,
  type YouTubeProjectStatus,
} from "@/lib/vater/youtube-status";
import { mergeVideoCost } from "@/lib/vater/video-cost";
import { debitForProject, refundOnFailure } from "@/lib/vater/billing/ledger";
import { hasUnmeteredStudioAccess } from "@/lib/vater/billing/check-budget";
import { appendScriptVersion } from "@/lib/vater/script-versions";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { notifyWebhooksForProject } from "@/lib/vater/api-webhooks";
import { FLAT_ACTION_PRICES } from "@/lib/vater/pricing";
import type { VaterAction } from "@/lib/vater-subscription";
import { notifyTelegram } from "@/lib/budget/notify";
import { queueVaterEvent } from "@/lib/vater/events";
import { expireProjectIfDue, nextApprovalExpiry } from "@/lib/vater/approval-expiry";
import { notifyFlowTransition } from "@/lib/vater/flow-notify";
import { readEngine } from "@/lib/vater/concierge";

/**
 * Stepped create flow (2026-08-28): the step a DGX-driven status lands on.
 * Stamped only on a status CHANGE; input statuses (draft/transcribed) keep
 * the user's own flowStep. `status` beats flowStep in deriveCreateStep, so
 * this is informational — it keeps the column honest for the Progress tab.
 */
function flowStepForStatus(status: YouTubeProjectStatus): number | null {
  switch (status) {
    case "fetching":
    case "transcribing":
      return 2;
    case "extracting_principles":
    case "scripting":
    case "verifying":
      return 4;
    case "awaiting_script_approval":
      return 5;
    case "generating_audio":
    case "aligning_captions":
    case "generating_scenes":
    case "composing_video":
      return 7;
    case "ready":
      return 8;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// stepDetails carry-over
//
// `stepDetails` is rewritten wholesale on every tick, so anything that has to
// SURVIVE a poll (when the job started, how long each phase took, whether we
// already alerted on a failure) must be read off the previous value first.
// ---------------------------------------------------------------------------

// Type aliases, not interfaces: Prisma's InputJsonValue needs an implicit
// index signature, which interfaces don't get.
type PhaseTiming = {
  startedAt: string;
  endedAt?: string;
};

type PhaseTimings = Record<string, PhaseTiming>;

interface PriorStepDetails {
  phase?: string | null;
  startedAt?: string | null;
  phaseTimings?: PhaseTimings;
  /** Job id we have already sent a Telegram failure alert for. */
  alertedJobId?: string | null;
}

function readPriorStepDetails(raw: unknown): PriorStepDetails {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const d = raw as Record<string, unknown>;
  const timings: PhaseTimings = {};
  if (d.phaseTimings && typeof d.phaseTimings === "object" && !Array.isArray(d.phaseTimings)) {
    for (const [phase, value] of Object.entries(
      d.phaseTimings as Record<string, unknown>,
    )) {
      if (!value || typeof value !== "object") continue;
      const v = value as { startedAt?: unknown; endedAt?: unknown };
      if (typeof v.startedAt !== "string") continue;
      timings[phase] = {
        startedAt: v.startedAt,
        ...(typeof v.endedAt === "string" ? { endedAt: v.endedAt } : {}),
      };
    }
  }
  return {
    phase: typeof d.phase === "string" ? d.phase : null,
    startedAt: typeof d.startedAt === "string" ? d.startedAt : null,
    phaseTimings: timings,
    alertedJobId: typeof d.alertedJobId === "string" ? d.alertedJobId : null,
  };
}

/**
 * Close out the phase we were in, open the one we're in now. Terminal jobs
 * (done/failed) close the current phase so the last stage gets a duration
 * instead of running forever in the UI.
 */
function advancePhaseTimings(
  prior: PriorStepDetails,
  nextPhase: string | null | undefined,
  terminal: boolean,
  nowIso: string,
): PhaseTimings {
  const timings: PhaseTimings = { ...(prior.phaseTimings ?? {}) };
  const prevPhase = prior.phase ?? null;

  if (nextPhase && nextPhase !== prevPhase) {
    if (prevPhase && timings[prevPhase] && !timings[prevPhase].endedAt) {
      timings[prevPhase] = { ...timings[prevPhase], endedAt: nowIso };
    }
    if (!timings[nextPhase]) timings[nextPhase] = { startedAt: nowIso };
  }
  if (terminal) {
    const current = nextPhase ?? prevPhase;
    if (current && timings[current] && !timings[current].endedAt) {
      timings[current] = { ...timings[current], endedAt: nowIso };
    }
  }
  return timings;
}

/** Telegram parse_mode is Markdown — unbalanced _ * ` [ ] 400s the send. */
function tgSafe(v: string): string {
  return v.replace(/[_*`[\]]/g, "");
}

// ---------------------------------------------------------------------------
// Phase → status translation
// `phaseToStatus()` lives in `lib/vater/youtube-status.ts` (UI agent's file)
// and is the single source of truth for the phase→status mapping. The poll
// route only adds the "done" terminal logic that disambiguates fetch-source
// from run-creation results.
// ---------------------------------------------------------------------------

function mapPhaseToStatus(
  job: JobStatus,
  currentStatus: YouTubeProjectStatus,
): YouTubeProjectStatus {
  if (job.status === "failed") return "failed";

  // `stopAfterScript` runs park at the `script_ready` phase and report
  // done — but the project is NOT finished, it's resting in the human
  // approval gate. Check this before the done-branch below, which would
  // otherwise read "a result with no final video" as `ready`.
  if (job.phase === "script_ready") return "awaiting_script_approval";

  if (job.status === "done") {
    // Disambiguate fetch-source vs run-creation based on the result shape.
    // Accept both `finalVideoUrl` (preferred) and `finalVideoPath` (legacy
    // DGX worker key) when deciding if a render completed.
    const r = (job.result ?? {}) as RunCreationResult &
      FetchSourceResult & { finalVideoPath?: string };
    if (r.finalVideoUrl || r.finalVideoPath) return "ready";
    if (r.transcript) return "transcribed";
    return currentStatus === "transcribing" || currentStatus === "fetching"
      ? "transcribed"
      : "ready";
  }

  // status === "pending" or "running" — translate the phase string.
  return phaseToStatus(job.phase) ?? currentStatus;
}

// ---------------------------------------------------------------------------
// Logging helper — surface phase transitions, never silent.
// ---------------------------------------------------------------------------
function logTransition(
  projectId: string,
  jobId: string,
  from: YouTubeProjectStatus,
  to: YouTubeProjectStatus,
  job: JobStatus,
  /** Project OWNER, not the polling session — the log belongs to the tenant. */
  ownerUserId: string | null,
) {
  if (from === to) return;

  console.log(
    `[vater/poll] project=${projectId} job=${jobId} ${from} → ${to} (phase=${job.phase}, progress=${job.progress})`,
  );

  /* Durable copy of the transition for the customer's System Log. stepDetails
   * is rewritten wholesale on every poll, so it can only ever say what is
   * happening NOW — this is the only record that survives to answer "what
   * happened an hour ago". queueVaterEvent defers the write via next/server
   * `after()` so it survives the response (a bare floating promise is killed
   * on Vercel), never throws, and never fails a render. */
  if (ownerUserId) {
    queueVaterEvent({
      userId: ownerUserId,
      kind: to === "ready" ? "render.ready" : to === "failed" ? "render.failed" : "render.phase",
      level: to === "failed" ? "error" : "info",
      message:
        to === "failed"
          ? `Render failed at phase ${job.phase ?? "unknown"}: ${job.error || "no error message"}`
          : `${from} → ${to}${job.phase ? ` (${job.phase})` : ""}`,
      projectId,
      jobId,
      data: { from, to, phase: job.phase ?? null, progress: job.progress ?? null },
    });
  }
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export type SyncPolicy = "auto" | "concierge";

export type SyncOutcome =
  | { kind: "no_job"; project: YouTubeProject }
  | { kind: "already_terminal"; project: YouTubeProject }
  | { kind: "job_missing"; project: YouTubeProject }
  | {
      kind: "synced";
      project: YouTubeProject;
      from: string;
      to: string;
      job: {
        status: string;
        phase: string | null;
        progress: number | null;
        logs: string[];
        [k: string]: unknown;
      };
    };

/**
 * Sync one project row from its Content Autopilot job. Throws whatever
 * `autopilot.getJob` throws EXCEPT a DGX 404 (→ `job_missing`); Prisma errors
 * propagate too. Billing / notification plumbing is best-effort inside.
 */
export async function syncProjectFromJob(
  project: YouTubeProject,
  opts?: { policy?: SyncPolicy },
): Promise<SyncOutcome> {
  const policy: SyncPolicy = opts?.policy ?? "auto";
  const id = project.id;

  // No active job — nothing to poll, just return the row.
  if (!project.autopilotJobId) {
    return { kind: "no_job", project };
  }

  // Already terminal — don't bother re-fetching. (Under the concierge policy
  // `concierge_in_progress` is NOT terminal — it still syncs every tick.)
  if (project.status === "ready" || project.status === "failed" || project.status === "expired") {
    return { kind: "already_terminal", project };
  }
  // Stepped flow (2026-08-28): a parked gate is owned by the human, not the
  // job. `awaiting_engine` still names the finished SCRIPT job — re-syncing it
  // would map `script_ready` back to awaiting_script_approval and undo the
  // approval. And a 7-day-old gate flips to `expired` on this read.
  if (project.status === "awaiting_engine") {
    return { kind: "already_terminal", project };
  }
  if (project.status === "awaiting_script_approval") {
    const gated = await expireProjectIfDue(project);
    if (gated.status === "expired") return { kind: "already_terminal", project: gated };
  }

  let job: JobStatus;
  try {
    job = await autopilot.getJob(project.autopilotJobId);
  } catch (err) {
    // 404 from DGX = the job vanished. Mark project failed so the UI stops
    // polling forever instead of silently swallowing. Concierge policy: the
    // customer never sees "failed" — record the error, keep their status, and
    // let the concierge tick / HQ decide what happens next.
    if (err instanceof AutopilotError && err.status === 404) {
      const errorMessage = `Autopilot job ${project.autopilotJobId} not found on DGX (${err.body || "404"})`;
      const updated = await prisma.youTubeProject.update({
        where: { id },
        data:
          policy === "concierge"
            ? { errorMessage }
            : { status: "failed", errorMessage },
      });
      console.error(
        `[vater/poll] project=${id} job=${project.autopilotJobId} 404 from autopilot — ${
          policy === "concierge" ? "errorMessage recorded (concierge)" : "marked failed"
        }`,
      );
      return { kind: "job_missing", project: updated };
    }
    // AutopilotConfigError / other AutopilotError / anything else: propagate
    // unchanged so the caller maps it (route → 500 / 502) exactly as before.
    throw err;
  }

  const currentStatus = project.status as YouTubeProjectStatus;
  const nextStatus = mapPhaseToStatus(job, currentStatus);
  logTransition(
    id,
    project.autopilotJobId,
    currentStatus,
    nextStatus,
    job,
    project.userId,
  );

  // -------------------------------------------------------------------------
  // Build the Prisma update payload (typed via Prisma.YouTubeProjectUpdateInput
  // so the JSON fields stay strict).
  // -------------------------------------------------------------------------
  // Keep a rolling tail of log lines in stepDetails so the UI has something to
  // show even if it only reads the project row (not the `job` field from the
  // poll response). The full buffer is still returned alongside under `job`.
  //
  // 6 → 60 (2026-08-10, Trey): six lines is a status blip, not a feel for what
  // the render is doing. A 100+ scene job emits a line per scene, so 60 keeps
  // roughly the last few minutes of work visible in the rolling log.
  const recentLogs = Array.isArray(job.logs)
    ? job.logs.slice(-60)
    : [];

  // Timings + the failure-alert stamp have to survive the wholesale rewrite of
  // stepDetails below, so read the previous value before building the payload.
  const prior = readPriorStepDetails(project.stepDetails);
  const nowIso = new Date().toISOString();
  const terminalJob = job.status === "done" || job.status === "failed";
  const phaseTimings = advancePhaseTimings(prior, job.phase, terminalJob, nowIso);
  // First poll of this job establishes the clock the UI counts elapsed from.
  const jobStartedAt = prior.startedAt ?? nowIso;
  // Carried forward unless this tick is the one that sends the alert.
  let alertedJobId = prior.alertedJobId ?? null;
  const shouldAlertFailure =
    job.status === "failed" && alertedJobId !== project.autopilotJobId;
  if (shouldAlertFailure) alertedJobId = project.autopilotJobId;

  const data: Prisma.YouTubeProjectUpdateInput = {
    // Concierge policy: the customer's status is owned ENTIRELY by the concierge
    // ticket, never by the DGX job. Phases / "failed" live in stepDetails (+
    // errorMessage) for HQ.
    //
    // `ready` is what puts a video in the customer's Library, and a finished
    // RENDER is not a finished VIDEO — a Fable 5 ticket still has to pass the
    // rule-155 delivery audit, and a failing audit sends it back for repair and
    // a re-compose. This used to promote the row to `ready` the moment the job
    // went done, so #55 appeared in Trey's Library at first sync, was watched in
    // its unrepaired r1 state, and then VANISHED when the repair round flipped
    // it back to `concierge_in_progress` (Jared 2026-08-29: "dont send it to
    // library unless its actually repaired"). Only the deliver route
    // (`writeConcierge(stage:"delivered", status:"ready")`) may set it now — and
    // that route does its own idempotent `debitForProject`, so nothing is
    // un-billed by deferring it.
    status: policy === "concierge" ? project.status : nextStatus,
    progress: typeof job.progress === "number" ? job.progress : project.progress,
    stepDetails: {
      phase: job.phase,
      jobId: project.autopilotJobId,
      progress: job.progress,
      jobStatus: job.status,
      logs: recentLogs,
      startedAt: jobStartedAt,
      phaseTimings,
      alertedJobId,
    } satisfies Prisma.InputJsonValue,
  };

  // Stepped flow (2026-08-28): stamp the step + start the 7-day gate clock on
  // the transition only — re-polls of a parked gate must not reset either.
  const statusChanges = typeof data.status === "string" && data.status !== currentStatus;
  if (statusChanges) {
    const step = flowStepForStatus(data.status as YouTubeProjectStatus);
    if (step) {
      data.flowStep = step;
      data.flowStepAt = new Date();
    }
    if (data.status === "awaiting_script_approval") {
      data.approvalExpiresAt = nextApprovalExpiry();
    } else if (data.status === "ready" || data.status === "failed") {
      data.approvalExpiresAt = null;
    }
  }

  let failureMessage: string | null = null;
  if (job.status === "failed") {
    failureMessage = job.error || `Autopilot job failed at phase=${job.phase}`;
    data.errorMessage = failureMessage;
    console.error(
      `[vater/poll] project=${id} job=${project.autopilotJobId} FAILED: ${failureMessage}`,
    );
  }

  // Charges to record AFTER the project row persists. Keys are idempotent
  // per autopilotJobId, so re-polls of an already-done job can't double-bill.
  const pendingCharges: Array<{
    action: VaterAction;
    costCents: number;
    idempotencyKey: string;
  }> = [];
  let generatedSceneCount = 0;

  // ── Script-review gate ─────────────────────────────────────────────────
  // A `stopAfterScript` run ends here with the draft script in `result` and
  // nothing generated yet. Persist the draft so the Script Review screen has
  // something to edit — but NEVER overwrite a script a human has already
  // touched: once the project reaches this gate the row is the source of
  // truth, and a re-poll of the same done job must not undo their edits.
  const atScriptGate = nextStatus === "awaiting_script_approval";
  if (atScriptGate) {
    const result = (job.result ?? {}) as RunCreationResult;
    const humanOwnsScript =
      project.scriptApprovedAt !== null ||
      currentStatus === "awaiting_script_approval";
    const persisted = !!result.script && !humanOwnsScript;
    if (persisted) {
      data.script = result.script;
      if (result.scriptMeta) {
        data.scriptMeta = result.scriptMeta as Prisma.InputJsonValue;
      }
      // Version history (standing spec rule 7): record the generated draft
      // the moment it lands. Human-owned re-polls never reach this branch,
      // so history can't be polluted by re-serving the same done job.
      data.scriptVersions = appendScriptVersion(
        project.scriptVersions,
        "generated",
        result.script!,
      );
    }
    if (result.sourcePrinciples !== undefined) {
      data.sourcePrinciples = result.sourcePrinciples as Prisma.InputJsonValue;
    }
    data.errorMessage = null;
    // The script WAS generated on the DGX even though no video exists yet —
    // bill it now, because the second (approved) run submits the text as a
    // user-supplied scriptOverride and is deliberately not charged for it.
    // Only on the poll that actually landed it: this project keeps polling
    // while it rests at the gate, and re-pushing the (idempotent) charge on
    // every tick would be a pointless Stripe write each time.
    if (persisted) {
      pendingCharges.push({
        action: "script",
        costCents: FLAT_ACTION_PRICES.script.priceCents,
        idempotencyKey: `script_${project.autopilotJobId}`,
      });
      console.log(
        `[vater/poll] project=${id} job=${project.autopilotJobId} SCRIPT READY — awaiting human approval (${result.script?.length ?? 0}c)`,
      );
    }
  }

  if (job.status === "done" && !atScriptGate) {
    data.errorMessage = null;
    data.completedAt = new Date();
    data.progress = 100;

    const result = (job.result ?? {}) as RunCreationResult & FetchSourceResult;

    // -- fetch-source result fields ---------------------------------------
    if (result.transcript) {
      data.transcript = result.transcript;
      data.transcriptMeta = {
        language: result.language ?? null,
        duration: result.duration ?? null,
        wordCount: result.wordCount ?? null,
      } as Prisma.InputJsonValue;
    }
    // Goal suggestions — emitted by the DGX `_suggest_goals` step during
    // fetch-source. Empty array on topic mode or LLM failure.
    if (result.goalSuggestions !== undefined) {
      data.goalSuggestions = result.goalSuggestions as Prisma.InputJsonValue;
    }
    if (result.title) data.sourceTitle = result.title;
    if (result.channel) data.sourceChannel = result.channel;

    // -- run-creation result fields ---------------------------------------
    if (result.sourcePrinciples !== undefined) {
      data.sourcePrinciples = result.sourcePrinciples as Prisma.InputJsonValue;
    }
    if (result.script) data.script = result.script;
    if (result.scriptMeta) {
      data.scriptMeta = result.scriptMeta as Prisma.InputJsonValue;
    }
    if (typeof result.verifiedScript === "boolean") {
      data.verifiedScript = result.verifiedScript;
    }
    if (result.verificationReport !== undefined) {
      data.verificationReport =
        result.verificationReport as Prisma.InputJsonValue;
    }
    // Real per-video generation cost (DGX pushes result.costs on job
    // completion — per-provider breakdown for the Library card/lightbox).
    // Costs are CUMULATIVE across every part of production — full render
    // plus later revision passes — and billing-report true-ups get
    // reconciled in after the fact, so fold this job in additively.
    // mergeVideoCost is idempotent per jobId: a re-poll of a done job
    // returns null and cannot double-count or clobber reconciled numbers.
    {
      const costs = (result as unknown as { costs?: unknown }).costs;
      if (costs && typeof costs === "object") {
        const merged = mergeVideoCost(
          project.costJson,
          costs,
          project.autopilotJobId,
        );
        if (merged) data.costJson = merged as Prisma.InputJsonValue;
      }
    }
    // -- audio: accept audioUrl OR derive from audioPath ------------------
    // The DGX worker sometimes returns an absolute fs path under `audioPath`
    // (e.g. `/home/jelly/content-autopilot/_work/<jobId>/final.wav`). If we
    // only have that, rewrite it into a tunnel-servable `/vater/file/<id>/audio`
    // key so the UI player can fetch it through the proxy.
    {
      const anyResult = result as unknown as {
        audioUrl?: string;
        audioPath?: string;
      };
      const audioCandidate = anyResult.audioUrl || anyResult.audioPath;
      if (audioCandidate) {
        if (audioCandidate.startsWith("/vater/file/")) {
          data.audioUrl = audioCandidate;
        } else {
          const m = audioCandidate.match(
            /\/([0-9a-fA-F]+)\/(?:final\.wav|audio\.wav|tts\.wav)$/,
          );
          data.audioUrl = m
            ? `/vater/file/${m[1]}/audio`
            : `/vater/file/${project.autopilotJobId}/audio`;
        }
      }
    }
    if (typeof result.audioDuration === "number") {
      data.audioDuration = result.audioDuration;
    }
    // DGX writes whisper word-timings as `result.captions`; legacy callers
    // sometimes use `result.captionTimings`. Accept either so the captions
    // actually persist (without this, captionTimings stayed empty and the
    // compose step rendered video with no burned-in subtitles — verified
    // 2026-04-25 incident: 1644-word transcript dropped on the floor).
    const anyResultForCaps = result as unknown as {
      captionTimings?: unknown;
      captions?: unknown;
    };
    const capsCandidate =
      anyResultForCaps.captionTimings ?? anyResultForCaps.captions;
    if (capsCandidate !== undefined) {
      data.captionTimings = capsCandidate as Prisma.InputJsonValue;
    }
    // DGX vater.py stores scenes as result.scenes (not result.scenesJson).
    // Normalise either field into scenesJson so the editor can load them.
    // imageUrl is rewritten to the Vercel proxy URL so browsers can load it.
    //
    // CRITICAL: when the project already has a scenesJson (e.g. after the
    // user animated scenes in the editor), MERGE per-idx rather than
    // overwrite. DGX result.scenes only carries pipeline-output fields —
    // it does NOT know about UI-side animation state (mediaType, videoUrl,
    // videoVersion, animQuality, etc). Overwriting blindly would wipe the
    // user's animation work every time poll fires a subsequent "done"
    // (e.g. after a Re-compose flips status back off "ready").
    {
      type DgxScene = {
        idx?: number;
        imagePath?: string;
        imageUrl?: string;
        startS?: number;
        endS?: number;
        beatText?: string;
        overlays?: unknown[];
        prompt?: string;
        // Phase 3 Smart Overlay flags + data — pass through unchanged.
        // Remotion's SceneRouter parses + falls back gracefully on bad data.
        isChart?: boolean;
        chartData?: unknown;
        isMap?: boolean;
        mapData?: unknown;
        isHeader?: boolean;
        headerData?: unknown;
      };
      const anyResult = result as unknown as {
        scenesJson?: unknown;
        scenes?: DgxScene[];
      };
      const existingScenes: Record<number, Record<string, unknown>> = {};
      if (Array.isArray(project.scenesJson)) {
        for (const s of project.scenesJson as Array<Record<string, unknown>>) {
          const idx = typeof s?.idx === "number" ? s.idx : -1;
          if (idx >= 0) existingScenes[idx] = s;
        }
      }
      if (Array.isArray(anyResult.scenesJson) && anyResult.scenesJson.length > 0) {
        // Alternate branch — DGX may emit `result.scenesJson` directly (rare,
        // but the poll route accepts it). Apply the SAME per-idx merge as the
        // `result.scenes` branch below; a wholesale overwrite here would
        // re-introduce the 2026-04-22 animation-wipe regression.
        generatedSceneCount = anyResult.scenesJson.length;
        data.scenesJson = (
          anyResult.scenesJson as Array<Record<string, unknown>>
        ).map((s, i) => {
          const rawIdx = typeof s?.idx === "number" ? s.idx : i;
          const existing = existingScenes[rawIdx] ?? {};
          return {
            ...existing,
            ...s,
            idx: rawIdx,
          };
        }) as Prisma.InputJsonValue;
      } else if (Array.isArray(anyResult.scenes) && anyResult.scenes.length > 0) {
        generatedSceneCount = anyResult.scenes.length;
        data.scenesJson = anyResult.scenes.map((s, i) => {
          const idx = s.idx ?? i;
          const existing = existingScenes[idx] ?? {};
          // Base = fresh values from the DGX pipeline (wins on pipeline
          // fields like beatText/startS/endS/imagePrompt in case the
          // script was re-run). Existing wins on UI-edit fields that DGX
          // doesn't know about.
          return {
            ...existing,
            idx,
            imageUrl:
              (existing.imageUrl as string | undefined) ??
              `/api/vater/youtube/${id}/scene/${idx}`,
            startS: s.startS ?? (existing.startS as number) ?? 0,
            endS: s.endS ?? (existing.endS as number) ?? 0,
            beatText: s.beatText ?? (existing.beatText as string) ?? "",
            imagePrompt:
              s.prompt ?? (existing.imagePrompt as string) ?? "",
            version: (existing.version as number) ?? 0,
            overlays: Array.isArray(s.overlays)
              ? s.overlays
              : (existing.overlays as unknown[]) ?? [],
            isChart: s.isChart === true,
            chartData:
              s.chartData ?? (existing.chartData as unknown) ?? undefined,
            isMap: s.isMap === true,
            mapData: s.mapData ?? (existing.mapData as unknown) ?? undefined,
            isHeader: s.isHeader === true,
            headerData:
              s.headerData ?? (existing.headerData as unknown) ?? undefined,
          };
        }) as Prisma.InputJsonValue;
      }
    }

    // -- final video: accept finalVideoUrl OR finalVideoPath --------------
    // DGX worker bug: some code paths populate `finalVideoPath` (absolute
    // filesystem path) instead of `finalVideoUrl` (tunnel key). Without this
    // fallback, the project row silently never gets a playable URL and the
    // final-video player shows "no video". Rewire both.
    {
      const anyResult = result as unknown as {
        finalVideoUrl?: string;
        finalVideoPath?: string;
      };
      const finalPath = anyResult.finalVideoUrl || anyResult.finalVideoPath;
      if (finalPath) {
        if (finalPath.startsWith("https://")) {
          // Blob-hosted final (uploaded DGX-side) — store the CDN URL as-is.
          data.finalVideoUrl = finalPath;
        } else if (project.finalVideoUrl?.startsWith("https://")) {
          // Never downgrade a blob URL to a DGX proxy path (a stale re-poll
          // of an old done job would otherwise clobber backfilled rows).
        } else if (finalPath.startsWith("/vater/file/")) {
          data.finalVideoUrl = finalPath;
        } else {
          const m = finalPath.match(/\/([0-9a-fA-F]+)\/final\.mp4$/);
          data.finalVideoUrl = m
            ? `/vater/file/${m[1]}/video`
            : `/vater/file/${project.autopilotJobId}/video`;
        }
      }
    }

    // ── Collect usage charges for what THIS job actually produced ─────────
    // Recorded after the DB write below, billed to the project owner.
    {
      const jobId = project.autopilotJobId;
      // Transcription (fetch-source): 50¢ per started 10 min of source audio.
      if (result.transcript) {
        const durationS =
          typeof result.duration === "number" && result.duration > 0
            ? result.duration
            : null;
        const units = durationS ? Math.max(1, Math.ceil(durationS / 600)) : 1;
        pendingCharges.push({
          action: "transcription",
          costCents: units * FLAT_ACTION_PRICES.transcription.priceCents,
          idempotencyKey: `transcription_${jobId}`,
        });
      }
      // Script (run-creation): flat 5¢ — skipped when the user supplied
      // their own script (context/topic kickoff stamps scriptMeta.source).
      const userSuppliedScript =
        typeof project.scriptMeta === "object" &&
        project.scriptMeta !== null &&
        (project.scriptMeta as { source?: unknown }).source === "user-supplied";
      if (result.script && !userSuppliedScript) {
        pendingCharges.push({
          action: "script",
          costCents: FLAT_ACTION_PRICES.script.priceCents,
          idempotencyKey: `script_${jobId}`,
        });
      }
      // Voiceover (run-creation): 20¢/min, minimum 1 minute.
      if (data.audioUrl) {
        const audioS =
          typeof result.audioDuration === "number" && result.audioDuration > 0
            ? result.audioDuration
            : null;
        const minutes = audioS ? Math.max(1, Math.ceil(audioS / 60)) : 1;
        pendingCharges.push({
          action: "voiceover",
          costCents: minutes * FLAT_ACTION_PRICES.voiceover.priceCents,
          idempotencyKey: `voiceover_${jobId}`,
        });
      }
      // Scene images (run-creation): 25¢ per generated scene.
      if (generatedSceneCount > 0) {
        pendingCharges.push({
          action: "scene",
          costCents:
            generatedSceneCount * FLAT_ACTION_PRICES.scene.priceCents,
          idempotencyKey: `scenes_${jobId}`,
        });
      }
      // Render (250¢): ONLY for compose-only jobs — kicked from the compose
      // route, which gates the budget then swaps autopilotJobId to the
      // compose job. Their result carries a final video but no
      // script/transcript/scenes. The initial run-creation also ends with a
      // final video, but its artifacts are billed piecemeal above and its
      // bundled compose is not billed as a separate render.
      if (
        data.finalVideoUrl &&
        !result.script &&
        !result.transcript &&
        generatedSceneCount === 0
      ) {
        pendingCharges.push({
          action: "render",
          costCents: FLAT_ACTION_PRICES.render.priceCents,
          idempotencyKey: `render_${jobId}`,
        });
      }
    }

    console.log(
      `[vater/poll] project=${id} job=${project.autopilotJobId} DONE — finalVideoUrl=${data.finalVideoUrl ?? "(none)"} audioUrl=${data.audioUrl ?? "(none)"} transcript=${result.transcript ? `${result.transcript.length}c` : "(none)"}`,
    );
  }

  const updated = await prisma.youTubeProject.update({
    where: { id },
    data,
  });

  // ── Stepped-flow notifications (once per transition, CAS inside) ────────
  // script_ready → step 5 email + push; ready → step 8 (Auto lane only — the
  // Fable 5 lane notifies from /deliver, which already emails). Delivery runs
  // in after(); a notify hiccup must never fail the poll.
  if (updated.status !== currentStatus) {
    try {
      if (updated.status === "awaiting_script_approval") {
        await notifyFlowTransition(id, "script_ready");
      } else if (updated.status === "ready" && readEngine(updated.settingsJson) !== "fable5") {
        await notifyFlowTransition(id, "ready");
      }
    } catch (err) {
      console.error(`[vater/poll] flow notify failed project=${id}`, err);
    }
  }

  // ── Failure alert (once per job) ─────────────────────────────────────────
  // A render that dies at 03:00 used to sit failed until someone opened the
  // Queue screen. The dedupe stamp (`stepDetails.alertedJobId`) is written by
  // the update above BEFORE the send, so a Telegram hiccup costs one alert
  // rather than looping one every 5s poll. Best-effort throughout: the caller
  // already has the project row, and notification plumbing must never turn a
  // successful poll into a 500.
  if (shouldAlertFailure && failureMessage) {
    try {
      let who = project.userId ?? "unknown user";
      if (project.userId) {
        const owner = await resolveTenantIdentity(project.userId);
        if (owner.email) who = owner.isWorkspace ? `${owner.email} (tab)` : owner.email;
      }
      await notifyTelegram(
        `⚠️ /animate render failed — ${tgSafe(who)} · project ${tgSafe(id)} · phase ${tgSafe(String(job.phase ?? "unknown"))}: ${tgSafe(failureMessage).slice(0, 500)}`,
      );
    } catch (err) {
      console.error(`[vater/poll] failure alert failed project=${id}`, err);
    }
  }

  // ── Refund a failed render (idempotent, no-op in the normal case) ────────
  // "Failed renders are never charged" is printed on the landing page and in
  // the 402 wall. Nothing is normally charged before `ready`, so this usually
  // finds no debit and returns "no_debit" — it exists for the paths that DO
  // leave a charge behind a failure: a project that reached ready, was
  // debited, and then failed a later revision pass. Dedupes on
  // `refund:<projectId>`, so the 5-second re-polls of a failed job cannot
  // refund twice. Best-effort: a refund hiccup must never 500 the poll.
  if (updated.status === "failed" && updated.userId) {
    try {
      const refund = await refundOnFailure(
        id,
        failureMessage ?? updated.errorMessage ?? "Render failed",
      );
      if (refund.refunded) {
        console.log(
          `[vater/poll] project=${id} refunded $${((refund.refundedCents ?? 0) / 100).toFixed(2)} after failure`,
        );
      }
    } catch (err) {
      console.error(`[vater/poll] refund failed project=${id}`, err);
    }
  }

  // ── Debit prepaid credits for a FINISHED video (owner-billed, once) ─────
  // This is where the customer actually pays: compute at cost + $0.35 per
  // finished minute, charged the moment the video exists and never before.
  // Failed renders reach `status: "failed"` above and are never charged.
  //
  // Idempotent twice over: the guard below only fires on the transition INTO
  // ready, and debitForProject dedupes on a UNIQUE `debit:<projectId>` key —
  // so the 5-second re-polls of an already-done job cannot bill twice.
  //
  // Unmetered owners (Jared, Trey, any VaterAccount.unmetered) settle
  // out-of-band via the Zelle render bill and must never be debited here.
  if (
    updated.status === "ready" &&
    currentStatus !== "ready" &&
    updated.finalVideoUrl &&
    updated.userId
  ) {
    try {
      const unmetered = await hasUnmeteredStudioAccess(updated.userId);
      const debit = await debitForProject(id, {
        skip: unmetered,
        skipReason: "unmetered",
      });
      console.log(
        `[vater/poll] project=${id} credit debit → ${debit.outcome}${debit.reason ? ` (${debit.reason})` : ""}${
          debit.chargedCents ? ` $${(debit.chargedCents / 100).toFixed(2)}` : ""
        }`,
      );
    } catch (err) {
      // The customer already has their video. A billing hiccup must never
      // turn a successful render into a 500 — the reconciler backfills.
      console.error(`[vater/poll] credit debit failed project=${id}`, err);
    }
  }

  // ── Record confirmed-success charges (owner-billed, idempotent) ──────────
  // Wrapped per-charge: the user already has their output, so a billing
  // failure must never 500 this response — the reconciler can backfill from
  // the error log. Legacy projects with userId=null are never billed.
  if (pendingCharges.length > 0 && project.userId) {
    for (const charge of pendingCharges) {
      try {
        await recordUsage({
          userId: project.userId,
          action: charge.action,
          projectId: id,
          idempotencyKey: charge.idempotencyKey,
          overrideCostCents: charge.costCents,
        });
      } catch (err) {
        console.error(
          `[vater/poll] recordUsage failed project=${id} action=${charge.action} key=${charge.idempotencyKey}`,
          err,
        );
      }
    }
  }

  // ── Public API completion webhook (at-most-once, best-effort) ───────────
  // Fires only on the TRANSITION into a terminal state, so the 5-second
  // re-polls of an already-done job cannot re-send. No-ops instantly when the
  // owner has no API key with a webhook configured. Never throws — see
  // lib/vater/api-webhooks.ts for why there is no retry queue.
  if (
    updated.status !== currentStatus &&
    (updated.status === "ready" || updated.status === "failed")
  ) {
    await notifyWebhooksForProject(
      id,
      updated.status === "ready" ? "video.ready" : "video.failed",
    );
  }

  return {
    kind: "synced",
    project: updated,
    from: currentStatus,
    to: nextStatus,
    job: {
      status: job.status,
      phase: job.phase,
      progress: job.progress,
      logs: job.logs ?? [],
    },
  };
}
