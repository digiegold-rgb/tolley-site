'use client';

/**
 * create-api — the fetch surface of the stepped Create flow (2026-08-28).
 *
 * Every step talks to the server through here so the URL, the body shape and
 * the error handling live in one place. A 402 becomes a BillingBlockedError
 * (the caller opens the add-credit wall); anything else becomes an ApiError
 * carrying the status and the server's message.
 */

import type { ReviewProject } from '../review/ScriptReviewScreen';
import type { RenderManifest } from '../../engine/RenderConfirmModal';
import { readBillingBlock, BillingBlockedError } from '../editor/BillingBlock';
import type { VariationDirective, VariationJson } from '@/lib/vater/create-steps';
import type {
  ScriptFidelity,
  ScriptQuote,
  ScriptWriterCharge,
  ScriptWriterModelId,
  ScriptWriterSource,
} from '@/lib/vater/script-writer-models';

/** GET /api/vater/youtube/[id] returns the whole row; this is what the steps read. */
export interface CreateProject extends ReviewProject {
  transcript?: string | null;
  flowStep?: number | null;
  flowStepAt?: string | null;
  approvalExpiresAt?: string | null;
  variationJson?: VariationJson | null;
  autopilotJobId?: string | null;
  styleId?: string | null;
  topic?: string | null;
  updatedAt?: string;
  completedAt?: string | null;
  editedAt?: string | null;
  /** Google Drive mirror of the approved script (2026-08-28). */
  driveFileUrl?: string | null;
  driveError?: string | null;
  driveSyncedAt?: string | null;
  /** On-site writer usage + billed amount (scriptMeta.writer). */
  scriptMeta?: unknown;
}

/** GET /api/vater/drive/status. */
export interface DriveStatus {
  connected: boolean;
  email: string | null;
  folderUrl: string | null;
  status: 'active' | 'revoked' | 'error' | null;
  lastError: string | null;
}

/** Where "Link Google Drive" sends the browser. `returnHash` is the studio
 *  hash WITHOUT the leading '#'; Google bounces back to
 *  `/animate?drive=connected#<returnHash>` (or `?drive=error&reason=…`). */
export function driveStartUrl(returnHash: string): string {
  return `/api/vater/drive/oauth/start?return=${encodeURIComponent(returnHash.replace(/^#/, ''))}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly data: { error?: string; detail?: string; reason?: string; status?: string };
  constructor(status: number, data: ApiError['data']) {
    super(data.detail || data.error || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function isExpiredError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.data.reason === 'expired';
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const { reason, context, data } = await readBillingBlock(res);
    if (reason) throw new BillingBlockedError(reason, context);
    throw new ApiError(res.status, data as ApiError['data']);
  }
  return (await res.json()) as T;
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export interface StyleSummary {
  id: string;
  name: string;
  emoji: string | null;
  voice: string | null;
  isSystem: boolean;
  artStylePresetId?: string | null;
  _count?: { characters: number };
}

export const createApi = {
  getProject: async (id: string): Promise<CreateProject> =>
    (await request<{ project: CreateProject }>(`/api/vater/youtube/${id}`)).project,

  /** `/poll` kicks the DGX sync; answers `{project}` when it has one. */
  pollProject: async (id: string): Promise<CreateProject | null> => {
    try {
      const data = await request<{ project?: CreateProject }>(`/api/vater/youtube/${id}/poll`);
      return data.project ?? null;
    } catch {
      return null;
    }
  },

  patchProject: async (
    id: string,
    body: Partial<{
      flowStep: number;
      transcript: string;
      sourceTitle: string;
      sourceUrl: string;
      targetDuration: number;
      script: string;
    }>,
  ): Promise<CreateProject> =>
    (await request<{ project: CreateProject }>(`/api/vater/youtube/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })).project,

  /** Same creation call StylePickerModal uses — an empty shell tied to a style. */
  createFromStyle: async (styleId: string): Promise<CreateProject> =>
    (await request<{ project: CreateProject }>('/api/vater/youtube/new-from-style', post({ styleId }))).project,

  listStyles: async (): Promise<{ styles: StyleSummary[]; lockedStyleId: string | null }> => {
    const data = await request<{ styles?: StyleSummary[]; lockedStyleId?: string | null }>(
      '/api/vater/youtube/styles',
    );
    return {
      styles: Array.isArray(data.styles) ? data.styles : [],
      lockedStyleId: typeof data.lockedStyleId === 'string' ? data.lockedStyleId : null,
    };
  },

  /** Free caption read. 422 / "no captions" → the paid whisper path. */
  importFromUrl: async (
    url: string,
  ): Promise<{ title?: string; text: string; source?: string; words?: number }> => {
    const data = await request<{ title?: string; text?: string; source?: string; words?: number }>(
      '/api/vater/script/from-url',
      post({ url }),
    );
    if (!data.text) throw new ApiError(422, { error: 'no captions' });
    return { ...data, text: data.text };
  },

  /** Paid whisper path: yt-dlp + transcribe on the DGX. */
  transcribeUrl: async (url: string, targetDuration?: number): Promise<CreateProject> =>
    (await request<{ project: CreateProject }>(
      '/api/vater/youtube',
      post({ url, ...(targetDuration && targetDuration > 0 ? { targetDuration } : {}) }),
    )).project,

  /** Step 3 confirm — leftover DGX path. The Writing step uses writeScript. */
  fromTranscript: async (body: {
    transcript: string;
    sourceUrl?: string | null;
    targetDuration?: number;
    projectId: string;
    styleId?: string | null;
  }): Promise<CreateProject> =>
    (await request<{ project: CreateProject }>(
      '/api/vater/youtube/from-transcript',
      post({
        transcript: body.transcript,
        projectId: body.projectId,
        ...(body.sourceUrl ? { sourceUrl: body.sourceUrl } : {}),
        ...(body.targetDuration && body.targetDuration > 0 ? { targetDuration: body.targetDuration } : {}),
        ...(body.styleId ? { styleId: body.styleId } : {}),
      }),
    )).project,

  writeScript: async (
    id: string,
    body: {
      model: ScriptWriterModelId;
      fidelity: ScriptFidelity;
      source: ScriptWriterSource;
      editedScript?: string;
      dryRun?: boolean;
      requestId?: string;
    },
  ): Promise<{ project?: CreateProject; quote: ScriptQuote; billed?: ScriptQuote; charge?: ScriptWriterCharge }> =>
    request(`/api/vater/youtube/${id}/write-script`, post(body)),

  /** FREE. status → awaiting_engine. */
  approveScript: async (id: string, script?: string): Promise<CreateProject> =>
    (await request<{ project: CreateProject }>(
      `/api/vater/youtube/${id}/approve-script`,
      post(script !== undefined ? { script } : {}),
    )).project,

  /** Metered re-roll at the script price. status → scripting. */
  rewrite: async (id: string, directive?: VariationDirective): Promise<CreateProject> =>
    (await request<{ project: CreateProject }>(
      `/api/vater/youtube/${id}/rewrite`,
      post(directive ? { directive } : {}),
    )).project,

  /** THE money click. */
  produce: async (id: string, engine: 'auto' | 'fable5'): Promise<{ project: CreateProject; jobId?: string }> =>
    request<{ project: CreateProject; jobId?: string }>(`/api/vater/youtube/${id}/produce`, post({ engine })),

  reopen: async (id: string): Promise<CreateProject> =>
    (await request<{ project: CreateProject }>(`/api/vater/youtube/${id}/reopen`, post({}))).project,

  preflight: async (id: string): Promise<RenderManifest> =>
    request<RenderManifest>(`/api/vater/youtube/${id}/preflight`),

  // ── Google Drive ──────────────────────────────────────────────────────
  driveStatus: async (): Promise<DriveStatus> => request<DriveStatus>('/api/vater/drive/status'),

  driveDisconnect: async (): Promise<void> => {
    await request<{ ok: boolean }>('/api/vater/drive/disconnect', post({}));
  },

  /** Re-run the Drive save for an approved row. 200 even when the save
   *  failed (`project.driveError` says why); 409 not approved; 412 not linked. */
  driveSync: async (id: string): Promise<CreateProject> =>
    (await request<{ project: CreateProject }>(`/api/vater/youtube/${id}/drive-sync`, post({}))).project,
};

export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message && err.message !== 'billing_blocked') return err.message;
  return fallback;
}
