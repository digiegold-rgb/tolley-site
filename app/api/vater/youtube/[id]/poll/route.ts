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
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    if (result.captionTimings !== undefined) {
      data.captionTimings = result.captionTimings as Prisma.InputJsonValue;
    }
    // DGX vater.py stores scenes as result.scenes (not result.scenesJson).
    // Normalise either field into scenesJson so the editor can load them.
    // imageUrl is rewritten to the Vercel proxy URL so browsers can load it.
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
      if (anyResult.scenesJson !== undefined) {
        data.scenesJson = anyResult.scenesJson as Prisma.InputJsonValue;
      } else if (Array.isArray(anyResult.scenes) && anyResult.scenes.length > 0) {
        data.scenesJson = anyResult.scenes.map((s, i) => ({
          idx: s.idx ?? i,
          imageUrl: `/api/vater/youtube/${id}/scene/${s.idx ?? i}`,
          startS: s.startS ?? 0,
          endS: s.endS ?? 0,
          beatText: s.beatText ?? "",
          imagePrompt: s.prompt ?? "",
          version: 0,
          overlays: Array.isArray(s.overlays) ? s.overlays : [],
          // Phase 3 — overlay flags pass through unchanged
          isChart: s.isChart === true,
          chartData: s.chartData ?? undefined,
          isMap: s.isMap === true,
          mapData: s.mapData ?? undefined,
          isHeader: s.isHeader === true,
          headerData: s.headerData ?? undefined,
        })) as Prisma.InputJsonValue;
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

    console.log(
      `[vater/poll] project=${id} job=${project.autopilotJobId} DONE — finalVideoUrl=${data.finalVideoUrl ?? "(none)"} audioUrl=${data.audioUrl ?? "(none)"} transcript=${result.transcript ? `${result.transcript.length}c` : "(none)"}`,
    );
  }

  const updated = await prisma.youTubeProject.update({
    where: { id },
    data,
  });

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
