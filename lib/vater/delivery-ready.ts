/**
 * lib/vater/delivery-ready.ts — pure "is this Animate file library-ready?"
 *
 * Client-safe. No prisma, no fetch. The server verifier (delivery-verify.ts)
 * HEADs the mp4 and persists; this file is the shared predicate so Library,
 * Progress, and the status chips cannot hide a finished stitch behind
 * `concierge_in_progress` / Moving Now / audit-missing.
 *
 * 2026-08-30 #66 (F5-608GTB): Spark finished (phase done, progress 100,
 * finalVideoUrl live ~83MB, render.ready logged) but the row stayed
 * `concierge_in_progress` / flowStep 7 because concierge policy deferred
 * `ready` to POST /deliver, and /deliver 409'd on audit_missing. The file
 * sat in Moving Now, invisible in the Library grid.
 */

export const READY_FLOW_STEP = 8;

/** Statuses a finished stitch can be stranded on. */
export const STUCK_BEFORE_READY = [
  "concierge_in_progress",
  "concierge_queued",
  "concierge_needs_info",
  "composing_video",
  "generating_scenes",
  "generating_audio",
  "aligning_captions",
  "editing",
] as const;

export type StuckBeforeReadyStatus = (typeof STUCK_BEFORE_READY)[number];

export function isStuckBeforeReadyStatus(
  status: string | null | undefined,
): status is StuckBeforeReadyStatus {
  return !!status && (STUCK_BEFORE_READY as readonly string[]).includes(status);
}

/** The subset of a YouTubeProject row delivery checks need. */
export interface DeliveryRow {
  status?: string | null;
  finalVideoUrl?: string | null;
  progress?: number | null;
  completedAt?: Date | string | null;
  autopilotJobId?: string | null;
  flowStep?: number | null;
  stepDetails?: unknown;
  /** Ticket compose job, or read from settingsJson.concierge.composeJobId. */
  composeJobId?: string | null;
  settingsJson?: unknown;
}

export interface StepDetailsView {
  phase: string | null;
  jobStatus: string | null;
  progress: number | null;
  jobId: string | null;
}

export function readStepDetails(raw: unknown): StepDetailsView {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { phase: null, jobStatus: null, progress: null, jobId: null };
  }
  const o = raw as Record<string, unknown>;
  const phase = typeof o.phase === "string" && o.phase ? o.phase : null;
  const jobStatus = typeof o.jobStatus === "string" && o.jobStatus ? o.jobStatus : null;
  const jobId = typeof o.jobId === "string" && o.jobId ? o.jobId : null;
  const progress =
    typeof o.progress === "number" && Number.isFinite(o.progress) ? o.progress : null;
  return { phase, jobStatus, progress, jobId };
}

export function composeJobIdOf(row: DeliveryRow): string | null {
  if (typeof row.composeJobId === "string" && row.composeJobId) return row.composeJobId;
  const settings = row.settingsJson;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
  const ticket = (settings as { concierge?: unknown }).concierge;
  if (!ticket || typeof ticket !== "object" || Array.isArray(ticket)) return null;
  const id = (ticket as { composeJobId?: unknown }).composeJobId;
  return typeof id === "string" && id ? id : null;
}

/**
 * Stitch/render is done. Matches the fields Spark wrote on #66:
 * stepDetails.phase = done, jobStatus = done, progress 100, completedAt set.
 */
export function isStitchJobDone(row: DeliveryRow): boolean {
  const d = readStepDetails(row.stepDetails);
  if (d.jobStatus === "done") return true;
  if (d.phase === "done") return true;
  if (d.progress != null && d.progress >= 100) return true;
  if (typeof row.progress === "number" && row.progress >= 100) return true;
  if (row.completedAt) {
    const t =
      typeof row.completedAt === "string"
        ? Date.parse(row.completedAt)
        : row.completedAt.getTime();
    if (Number.isFinite(t) && t > 0) return true;
  }
  return false;
}

/**
 * A re-compose just swapped autopilotJobId to the new compose job, but
 * stepDetails still describe the PREVIOUS done stitch. Promoting that
 * would bounce the row back to ready while Spark is still sewing.
 */
export function isWatchingUnsyncedCompose(row: DeliveryRow): boolean {
  const composeId = composeJobIdOf(row);
  const watching = row.autopilotJobId;
  if (!composeId || !watching || watching !== composeId) return false;
  const d = readStepDetails(row.stepDetails);
  if (!d.jobId) return false;
  return d.jobId !== composeId;
}

export function hasHttpsFinalUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("https://");
}

export type FinalVideoProbe = {
  ok: boolean;
  status: number | null;
  contentType: string | null;
  contentLength: number;
  reason?: string;
};

export type ProbeFn = (url: string) => Promise<FinalVideoProbe>;

const HEAD_TIMEOUT_MS = 6_000;

function parseLength(headers: Headers): number {
  const cl = headers.get("content-length");
  if (cl) {
    const n = Number(cl);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const cr = headers.get("content-range");
  const m = cr?.match(/\/(\d+)\s*$/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function isVideoType(contentType: string | null, url: string): boolean {
  if (contentType && contentType.toLowerCase().startsWith("video/")) return true;
  if (contentType && /^application\/octet-stream\b/i.test(contentType) && /\.mp4(\?|$)/i.test(url)) {
    return true;
  }
  return false;
}

/** HEAD the final URL. No Spark. Used by the server verifier and tests. */
export async function probeFinalVideo(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FinalVideoProbe> {
  if (!hasHttpsFinalUrl(url)) {
    return { ok: false, status: null, contentType: null, contentLength: 0, reason: "not_https" };
  }
  try {
    const res = await fetchImpl(url, {
      method: "HEAD",
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
    });
    const contentType = res.headers.get("content-type");
    const contentLength = parseLength(res.headers);
    const ok = res.status === 200 && isVideoType(contentType, url) && contentLength > 0;
    return {
      ok,
      status: res.status,
      contentType,
      contentLength,
      reason: ok
        ? undefined
        : res.status !== 200
          ? `http_${res.status}`
          : !isVideoType(contentType, url)
            ? "not_video"
            : "zero_length",
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      contentType: null,
      contentLength: 0,
      reason: err instanceof Error ? err.message.slice(0, 160) : "head_failed",
    };
  }
}

/**
 * File-side ready: a final URL exists, the stitch job is done, and we are
 * not mid-repoint onto a new compose. Does NOT require an audit artifact.
 */
export function rowLooksFileReady(row: DeliveryRow): boolean {
  if (!row.finalVideoUrl) return false;
  if (isWatchingUnsyncedCompose(row)) return false;
  return isStitchJobDone(row);
}

/** Persist candidate: file-ready but the library row is still in-flight. */
export function rowNeedsReadyPromote(row: DeliveryRow): boolean {
  if (!rowLooksFileReady(row)) return false;
  if (row.status === "failed" || row.status === "expired") return false;
  if (row.status === "ready") {
    return row.flowStep != null && row.flowStep < READY_FLOW_STEP;
  }
  return isStuckBeforeReadyStatus(row.status);
}

/**
 * Concierge /poll used to keep `concierge_*` even when the job mapped to
 * `ready`, then log `render.ready` anyway. If the mapped next status is
 * ready, persist ready — for every lane.
 */
export function persistStatusForSync(
  policy: "auto" | "concierge",
  currentStatus: string,
  nextStatus: string,
): string {
  if (policy === "concierge" && nextStatus !== "ready") return currentStatus;
  return nextStatus;
}

/**
 * A QA / stage write must not clobber an already-delivered row back to
 * `concierge_in_progress`. A NEW autopilot job (compose / kickoff / repoint)
 * is the operator starting more work — that may leave `ready`.
 */
export function shouldPreserveReadyStatus(args: {
  currentStatus: string;
  incomingStatus?: string | null;
  incomingAutopilotJobId?: string | null;
}): boolean {
  if (args.currentStatus !== "ready") return false;
  const incoming = args.incomingStatus;
  if (!incoming || incoming === "ready") return false;
  if (typeof args.incomingAutopilotJobId === "string" && args.incomingAutopilotJobId) {
    return false;
  }
  if (incoming === "scripted" || incoming === "failed" || incoming === "expired") {
    return false;
  }
  return true;
}

export function incomingAutopilotJobId(extra: unknown): string | null {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return null;
  const v = (extra as { autopilotJobId?: unknown }).autopilotJobId;
  if (typeof v === "string" && v) return v;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const set = (v as { set?: unknown }).set;
    if (typeof set === "string" && set) return set;
  }
  return null;
}

export type AuditWarningCode = "audit_missing" | "audit_failed";

export interface AuditDeliveryWarning {
  code: AuditWarningCode;
  message: string;
  hardFails?: number;
  sceneCount?: number;
  round?: number;
  reportUrl?: string | null;
}

/**
 * Audit / QA / scene-fail reports are warnings. They must never block
 * library visibility or /deliver of a live final.
 */
export function auditDeliveryWarning(
  audit: {
    passed?: boolean;
    hardFails?: number;
    sceneCount?: number;
    round?: number;
    reportUrl?: string | null;
  } | null | undefined,
  matchesFinal: boolean,
): AuditDeliveryWarning | null {
  if (!audit || !matchesFinal) {
    return {
      code: "audit_missing",
      message:
        "no delivery audit for this final yet — delivering the file anyway (audit is a warning, not a gate)",
    };
  }
  if (!audit.passed) {
    return {
      code: "audit_failed",
      message: `delivery audit r${audit.round ?? "?"} FAILED — ${audit.hardFails ?? "?"}/${audit.sceneCount ?? "?"} scenes with hard failures; delivering the file anyway`,
      hardFails: audit.hardFails,
      sceneCount: audit.sceneCount,
      round: audit.round,
      reportUrl: audit.reportUrl ?? null,
    };
  }
  return null;
}
