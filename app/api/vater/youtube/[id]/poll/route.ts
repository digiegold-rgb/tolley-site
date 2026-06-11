/**
 * GET /api/vater/youtube/[id]/poll
 *
 * Polls the Content Autopilot job tracked on a `YouTubeProject` row, translates
 * the DGX-side phase into a tolley-site-side `YouTubeProjectStatus`, and on
 * completion copies all artifacts (script, audio, scenes, captions, final
 * video) into the project row.
 *
 * No silent catches — autopilot client errors bubble up as a 502 with the
 * specific endpoint that failed (per `feedback_silent_failures_leads.md`).
 *
 * Billing: this route is the server-side completion hook for the async
 * kickoff routes (project-create/title-channel → fetch-source, context →
 * run-creation, compose → re-render). When a job flips to "done" we record
 * usage for the artifacts it actually produced — transcription, voiceover,
 * scene images, and (for compose-only jobs) the render. All charges are
 * idempotent per autopilotJobId, charged to the project OWNER (not the
 * polling session — admins polling customer projects must not be billed),
 * and wrapped in try/catch so a billing hiccup never 500s a successful
 * generation (the reconciler can backfill from logs).
 */
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  autopilot,
  AutopilotError,
  AutopilotConfigError,
  type JobStatus,
  type RunCreationResult,
  type FetchSourceResult,
} from "@/lib/vater/autopilot-client";
import {
  phaseToStatus,
  type YouTubeProjectStatus,
} from "@/lib/vater/youtube-status";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { FLAT_ACTION_PRICES } from "@/lib/vater/pricing";
import type { VaterAction } from "@/lib/vater-subscription";

type Ctx = { params: Promise<{ id: string }> };

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
) {
  if (from !== to) {
    console.log(
      `[vater/poll] project=${projectId} job=${jobId} ${from} → ${to} (phase=${job.phase}, progress=${job.progress})`,
    );
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const project = await prisma.youTubeProject.findUnique({ where: { id } });
  if (
    !project ||
    !canAccessProject(project.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // No active job — nothing to poll, just return the row.
  if (!project.autopilotJobId) {
    return NextResponse.json({ project });
  }

  // Already terminal — don't bother re-fetching.
  if (project.status === "ready" || project.status === "failed") {
    return NextResponse.json({ project });
  }

  let job: JobStatus;
  try {
    job = await autopilot.getJob(project.autopilotJobId);
  } catch (err) {
    if (err instanceof AutopilotConfigError) {
      console.error(`[vater/poll] config error: ${err.message}`);
      return NextResponse.json(
        { error: err.message, project },
        { status: 500 },
      );
    }
    if (err instanceof AutopilotError) {
      // 404 from DGX = the job vanished. Mark project failed so the UI stops
      // polling forever instead of silently swallowing.
      if (err.status === 404) {
        const updated = await prisma.youTubeProject.update({
          where: { id },
          data: {
            status: "failed",
            errorMessage: `Autopilot job ${project.autopilotJobId} not found on DGX (${err.body || "404"})`,
          },
        });
        console.error(
          `[vater/poll] project=${id} job=${project.autopilotJobId} 404 from autopilot — marked failed`,
        );
        return NextResponse.json({ project: updated });
      }
      console.error(`[vater/poll] autopilot error: ${err.message}`);
      return NextResponse.json(
        { error: err.message, project },
        { status: 502 },
      );
    }
    throw err;
  }

  const currentStatus = project.status as YouTubeProjectStatus;
  const nextStatus = mapPhaseToStatus(job, currentStatus);
  logTransition(id, project.autopilotJobId, currentStatus, nextStatus, job);

  // -------------------------------------------------------------------------
  // Build the Prisma update payload (typed via Prisma.YouTubeProjectUpdateInput
  // so the JSON fields stay strict).
  // -------------------------------------------------------------------------
  // Keep the last 6 log lines in stepDetails so the UI has something to show
  // even if it only reads the project row (not the `job` field from the
  // poll response). The full buffer is still returned alongside under `job`.
  const recentLogs = Array.isArray(job.logs)
    ? job.logs.slice(-6)
    : [];

  const data: Prisma.YouTubeProjectUpdateInput = {
    status: nextStatus,
    progress: typeof job.progress === "number" ? job.progress : project.progress,
    stepDetails: {
      phase: job.phase,
      jobId: project.autopilotJobId,
      progress: job.progress,
      jobStatus: job.status,
      logs: recentLogs,
    } satisfies Prisma.InputJsonValue,
  };

  if (job.status === "failed") {
    data.errorMessage =
      job.error || `Autopilot job failed at phase=${job.phase}`;
    console.error(
      `[vater/poll] project=${id} job=${project.autopilotJobId} FAILED: ${data.errorMessage}`,
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

  if (job.status === "done") {
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
        if (finalPath.startsWith("/vater/file/")) {
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

  return NextResponse.json({
    project: updated,
    job: {
      status: job.status,
      phase: job.phase,
      progress: job.progress,
      logs: job.logs ?? [],
    },
  });
}
