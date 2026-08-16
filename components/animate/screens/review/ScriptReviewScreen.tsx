'use client';

/* ScriptReviewScreen — the human gate between "a script" and "money spent on
 * a render".
 *
 * Rewritten 2026-08-10 (Trey): the reference-video lane is GONE. Trey supplies
 * the script himself, so there is nothing to download, nothing to transcribe,
 * and no LLM scripting pass to pay for. The screen is now:
 *
 *   1. Intake  — paste or upload the script. POST /api/vater/youtube/from-script
 *                creates the project ALREADY PARKED at the approval gate. No
 *                DGX call, no spend.
 *   2. Review  — the row rests in `awaiting_script_approval`. Trey reads,
 *                edits, and saves the script here (saves are versioned), then
 *                clicks Approve & Animate — the ONLY thing that starts spend.
 *   3. Publish — once `ready`, the publish panel stages title/description/
 *                tags/thumbnail and uploads to YouTube on an explicit click.
 *
 * Style is no longer a picker: every video ships in the locked "Jeff Whitfield
 * 3-D style" (lib/vater/locked-style.ts). The screen shows what it's bound to
 * and refuses to hide a missing style behind a silent fallback.
 *
 * Inline styles only (v2 shell convention).
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { useTier } from '../../tier-context';
import { VBtn, VCard, VInput, RetryError, SectionHeader } from '../../primitives';
import {
  lengthMessageFor,
  WORDS_PER_MINUTE,
  isOverLength,
  runtimeClock,
} from '@/lib/vater/script-limits';
import {
  CREATION_PHASES,
  IN_FLIGHT_STATUSES,
  queueLabel,
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
  /** Append-only script history (standing spec rule 7), oldest first. */
  scriptVersions: ScriptVersion[] | null;
  /** Live worker state, refreshed by the 5s poll. Drives the rolling log. */
  stepDetails: StepDetails | null;
  /** Optional feature bag (jelly-feature-contract 2026-08-16). Read it with
   *  readFeatures() from lib/vater/project-features — never raw. */
  settingsJson?: unknown;
}

/** One entry of `stepDetails.phaseTimings` — when a DGX phase ran. */
export interface PhaseTiming {
  startedAt: string;
  /** Absent while the phase is still running. */
  endedAt?: string;
}

/** What `/api/vater/youtube/[id]/poll` writes onto the row each tick. */
export interface StepDetails {
  phase?: string | null;
  jobId?: string | null;
  progress?: number | null;
  jobStatus?: string | null;
  /** Rolling tail of worker log lines, oldest first. */
  logs?: string[] | null;
  /** First poll of this job — the clock elapsed time counts from. */
  startedAt?: string | null;
  /** Per-phase start/end, accumulated across polls. */
  phaseTimings?: Record<string, PhaseTiming> | null;
  /** Internal: job we already sent a failure alert for. Not shown. */
  alertedJobId?: string | null;
}

export interface ScriptVersion {
  ts: string;
  source: 'generated' | 'edited' | 'approved';
  script: string;
}

interface LockedStyle {
  id: string;
  name: string;
  voice: string;
  customArtStyleName: string | null;
  characterNames: string[];
}

const wordsIn = (s: string): number => s.split(/\s+/).filter(Boolean).length;

/* Runtime is quoted as m:ss everywhere now (`runtimeClock` in
 * lib/vater/script-limits) so the beta ceiling reads as "9:00" in the copy,
 * the counter, and the error message alike. */

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
   * Only renders are in flight now — the script arrives with the project, so
   * there is no transcript to wait on and nothing to auto-continue. */
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

  const busy = inFlightIds.length > 0;

  // The tick reads the id list through a ref so a project-list refresh doesn't
  // tear down and re-arm the interval on every pass.
  const inFlightRef = React.useRef(inFlightIds);
  inFlightRef.current = inFlightIds;

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
          Your script in, edited and saved here, you approve it — only then does
          anything render.
        </div>
      </div>

      <ScriptIntake
        onCreated={(project) => {
          setProjects((prev) => (prev ? [project, ...prev] : [project]));
          setSelectedId(project.id);
        }}
      />

      {loadError && <RetryError message={loadError} onRetry={() => void refresh()} />}

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
              Nothing in the pipeline yet. Paste a script above to start one.
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

/* ─── Locked style card ───────────────────────────────────────────────────
 * There is exactly one style now. This is a status readout, not a control:
 * it exists so a missing/renamed style row is visible BEFORE Trey spends a
 * render finding out, not so a different look can be chosen. */

function LockedStyleCard(): React.ReactElement {
  const { t } = useTheme();
  const [style, setStyle] = React.useState<LockedStyle | null>(null);
  const [expected, setExpected] = React.useState('Jeff Whitfield 3-D style');
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/vater/youtube/locked-style');
        if (!res.ok) return;
        const data = (await res.json()) as {
          style: LockedStyle | null;
          expectedName: string;
        };
        if (cancelled) return;
        setStyle(data.style);
        if (data.expectedName) setExpected(data.expectedName);
      } catch {
        /* the intake POST surfaces a real error if the style is truly gone */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const missing = loaded && !style;

  return (
    <div
      style={{
        border: `1px solid ${missing ? JELLY_TOKENS.error : t.border}`,
        background: missing ? 'rgba(239, 68, 68, 0.06)' : t.cardAlt,
        borderRadius: JELLY_TOKENS.radius.md,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 11, color: t.textSecondary, letterSpacing: 0.3 }}>
        VIDEO STYLE — LOCKED
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>
        {style?.name || expected}
      </div>
      {missing ? (
        <div style={{ fontSize: 12, color: JELLY_TOKENS.error }}>
          No “{expected}” style found on this account. Create it in Styles —
          rendering is blocked until it exists.
        </div>
      ) : (
        <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
          {style
            ? `${style.characterNames.join(' · ') || 'Jeff Whitfield'} · voice ${style.voice}${
                style.customArtStyleName ? ` · ${style.customArtStyleName}` : ''
              }`
            : 'Jeff Whitfield · voice Monroe · Finance Pixar 3D'}
          <br />
          Every video uses this style. Backgrounds and wardrobe vary scene to
          scene; Jeff is the host, Linda appears when the script calls for her.
        </div>
      )}
    </div>
  );
}

/* ─── Intake ─── */

function ScriptIntake({
  onCreated,
}: {
  onCreated: (project: ReviewProject) => void;
}): React.ReactElement {
  const { t } = useTheme();
  const { tier, maxWords } = useTier();
  const [title, setTitle] = React.useState('');
  const [script, setScript] = React.useState('');
  const [animUntil, setAnimUntil] = React.useState('120');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const words = React.useMemo(() => wordsIn(script), [script]);
  /* The ceiling comes from GET /api/vater/me (TierContext), which is the SAME
   * number lib/vater/billing/script-cap.ts hands the from-script route: the
   * owner is uncapped, an account with purchased credit gets ~20:00, and
   * everyone else ~9:00. Hardcoding the beta cap here is what made a paying
   * account's Approve button grey out at a limit the API had already raised. */
  const isOwner = tier === 'owner';
  const overLimit = isOverLength(words, maxWords);
  const lengthMessage = lengthMessageFor(maxWords);

  const readFile = async (file: File): Promise<void> => {
    setError(null);
    if (file.size > 2 * 1024 * 1024) {
      setError('That file is over 2 MB — paste the text instead.');
      return;
    }
    try {
      const text = await file.text();
      setScript(text.trim());
      if (!title.trim()) {
        setTitle(file.name.replace(/\.(txt|md|markdown|rtf)$/i, '').slice(0, 120));
      }
    } catch {
      setError('Could not read that file. Paste the text instead.');
    }
  };

  const submit = async (): Promise<void> => {
    setError(null);
    const animUntilS = Number.parseInt(animUntil, 10);
    if (words < 20) {
      setError(`Paste a script first — this is only ${words} words.`);
      return;
    }
    // Hard stop at the beta runtime cap. The server rejects it too, and so
    // does the DGX — this just saves the round trip and says it in the words
    // the user will see everywhere else.
    if (overLimit) {
      setError(
        `That's ${words.toLocaleString()} words (≈ ${runtimeClock(words)}). ${lengthMessage}`,
      );
      return;
    }
    if (!Number.isFinite(animUntilS) || animUntilS < 0) {
      setError('Animate-first must be 0 seconds or more.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/vater/youtube/from-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: script.trim(),
          title: title.trim() || undefined,
          // A zero here means "no animation at all"; the column stays the
          // pipeline marker either way, so store at least 1s of intent.
          animUntilS: Math.max(1, animUntilS),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        project?: ReviewProject;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.project) {
        throw new Error(data.detail || data.error || `HTTP ${res.status}`);
      }
      onCreated(data.project);
      setScript('');
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VCard variant="flat" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="scriptReview"
        title="New video from your script"
        description="Paste or upload the script you want animated. It lands at the approval gate — nothing renders until you say so."
      />

      <VInput
        label="Video title"
        value={title}
        onChange={setTitle}
        placeholder="Optional — defaults to the script's first line"
      />

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary }}>
            Script
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                fontSize: 12,
                color: overLimit ? JELLY_TOKENS.error : t.textSecondary,
                fontWeight: overLimit ? 600 : 400,
              }}
            >
              {words.toLocaleString()} words · ≈ {runtimeClock(words)} at{' '}
              {WORDS_PER_MINUTE} wpm
              {!isOwner && ` · limit ${maxWords.toLocaleString()}`}
            </span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
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
              Upload .txt / .md
            </button>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.markdown,text/plain,text/markdown"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void readFile(file);
            e.target.value = '';
          }}
        />
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Paste the full narration script here…"
          spellCheck
          style={{
            width: '100%',
            minHeight: 240,
            resize: 'vertical',
            fontSize: 14,
            lineHeight: 1.7,
            fontFamily: JELLY_TOKENS.font,
            border: `1px solid ${t.border}`,
            borderRadius: JELLY_TOKENS.radius.md,
            background: t.card,
            color: t.text,
            outline: 'none',
            boxSizing: 'border-box',
            padding: 14,
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <VInput
          label="Animate first (seconds)"
          value={animUntil}
          onChange={setAnimUntil}
          style={{ flex: '1 1 180px' }}
          helper="Rest of the video runs as Ken Burns stills"
        />
        <div style={{ flex: '2 1 300px' }}>
          <LockedStyleCard />
        </div>
      </div>

      {overLimit && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            background: 'rgba(220,38,38,0.08)',
            border: `1px solid ${JELLY_TOKENS.error}`,
            fontSize: 12,
            color: t.text,
            lineHeight: 1.6,
          }}
        >
          {lengthMessage}
        </div>
      )}

      {error && <RetryError message={error} />}

      <div>
        <VBtn
          onClick={() => void submit()}
          disabled={submitting || overLimit}
          icon="sparkle"
        >
          {submitting ? 'Adding…' : 'Add script to review'}
        </VBtn>
      </div>
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
        {project.script && (
          <span style={{ fontSize: 11, color: t.textSecondary }}>
            {wordsIn(project.script).toLocaleString()}w
          </span>
        )}
      </div>
    </VCard>
  );
}

/* ─── Live render progress ───────────────────────────────────────────────
 * Trey 2026-08-10: one line with a green dot gave no feel for what a render
 * was doing — a 111-scene job looked identical at scene 3 and scene 90. This
 * shows the phase ladder, the step running NOW, the step before it, and a
 * rolling tail of worker lines. Data is `stepDetails`, refreshed by the same
 * 5s poll that already drives the status pill; nothing new is fetched.
 */

/** Worker lines look like "21:18:48 scenes: scene 8/11 done". */
function parseLogLine(raw: string): {
  time: string | null;
  tag: string | null;
  text: string;
} {
  const m = /^(\d{2}:\d{2}:\d{2})\s+(?:([a-z0-9_-]+):\s*)?(.*)$/i.exec(raw.trim());
  if (!m) return { time: null, tag: null, text: raw.trim() };
  return { time: m[1], tag: m[2] ?? null, text: m[3] };
}

/** "48s" / "3m 07s" / "1h 12m" — compact enough for an inline stat. */
function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Ticking clock so elapsed advances between the 5s project polls. */
function useNowMs(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const h = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(h);
  }, [active]);
  return now;
}

function RenderProgress({
  project,
}: {
  project: ReviewProject;
}): React.ReactElement {
  const { t } = useTheme();
  const details = project.stepDetails ?? null;
  const logs = React.useMemo(
    () => (Array.isArray(details?.logs) ? details!.logs!.filter(Boolean) : []),
    [details],
  );

  // Newest last, so the current step is the tail.
  const current = logs.length ? logs[logs.length - 1] : null;
  const prior = logs.length > 1 ? logs[logs.length - 2] : null;

  // Keep the rolling log pinned to the newest line as it grows.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  const phase = details?.phase ?? null;
  const pct = Math.max(0, Math.min(100, project.progress ?? 0));

  // Elapsed + per-stage durations. `startedAt` is stamped on the first poll of
  // the job and `phaseTimings` accumulates across polls, so both survive a
  // page reload — this is the row's own history, not a client-side timer.
  const nowMs = useNowMs(true);
  const startedMs = details?.startedAt ? Date.parse(details.startedAt) : NaN;
  const elapsed = Number.isFinite(startedMs) ? formatDuration(nowMs - startedMs) : null;
  const stageRows = React.useMemo(() => {
    const timings = details?.phaseTimings;
    if (!timings) return [];
    return Object.entries(timings)
      .map(([name, timing]) => {
        const from = Date.parse(timing.startedAt);
        const to = timing.endedAt ? Date.parse(timing.endedAt) : null;
        return {
          name,
          from,
          running: to === null,
          ms: (to ?? nowMs) - from,
        };
      })
      .filter((row) => Number.isFinite(row.from))
      .sort((a, b) => a.from - b.from);
  }, [details?.phaseTimings, nowMs]);

  // Where we are on the ladder. `status` is the authority; phase is a label.
  const ladder = CREATION_PHASES.filter((p) => !p.transcribeOnly);
  const activeIdx = ladder.findIndex((p) => p.status === project.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: t.textSecondary,
          }}
        >
          <span style={{ fontWeight: 600, color: t.text }}>
            {/* A queued job is behind the per-tenant cap, not stalled — say
                so explicitly instead of rendering the raw DGX phase text. */}
            {queueLabel(phase) ??
              (phase ? phase.replace(/_/g, ' ') : 'working')}
          </span>
          <span data-testid="render-elapsed">
            {elapsed ? `${elapsed} elapsed · ` : ''}
            {pct}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: t.cardAlt,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: JELLY_TOKENS.brand,
              transition: 'width 400ms ease',
            }}
          />
        </div>
      </div>

      {/* Phase ladder */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ladder.map((p, i) => {
          const done = activeIdx >= 0 && i < activeIdx;
          const active = i === activeIdx;
          return (
            <span
              key={p.status}
              title={p.description}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: JELLY_TOKENS.radius.pill,
                color: active ? '#fff' : done ? t.textSecondary : t.textDisabled,
                background: active
                  ? JELLY_TOKENS.brand
                  : done
                    ? t.cardAlt
                    : 'transparent',
                border: `1px solid ${active ? 'transparent' : t.border}`,
              }}
            >
              {p.label}
            </span>
          );
        })}
      </div>

      {/* Per-stage durations — how long each phase actually took, so a slow
          render can be blamed on the stage that ate the time. */}
      {stageRows.length > 0 && (
        <div
          data-testid="stage-timings"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
        >
          {stageRows.map((row) => (
            <span
              key={row.name}
              title={
                row.running
                  ? `${row.name.replace(/_/g, ' ')} — running for ${formatDuration(row.ms)}`
                  : `${row.name.replace(/_/g, ' ')} took ${formatDuration(row.ms)}`
              }
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: JELLY_TOKENS.radius.pill,
                border: `1px solid ${t.border}`,
                color: row.running ? t.text : t.textSecondary,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {row.name.replace(/_/g, ' ')}{' '}
              <span style={{ fontWeight: 700 }}>{formatDuration(row.ms)}</span>
              {row.running ? '…' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Now / previous */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <StepLine label="Now" raw={current} emphasis />
        <StepLine label="Before" raw={prior} />
      </div>

      {/* Rolling log */}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: t.textSecondary,
            marginBottom: 4,
          }}
        >
          Worker log
        </div>
        <div
          ref={scrollRef}
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            background: t.cardAlt,
            borderRadius: JELLY_TOKENS.radius.md,
            padding: 10,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 11,
            lineHeight: 1.7,
            color: t.textSecondary,
          }}
        >
          {logs.length === 0 ? (
            <span style={{ opacity: 0.7 }}>
              No worker lines yet — the first one lands within a few seconds of
              the render starting.
            </span>
          ) : (
            logs.map((line, i) => {
              const { time, tag, text } = parseLogLine(line);
              return (
                <div key={`${i}-${line}`} style={{ display: 'flex', gap: 8 }}>
                  {time && (
                    <span style={{ opacity: 0.55, flexShrink: 0 }}>{time}</span>
                  )}
                  {tag && (
                    <span
                      style={{
                        color: JELLY_TOKENS.brand,
                        flexShrink: 0,
                        fontWeight: 600,
                      }}
                    >
                      {tag}
                    </span>
                  )}
                  <span style={{ color: t.text }}>{text}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function StepLine({
  label,
  raw,
  emphasis = false,
}: {
  label: string;
  raw: string | null;
  emphasis?: boolean;
}): React.ReactElement {
  const { t } = useTheme();
  const { time, tag, text } = raw
    ? parseLogLine(raw)
    : { time: null, tag: null, text: '—' };
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: t.textDisabled,
          width: 46,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: emphasis ? 13 : 12,
          fontWeight: emphasis ? 600 : 400,
          color: emphasis ? t.text : t.textSecondary,
        }}
      >
        {tag && (
          <span style={{ color: JELLY_TOKENS.brand }}>{tag}: </span>
        )}
        {text}
      </span>
      {time && (
        <span style={{ fontSize: 10, color: t.textDisabled, marginLeft: 'auto' }}>
          {time}
        </span>
      )}
    </div>
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
            {project.publishTitle || project.sourceTitle || 'Untitled'}
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary }}>
            {stage === 'failed'
              ? 'This project failed — the error is above. The log below is what the worker did before it stopped.'
              : stage === 'rendering'
                ? 'Rendering the approved script.'
                : 'Getting this project ready. The review panel opens here when it is.'}
          </div>

          {/* Rolling step log. Shown on failure too — the last lines before a
           * stop are the fastest way to see WHERE it died. */}
          <RenderProgress project={project} />
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
  const { maxWords } = useTier();
  /* `saved` is the text the server currently holds; `draft` is what's in the
   * box. Approve sends the DRAFT, so an unsaved edit can never silently
   * render the older text — but the button says so out loud too. */
  const [saved, setSaved] = React.useState(project.script ?? '');
  const [draft, setDraft] = React.useState(project.script ?? '');
  const [saving, setSaving] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [justSaved, setJustSaved] = React.useState(false);

  const words = React.useMemo(() => wordsIn(draft), [draft]);
  const dirty = draft !== saved;
  // Approve & Animate is the money click. The DGX rejects an over-cap script
  // with a 400, so stopping here costs the user one edit instead of a failed
  // project. Owner is uncapped.
  const overLimit = isOverLength(words, maxWords);
  const lengthMessage = lengthMessageFor(maxWords);

  const save = async (): Promise<void> => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: draft }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setSaved(draft);
      setJustSaved(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the script');
    } finally {
      setSaving(false);
    }
  };

  const approve = async (): Promise<void> => {
    setError(null);
    setApproving(true);
    try {
      const res = await fetch(`/api/vater/youtube/${project.id}/approve-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: draft }),
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
        title={project.publishTitle || project.sourceTitle || 'Script review'}
        description="Edit freely and save. Nothing is generated until you approve."
      />

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
        <Stat label="Words" value={words.toLocaleString()} />
        <Stat
          label="Estimated runtime"
          value={`${runtimeClock(words)} at ${WORDS_PER_MINUTE} wpm`}
        />
        <Stat
          label="Animated window"
          value={project.animUntilS ? `first ${project.animUntilS}s` : 'stills only'}
        />
      </div>

      {overLimit && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            background: 'rgba(220,38,38,0.08)',
            border: `1px solid ${JELLY_TOKENS.error}`,
            fontSize: 12,
            color: t.text,
            lineHeight: 1.6,
          }}
        >
          {words.toLocaleString()} words is over the{' '}
          {maxWords.toLocaleString()}-word ceiling. {lengthMessage}
        </div>
      )}

      {(project.scriptVersions?.length ?? 0) > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ color: t.textSecondary }}>History</span>
          <select
            value=""
            onChange={(e) => {
              const idx = Number(e.target.value);
              const entry = project.scriptVersions?.[idx];
              if (entry) setDraft(entry.script);
            }}
            style={{
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: `1px solid ${t.border}`,
              background: t.cardAlt,
              color: t.text,
              maxWidth: 320,
            }}
          >
            <option value="" disabled>
              Restore a previous version…
            </option>
            {project.scriptVersions!
              .map((v, i) => ({ v, i }))
              .reverse()
              .map(({ v, i }) => (
                <option key={`${v.ts}-${i}`} value={i}>
                  v{i + 1} · {v.source} ·{' '}
                  {new Date(v.ts).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  · {wordsIn(v.script)}w
                </option>
              ))}
          </select>
          <span style={{ color: t.textSecondary }}>
            Loads into the editor — Save to keep it.
          </span>
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setJustSaved(false);
        }}
        spellCheck
        style={{
          width: '100%',
          minHeight: 380,
          resize: 'vertical',
          fontSize: 14,
          lineHeight: 1.75,
          fontFamily: JELLY_TOKENS.font,
          border: `1px solid ${dirty ? JELLY_TOKENS.brandOutline : t.border}`,
          borderRadius: JELLY_TOKENS.radius.md,
          background: t.card,
          color: t.text,
          outline: 'none',
          boxSizing: 'border-box',
          padding: 16,
        }}
      />

      {error && <RetryError message={error} />}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <VBtn
          variant="ghost"
          onClick={() => void save()}
          disabled={saving || approving || !dirty}
        >
          {saving ? 'Saving…' : dirty ? 'Save script' : 'Saved'}
        </VBtn>
        <VBtn
          onClick={() => void approve()}
          disabled={approving || saving || words === 0 || overLimit}
          icon="play"
        >
          {approving ? 'Starting render…' : 'Approve & Animate'}
        </VBtn>
        <span style={{ fontSize: 12, color: t.textSecondary }}>
          {overLimit
            ? lengthMessage
            : dirty
              ? 'Unsaved edits — Approve sends the text in the box above.'
              : justSaved
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
