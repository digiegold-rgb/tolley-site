'use client';

/* ScriptReviewScreen — the human gate between "reference video in" and
 * "money spent on a render".
 *
 * Pipeline the screen drives, left to right:
 *   1. Intake     — paste a reference YouTube URL. POST /api/vater/youtube
 *                   creates the project and starts yt-dlp + whisper.
 *   2. Transcript — when the row reaches `transcribed`, the poll loop fires
 *                   POST /[id]/script-from-reference, which runs the DGX
 *                   worker with `stopAfterScript`. It writes a script and
 *                   stops; nothing is rendered.
 *   3. Review     — the row rests in `awaiting_script_approval`. Jared edits
 *                   the script here and clicks Approve & Animate, which is
 *                   the ONLY thing that starts generation spend.
 *   4. Publish    — once `ready`, the publish panel stages title/description/
 *                   tags/thumbnail and uploads to YouTube on an explicit click.
 *
 * Inline styles only (v2 shell convention). The reused legacy pieces —
 * YouTubeScriptEditor here, the metadata editor's inputs in PublishPanel —
 * keep their Tailwind, matching the precedent set by the other v2 screens.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, VInput, RetryError, SectionHeader } from '../../primitives';
import { YouTubeScriptEditor } from '@/components/vater/youtube-script-editor';
import {
  IN_FLIGHT_STATUSES,
  WORDS_PER_MINUTE,
  type YouTubeProjectStatus,
} from '@/lib/vater/youtube-status';
import { PublishPanel } from './PublishPanel';

/* ─── Types ─── */

export interface ReviewProject {
  id: string;
  status: string;
  progress: number;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceChannel: string | null;
  script: string | null;
  targetWordCount: number;
  targetDuration: number;
  animUntilS: number | null;
  scriptApprovedAt: string | null;
  finalVideoUrl: string | null;
  thumbnailUrl: string | null;
  publishTitle: string | null;
  description: string | null;
  tags: string[];
  thumbnailConcept: string | null;
  youtubeVideoId: string | null;
  publishedAt: string | null;
  shortVideoUrl: string | null;
  shortDescription: string | null;
  errorMessage: string | null;
  createdAt: string;
}

interface StyleOption {
  id: string;
  name: string;
  isSystem: boolean;
}

/** One prior use of a reference video, from the 409 reused-reference gate. */
interface PriorUse {
  kind: 'project' | 'style';
  id: string;
  title: string;
  status?: string;
  usedAt?: string;
}

export type ReviewStage =
  | 'preparing'
  | 'awaiting_approval'
  | 'rendering'
  | 'ready_to_publish'
  | 'published'
  | 'failed';

const STAGE_LABELS: Record<ReviewStage, string> = {
  preparing: 'Preparing',
  awaiting_approval: 'Awaiting script approval',
  rendering: 'Rendering',
  ready_to_publish: 'Ready to publish',
  published: 'Published',
  failed: 'Failed',
};

const STAGE_COLORS: Record<ReviewStage, string> = {
  preparing: JELLY_TOKENS.accent,
  awaiting_approval: JELLY_TOKENS.brand,
  rendering: JELLY_TOKENS.accent,
  ready_to_publish: JELLY_TOKENS.success,
  published: JELLY_TOKENS.success,
  failed: JELLY_TOKENS.error,
};

export function stageOf(p: ReviewProject): ReviewStage {
  if (p.youtubeVideoId) return 'published';
  if (p.status === 'failed') return 'failed';
  if (p.status === 'awaiting_script_approval') return 'awaiting_approval';
  if (p.status === 'ready' && p.finalVideoUrl) return 'ready_to_publish';
  if (IN_FLIGHT_STATUSES.has(p.status as YouTubeProjectStatus)) {
    // Everything after the approval click is a render; everything before it
    // is still just getting the words ready.
    return p.scriptApprovedAt ? 'rendering' : 'preparing';
  }
  return 'preparing';
}

/* Every project this screen has a job for. Older library projects that never
 * went through the gate are excluded so the list stays the pipeline, not an
 * archive — they still live in Library. */
function inPipeline(p: ReviewProject): boolean {
  return (
    p.animUntilS !== null ||
    p.scriptApprovedAt !== null ||
    p.status === 'awaiting_script_approval' ||
    p.youtubeVideoId !== null
  );
}

/* ─── Screen ─── */

export function ScriptReviewScreen(): React.ReactElement {
  const { t } = useTheme();

  const [projects, setProjects] = React.useState<ReviewProject[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  const refresh = React.useCallback(async (): Promise<ReviewProject[] | null> => {
    try {
      const res = await fetch('/api/vater/youtube');
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { projects: ReviewProject[] };
      setProjects(data.projects);
      setLoadError(null);
      return data.projects;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load projects');
      return null;
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const visible = React.useMemo(() => {
    if (!projects) return [];
    return showAll ? projects : projects.filter(inPipeline);
  }, [projects, showAll]);

  const selected = React.useMemo(
    () => visible.find((p) => p.id === selectedId) ?? null,
    [visible, selectedId],
  );

  /* Default the selection to whatever most wants a human: a script waiting
   * for approval, else a finished video waiting to be published. */
  React.useEffect(() => {
    if (selectedId || visible.length === 0) return;
    const waiting =
      visible.find((p) => stageOf(p) === 'awaiting_approval') ??
      visible.find((p) => stageOf(p) === 'ready_to_publish');
    if (waiting) setSelectedId(waiting.id);
  }, [visible, selectedId]);

  /* ── Poll loop ──────────────────────────────────────────────────────────
   * Two jobs per tick: advance every in-flight project's DGX job through the
   * poll route, and auto-continue any intake project whose transcript just
   * landed. `continuing` guards against a second kickoff while the first
   * request is still in the air (the route's status gate covers the rest). */
  const continuing = React.useRef<Set<string>>(new Set());
  const [autoError, setAutoError] = React.useState<string | null>(null);

  const inFlightIds = React.useMemo(
    () =>
      (projects ?? [])
        .filter(
          (p) =>
            inPipeline(p) &&
            IN_FLIGHT_STATUSES.has(p.status as YouTubeProjectStatus),
        )
        .map((p) => p.id),
    [projects],
  );

  const pendingScriptIds = React.useMemo(
    () =>
      (projects ?? [])
        .filter((p) => p.animUntilS !== null && p.status === 'transcribed')
        .map((p) => p.id),
    [projects],
  );

  const busy = inFlightIds.length > 0 || pendingScriptIds.length > 0;

  // The tick reads the id lists through refs so a project-list refresh
  // doesn't tear down and re-arm the interval on every pass.
  const inFlightRef = React.useRef(inFlightIds);
  const pendingRef = React.useRef(pendingScriptIds);
  inFlightRef.current = inFlightIds;
  pendingRef.current = pendingScriptIds;

  React.useEffect(() => {
    if (!busy) return;
    let cancelled = false;

    const tick = async (): Promise<void> => {
      for (const id of inFlightRef.current) {
        if (cancelled) return;
        try {
          await fetch(`/api/vater/youtube/${id}/poll`);
        } catch {
          // Best-effort: the list refresh below is what the UI renders from,
          // and its failures surface in the load-error banner.
        }
      }
      for (const id of pendingRef.current) {
        if (cancelled) return;
        if (continuing.current.has(id)) continue;
        continuing.current.add(id);
        try {
          const res = await fetch(
            `/api/vater/youtube/${id}/script-from-reference`,
            { method: 'POST' },
          );
          if (!res.ok && res.status !== 409) {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
              detail?: string;
            };
            setAutoError(
              `Could not start the script: ${data.detail || data.error || `HTTP ${res.status}`}`,
            );
          } else if (res.ok) {
            setAutoError(null);
          }
        } catch (err) {
          setAutoError(
            err instanceof Error ? err.message : 'Could not start the script',
          );
        } finally {
          continuing.current.delete(id);
        }
      }
      if (cancelled) return;
      await refresh();
    };

    const interval = window.setInterval(() => {
      void tick();
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [busy, refresh]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>Script Review</div>
        <div style={{ fontSize: 14, color: t.textSecondary, marginTop: 4 }}>
          Reference video in, script out, you approve it — only then does
          anything render.
        </div>
      </div>

      <IntakeForm
        onCreated={(project) => {
          setProjects((prev) => (prev ? [project, ...prev] : [project]));
          setSelectedId(project.id);
        }}
      />

      {loadError && <RetryError message={loadError} onRetry={() => void refresh()} />}
      {autoError && <RetryError message={autoError} variant="banner" />}

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>
              Pipeline
            </div>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              style={{
                background: 'transparent',
                border: 'none',
                color: JELLY_TOKENS.brand,
                fontFamily: JELLY_TOKENS.font,
                fontSize: 12,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {showAll ? 'Show pipeline only' : 'Show all projects'}
            </button>
          </div>

          {projects === null && !loadError && (
            <div style={{ fontSize: 13, color: t.textSecondary }}>Loading…</div>
          )}
          {projects !== null && visible.length === 0 && (
            <VCard variant="flat" style={{ fontSize: 13, color: t.textSecondary }}>
              Nothing in the pipeline yet. Paste a reference video above to
              start one.
            </VCard>
          )}
          {visible.map((p) => (
            <PipelineRow
              key={p.id}
              project={p}
              active={p.id === selectedId}
              onSelect={() => setSelectedId(p.id)}
            />
          ))}
        </div>

        <div style={{ flex: '2 1 480px', minWidth: 340 }}>
          {selected ? (
            <DetailPanel
              key={selected.id}
              project={selected}
              onChanged={() => void refresh()}
            />
          ) : (
            <VCard variant="flat" style={{ fontSize: 13, color: t.textSecondary }}>
              Pick a project on the left to review its script or publish it.
            </VCard>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Intake ─── */

function IntakeForm({
  onCreated,
}: {
  onCreated: (project: ReviewProject) => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [url, setUrl] = React.useState('');
  const [minutes, setMinutes] = React.useState('4');
  const [animUntil, setAnimUntil] = React.useState('120');
  const [styles, setStyles] = React.useState<StyleOption[] | null>(null);
  const [styleId, setStyleId] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reusedWarning, setReusedWarning] = React.useState<PriorUse[] | null>(
    null,
  );

  const loadStyles = React.useCallback(async () => {
    try {
      const res = await fetch('/api/vater/youtube/styles');
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { styles: StyleOption[] };
      setStyles(data.styles);
      // The list arrives user-styles-first, most recently edited first — so
      // the head of it is the style this user is actually working in.
      if (data.styles.length > 0) setStyleId((prev) => prev || data.styles[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load styles');
    }
  }, []);

  React.useEffect(() => {
    void loadStyles();
  }, [loadStyles]);

  const submit = async (allowReusedSource = false): Promise<void> => {
    setError(null);
    if (allowReusedSource) setReusedWarning(null);
    const targetDuration = Number.parseInt(minutes, 10);
    const animUntilS = Number.parseInt(animUntil, 10);
    if (!/^https?:\/\/.+\..+/.test(url.trim())) {
      setError('Paste a full reference video URL (https://…).');
      return;
    }
    if (!Number.isFinite(targetDuration) || targetDuration < 1) {
      setError('Target length must be at least 1 minute.');
      return;
    }
    if (!Number.isFinite(animUntilS) || animUntilS < 0) {
      setError('Animate-first must be 0 seconds or more.');
      return;
    }
    if (!styleId) {
      setError('Pick a style — it carries the voice and the look.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/vater/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          targetDuration,
          // A zero here means "no animation at all"; the column stays the
          // pipeline marker either way, so store at least 1s of intent.
          animUntilS: Math.max(1, animUntilS),
          styleId,
          ...(allowReusedSource ? { allowReusedSource: true } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        project?: ReviewProject;
        error?: string;
        detail?: string;
        priorUses?: PriorUse[];
      };
      // Reused-reference gate: the API refuses with a 409 listing where this
      // video was used before. Show the warning and offer an explicit bypass.
      if (res.status === 409 && data.error === 'reference_already_used') {
        setReusedWarning(data.priorUses ?? []);
        return;
      }
      if (!res.ok || !data.project) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      setReusedWarning(null);
      onCreated(data.project);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the video');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VCard variant="flat" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="scriptReview"
        title="New video from reference"
        description="Transcribes the reference, writes an original script, then waits for you."
      />

      <VInput
        label="Reference video URL"
        value={url}
        onChange={setUrl}
        placeholder="https://youtu.be/…"
      />

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <VInput
          label="Target length (minutes)"
          value={minutes}
          onChange={setMinutes}
          style={{ flex: '1 1 160px' }}
          helper={`≈ ${(Number.parseInt(minutes, 10) || 0) * WORDS_PER_MINUTE} words`}
        />
        <VInput
          label="Animate first (seconds)"
          value={animUntil}
          onChange={setAnimUntil}
          style={{ flex: '1 1 160px' }}
          helper="Rest of the video runs as Ken Burns stills"
        />
        <div style={{ flex: '1 1 200px' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: t.textSecondary,
              marginBottom: 6,
            }}
          >
            Style
          </div>
          <select
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
            style={{
              width: '100%',
              fontSize: 16,
              fontFamily: JELLY_TOKENS.font,
              border: `1px solid ${t.border}`,
              borderRadius: JELLY_TOKENS.radius.md,
              background: t.card,
              color: t.text,
              outline: 'none',
              boxSizing: 'border-box',
              padding: 14,
            }}
          >
            {styles === null && <option value="">Loading…</option>}
            {styles?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isSystem ? ' (system)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <RetryError message={error} />}

      {reusedWarning && (
        <div
          style={{
            border: '1px solid #eab308',
            background: 'rgba(234, 179, 8, 0.08)',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 600 }}>
            ⚠ You&apos;ve used this reference video before
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, color: t.textSecondary }}>
            {reusedWarning.map((u) => (
              <li key={`${u.kind}-${u.id}`}>
                {u.kind === 'project' ? (
                  <>
                    Source of project “{u.title}”
                    {u.status ? ` (${u.status})` : ''}
                    {u.usedAt
                      ? ` — ${new Date(u.usedAt).toLocaleDateString()}`
                      : ''}
                  </>
                ) : (
                  <>Style reference in “{u.title}”</>
                )}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8 }}>
            <VBtn
              onClick={() => void submit(true)}
              disabled={submitting}
              icon="sparkle"
            >
              {submitting ? 'Starting…' : 'Use it anyway'}
            </VBtn>
            <VBtn variant="ghost" onClick={() => setReusedWarning(null)}>
              Cancel
            </VBtn>
          </div>
        </div>
      )}

      {!reusedWarning && (
        <div>
          <VBtn onClick={() => void submit()} disabled={submitting} icon="sparkle">
            {submitting ? 'Starting…' : 'Transcribe & write script'}
          </VBtn>
        </div>
      )}
    </VCard>
  );
}

/* ─── Pipeline list ─── */

function PipelineRow({
  project,
  active,
  onSelect,
}: {
  project: ReviewProject;
  active: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const stage = stageOf(project);
  const color = STAGE_COLORS[stage];
  const title =
    project.publishTitle || project.sourceTitle || project.sourceUrl || 'Untitled';

  return (
    <VCard
      variant="flat"
      onClick={onSelect}
      style={{
        padding: 14,
        borderColor: active ? JELLY_TOKENS.brandOutline : t.border,
        background: active ? JELLY_TOKENS.brandGhost : t.card,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: t.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color,
            background: `${color}1A`,
            padding: '3px 10px',
            borderRadius: JELLY_TOKENS.radius.pill,
          }}
        >
          {STAGE_LABELS[stage]}
        </span>
        {stage === 'rendering' && (
          <span style={{ fontSize: 11, color: t.textSecondary }}>
            {project.progress}%
          </span>
        )}
        {project.sourceChannel && (
          <span style={{ fontSize: 11, color: t.textSecondary }}>
            {project.sourceChannel}
          </span>
        )}
      </div>
    </VCard>
  );
}

/* ─── Detail ─── */

function DetailPanel({
  project,
  onChanged,
}: {
  project: ReviewProject;
  onChanged: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const stage = stageOf(project);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {project.errorMessage && (
        <RetryError message={project.errorMessage} variant="banner" />
      )}

      {stage === 'awaiting_approval' && (
        <ReviewPanel project={project} onChanged={onChanged} />
      )}

      {(stage === 'ready_to_publish' || stage === 'published') && (
        <PublishPanel project={project} onChanged={onChanged} />
      )}

      {(stage === 'preparing' || stage === 'rendering' || stage === 'failed') && (
        <VCard variant="flat" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {project.sourceTitle || project.sourceUrl || 'Untitled'}
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary }}>
            {stage === 'failed'
              ? 'This project failed — the error is above.'
              : stage === 'rendering'
                ? `Rendering the approved script — ${project.progress}% done.`
                : 'Transcribing the reference and writing the script. The review panel opens here when it is ready.'}
          </div>
          {project.script && (
            <div
              style={{
                maxHeight: 220,
                overflowY: 'auto',
                fontSize: 12,
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                color: t.textSecondary,
                background: t.cardAlt,
                borderRadius: JELLY_TOKENS.radius.md,
                padding: 12,
              }}
            >
              {project.script}
            </div>
          )}
        </VCard>
      )}
    </div>
  );
}

/* ─── Review panel ─── */

function ReviewPanel({
  project,
  onChanged,
}: {
  project: ReviewProject;
  onChanged: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [script, setScript] = React.useState(project.script ?? '');
  const [saving, setSaving] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const words = React.useMemo(
    () => script.split(/\s+/).filter(Boolean).length,
    [script],
  );
  const runtimeMin = words / WORDS_PER_MINUTE;

  const save = async (next: string): Promise<void> => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setScript(next);
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the script');
    } finally {
      setSaving(false);
    }
  };

  /* Regenerate = run the DGX scripting stage again, still stopping before any
   * render. The new draft replaces this one when it lands — the poll route
   * only protects an edited script once the row is back at the gate. */
  const regenerate = async (): Promise<void> => {
    setError(null);
    setRegenerating(true);
    try {
      const res = await fetch(
        `/api/vater/youtube/${project.id}/script-from-reference`,
        { method: 'POST' },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      onChanged();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not regenerate the script',
      );
    } finally {
      setRegenerating(false);
    }
  };

  const approve = async (): Promise<void> => {
    setError(null);
    setApproving(true);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/approve-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the render');
    } finally {
      setApproving(false);
    }
  };

  return (
    <VCard variant="flat" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="scriptReview"
        title={project.sourceTitle || 'Script review'}
        description="Edit freely. Nothing is generated until you approve."
      />

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
        <Stat label="Words" value={words.toLocaleString()} />
        <Stat
          label="Estimated runtime"
          value={`${Math.floor(runtimeMin)}m ${Math.round((runtimeMin % 1) * 60)}s`}
        />
        <Stat
          label="Animated window"
          value={project.animUntilS ? `first ${project.animUntilS}s` : 'stills only'}
        />
      </div>

      <YouTubeScriptEditor
        script={script}
        targetWordCount={project.targetWordCount || project.targetDuration * WORDS_PER_MINUTE}
        onSave={(next) => void save(next)}
        onRegenerate={() => void regenerate()}
        isRegenerating={regenerating}
      />

      {error && <RetryError message={error} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <VBtn
          onClick={() => void approve()}
          disabled={approving || saving || regenerating || words === 0}
          icon="play"
        >
          {approving ? 'Starting render…' : 'Approve & Animate'}
        </VBtn>
        <span style={{ fontSize: 12, color: t.textSecondary }}>
          {saving
            ? 'Saving…'
            : saved
              ? 'Saved. Approving sends this exact text to the renderer.'
              : 'Approving sends the text above to the renderer.'}
        </span>
      </div>
    </VCard>
  );
}

export function Stat({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.ReactElement {
  const { t } = useTheme();
  return (
    <div>
      <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{value}</div>
    </div>
  );
}
