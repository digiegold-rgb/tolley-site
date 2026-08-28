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
import { useTheme, useRoute } from '../../theme-context';
import { useTier } from '../../tier-context';
import { VBtn, VCard, VInput, RetryError, SectionHeader } from '../../primitives';
import {
  lengthMessageFor,
  WORDS_PER_MINUTE,
  isOverLength,
  runtimeClock,
} from '@/lib/vater/script-limits';
import {
  IN_FLIGHT_STATUSES,
  type YouTubeProjectStatus,
} from '@/lib/vater/youtube-status';
import { TINT_BG } from '../tint';
import { ProjectLiveDetail } from '../live/ProjectLiveDetail';
import {
  readConciergeClient,
  readEngineClient,
  type ConciergeStage,
} from '@/lib/vater/concierge-client';
import { useRenderEstimate } from '../editor/use-render-estimate';
import {
  ANIMATE_WINDOW_DEFAULT_S,
  DEFAULT_SCENE_SECONDS,
  snapWindowToScenes,
} from '@/lib/vater/animate-layer';
import type { DedupMatch } from '@/lib/vater/script-dedup';

/** Seconds → "0:32". runtimeClock() takes a word count, not seconds. */
function clockOf(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/** Shape of POST /api/vater/youtube/script-precheck (rules 27 + 28). */
type DedupResponse = {
  mode: 'prose' | 'title';
  checked: number;
  inconclusive: boolean;
  verbatim: DedupMatch[];
  similar: DedupMatch[];
};

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
  | 'fable5'
  | 'ready_to_publish'
  | 'published'
  | 'failed';

const STAGE_LABELS: Record<ReviewStage, string> = {
  preparing: 'Preparing',
  awaiting_approval: 'Awaiting script approval',
  rendering: 'Rendering',
  fable5: 'Fable 5',
  ready_to_publish: 'Ready to publish',
  published: 'Published',
  failed: 'Failed',
};

const STAGE_COLORS: Record<ReviewStage, string> = {
  preparing: JELLY_TOKENS.accent,
  awaiting_approval: JELLY_TOKENS.brand,
  rendering: JELLY_TOKENS.accent,
  fable5: JELLY_TOKENS.brand,
  ready_to_publish: JELLY_TOKENS.success,
  published: JELLY_TOKENS.success,
  failed: JELLY_TOKENS.error,
};


/** Live pill text for a Fable 5 row — the ticket stage, not the DB status. */
const FABLE5_STAGE_TEXT: Record<ConciergeStage, string> = {
  queued: 'Fable 5 — in queue',
  picked_up: 'Fable 5 — picked up',
  directing: 'Fable 5 — directing',
  rendering: 'Fable 5 — rendering',
  qa: 'Fable 5 — quality check',
  delivered: 'Fable 5 — delivered',
  needs_info: 'Fable 5 — needs your input',
  cancelled: 'Fable 5 — cancelled',
};

function stagePill(p: ReviewProject): { label: string; color: string } {
  const stage = stageOf(p);
  if (stage === 'fable5') {
    const ticket = readConciergeClient(p.settingsJson);
    const cs = ticket?.stage;
    return {
      label: cs ? FABLE5_STAGE_TEXT[cs] : 'Fable 5',
      color: cs === 'needs_info' ? JELLY_TOKENS.warning : JELLY_TOKENS.brand,
    };
  }
  return { label: STAGE_LABELS[stage], color: STAGE_COLORS[stage] };
}

export function stageOf(p: ReviewProject): ReviewStage {
  if (p.youtubeVideoId) return 'published';
  if (p.status === 'failed') return 'failed';
  if (p.status === 'awaiting_script_approval') return 'awaiting_approval';
  // Fable 5 Concierge: the ticket owns the project until it delivers
  // (status flips to `ready`, handled below) or is cancelled.
  if (p.status.startsWith('concierge_')) return 'fable5';
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
    // Fable 5 Concierge rows belong here from submit onward (commit 4f69345
    // claimed this and never shipped it — they only appeared once kickoff
    // happened to stamp scriptApprovedAt).
    readEngineClient(p.settingsJson) === 'fable5' ||
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

  /* A live Fable 5 ticket moves via operator/runner stage posts, not DGX
   * polling — so keep refreshing the list while one is queued/in progress,
   * but NEVER call /poll for it (concierge policy: the sync route owns it). */
  const conciergeLive = React.useMemo(
    () =>
      (projects ?? []).some(
        (p) => p.status === 'concierge_queued' || p.status === 'concierge_in_progress',
      ),
    [projects],
  );

  const busy = inFlightIds.length > 0 || conciergeLive;

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
        background: missing ? TINT_BG.error.background : t.cardAlt,
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
  const [animScenes, setAnimScenes] = React.useState(
    () => snapWindowToScenes(ANIMATE_WINDOW_DEFAULT_S).sceneCount,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  // Script rules 27 + 28 — checked before anything is spent (free, no LLM).
  const [dupes, setDupes] = React.useState<DedupResponse | null>(null);
  const [dupeAck, setDupeAck] = React.useState(false);

  const words = React.useMemo(() => wordsIn(script), [script]);
  /* Cap the slider at the video's own length — offering to animate three
     minutes of a ninety second script quotes clips that will never exist. */
  const maxAnimScenes = React.useMemo(
    () => Math.max(1, Math.ceil((words / WORDS_PER_MINUTE) * 60 / DEFAULT_SCENE_SECONDS)),
    [words],
  );
  /* CLAMPED ON READ, not reconciled in an effect.
   *
   * `animScenes` is what the user last dragged to; `maxAnimScenes` shrinks
   * when the script does. An <input type="range"> clamps its own thumb
   * silently, so the DOM showed 1 while React state still held 22 — the label
   * read "22 scenes · first 1:28", and submit() sent that stale state: 88
   * seconds of motion ordered for a five-second script.
   *
   * Deriving instead of syncing means there is no window in which the two can
   * disagree, and no effect that has to fire first. The raw intent is kept, so
   * pasting a longer script restores the window the user originally chose
   * rather than silently keeping the shrunken one.
   */
  const effectiveScenes = Math.min(animScenes, maxAnimScenes);
  const animSnap = React.useMemo(
    () => snapWindowToScenes(effectiveScenes * DEFAULT_SCENE_SECONDS),
    [effectiveScenes],
  );
  // An acknowledgement belongs to the text it was given for. Edit the script
  // and the flags have to be re-earned, or "proceed anyway" silently covers a
  // different script than the one it was clicked on.
  React.useEffect(() => {
    setDupeAck(false);
    setDupes(null);
  }, [script]);
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

  const submit = async (acknowledged = dupeAck): Promise<void> => {
    setError(null);
    // Whole scenes in, seconds out: the column is a second count, but it can
    // only ever hold a value that lands on a scene boundary.
    const animUntilS = Math.round(effectiveScenes * DEFAULT_SCENE_SECONDS);
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

    // Rules 27 + 28 run BEFORE the project is created, because creating it is
    // what starts costing money. A verbatim hit stops here once and asks; a
    // similar hit is named and explicitly left as the user's call (rule 28
    // says "let the user decide"), so it never blocks.
    if (!acknowledged) {
      setSubmitting(true);
      try {
        const pre = await fetch('/api/vater/youtube/script-precheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: script.trim(), title: title.trim() || undefined }),
        });
        if (pre.ok) {
          const found = (await pre.json()) as DedupResponse;
          setDupes(found);
          if (found.verbatim.length > 0) {
            setSubmitting(false);
            return;
          }
        }
      } catch {
        // A precheck that cannot run must never block a paying user from
        // working. Fall through and create the project.
      } finally {
        setSubmitting(false);
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/vater/youtube/from-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: script.trim(),
          title: title.trim() || undefined,
          // 0 = "None — stills only". POST /from-script maps a non-positive
          // value to a null column, which the manifest renders as "Stills
          // only" — do NOT floor this at 1, that silently animates scene 1.
          animUntilS,
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
        <div style={{ flex: '1 1 260px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 6,
            }}
          >
            <label
              style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}
              htmlFor="anim-window"
            >
              Animate the opening
            </label>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
              {animSnap.sceneCount === 0
                ? 'Stills only'
                : `${animSnap.sceneCount} scene${animSnap.sceneCount === 1 ? '' : 's'} · first ${clockOf(animSnap.coverageEndS)}`}
            </span>
          </div>
          {/* The slider counts SCENES, not seconds — one notch is one scene.
              A clip is generated from a single still, so a scene is the unit
              of both work and billing and half of one cannot be rendered.
              Stepping in scenes makes a half-scene position unreachable
              instead of something to detect and correct afterwards, and it
              means dragging never changes the price by a fraction of a clip.
              Seconds are what gets shown, because that is what a person
              means when they say "animate the first thirty seconds". */}
          <input
            id="anim-window"
            type="range"
            min={0}
            max={maxAnimScenes}
            step={1}
            value={effectiveScenes}
            onChange={(e) => setAnimScenes(Number(e.target.value))}
            data-testid="anim-window"
            aria-label="How many opening scenes to animate"
            aria-valuetext={
              animSnap.sceneCount === 0
                ? 'Stills only'
                : `${animSnap.sceneCount} scenes, first ${clockOf(animSnap.coverageEndS)}`
            }
            style={{ width: '100%', accentColor: JELLY_TOKENS.brand }}
          />
          <div
            style={{
              fontSize: 11,
              color: t.textSecondary,
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            {animSnap.sceneCount === 0
              ? 'No motion. Every scene runs as a Ken Burns still, and you can animate any single scene later for the price of one clip.'
              : `Scenes are about ${DEFAULT_SCENE_SECONDS} seconds each, so the slider moves a whole scene at a time — you can never buy half a clip. The rest of the video runs as stills.`}
          </div>
        </div>
        <div style={{ flex: '2 1 300px' }}>
          <LockedStyleCard />
        </div>
      </div>

      {dupes && (dupes.verbatim.length > 0 || dupes.similar.length > 0) && (
        <div
          data-testid="script-dupe-flags"
          style={{
            padding: '12px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            ...(dupes.verbatim.length ? TINT_BG.error : TINT_BG.warning),
            border: `1px solid ${dupes.verbatim.length ? JELLY_TOKENS.error : JELLY_TOKENS.warning}`,
            fontSize: 12,
            color: t.text,
            lineHeight: 1.6,
            display: 'grid',
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 700 }}>
            {dupes.verbatim.length
              ? `You have made this before (rule 27)`
              : `Similar to ${dupes.similar.length === 1 ? 'a video' : 'videos'} you already made (rule 28)`}
          </div>
          {[...dupes.verbatim, ...dupes.similar].map((m) => (
            <div key={m.id}>
              <div>{m.reason}</div>
              {m.phrase && (
                <div
                  style={{
                    marginTop: 4,
                    padding: '6px 8px',
                    borderRadius: JELLY_TOKENS.radius.sm,
                    background: t.cardAlt,
                    color: t.textSecondary,
                    fontStyle: 'italic',
                  }}
                >
                  Shared wording: “{m.phrase}”
                </div>
              )}
            </div>
          ))}
          <div style={{ color: t.textSecondary }}>
            {dupes.verbatim.length
              ? 'Nothing has been created and nothing has been charged. Rewrite the script, or continue if this is deliberate.'
              : 'This is your call — carry on, angle it differently, or hold off.'}
          </div>
          {dupes.verbatim.length > 0 && (
            <div>
              <VBtn
                size="sm"
                variant="outlined"
                data-testid="script-dupe-proceed"
                onClick={() => {
                  setDupeAck(true);
                  void submit(true);
                }}
              >
                Make it anyway
              </VBtn>
            </div>
          )}
        </div>
      )}

      {overLimit && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            ...TINT_BG.error,
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
  const { label: pillLabel, color } = stagePill(project);
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
          {pillLabel}
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

/* ─── Detail ─── */

function DetailPanel({
  project,
  onChanged,
}: {
  project: ReviewProject;
  onChanged: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const { setRoute } = useRoute();
  const stage = stageOf(project);
  const engine = readEngineClient(project.settingsJson);
  const ticket = engine === 'fable5' ? readConciergeClient(project.settingsJson) : null;

  /* Fable 5 Concierge (2026-08-25): Script Review is intake + the money gate.
   * The stage chips, the phase ladder and the scene-gen log all moved to
   * Project History (ConciergeStatusCard + ConciergeHistory) — nothing about
   * scene generation belongs in a screen called Script Review. What stays
   * here is the script itself and one line saying where the ticket is. */
  if (ticket) {
    const pill = stagePill(project);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="fable5-script-detail">
        {project.errorMessage && (
          <RetryError message={project.errorMessage} variant="banner" />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            data-testid="fable5-stage-pill"
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: pill.color,
              border: `1px solid ${pill.color}`,
              borderRadius: JELLY_TOKENS.radius.pill,
              padding: '3px 10px',
            }}
          >
            {pill.label}
          </span>
          <button
            type="button"
            data-testid="fable5-open-history"
            onClick={() => setRoute('project-history')}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 12.5,
              color: JELLY_TOKENS.brand,
            }}
          >
            Progress &amp; director&apos;s feedback live in Project History →
          </button>
        </div>
        <VCard style={{ padding: 16 }}>
          <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 8, letterSpacing: '0.04em' }}>
            SCRIPT · {project.script ? `${wordsIn(project.script).toLocaleString()} words` : 'no script'}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 1.6, color: t.text }}>
            {project.script ?? '—'}
          </div>
        </VCard>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {project.errorMessage && (
        <RetryError message={project.errorMessage} variant="banner" />
      )}

      {stage === 'awaiting_approval' ? (
        <ReviewPanel project={project} onChanged={onChanged} />
      ) : (
        /* Everything past the gate — live progress, the publish panel, the
         * finished video — moved to Project History on 2026-08-23. This screen
         * is intake + the money gate; duplicating the detail view in two places
         * is what made Project History feel like a worse copy of it. */
        <ProjectLiveDetail project={project} onChanged={onChanged} />
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
  // Approve is a money click — quote the price on the button itself, same
  // number the Visuals step shows. Degrades to a plain label if the estimate
  // route is absent.
  const estimate = useRenderEstimate(project.id);

  /* Opening window, owned by THIS panel and seeded from the row. Scene units,
     so a half-scene position is unreachable. */
  const [panelScenes, setPanelScenes] = React.useState(() =>
    Math.round((project.animUntilS ?? 0) / DEFAULT_SCENE_SECONDS),
  );
  const [savingWindow, setSavingWindow] = React.useState(false);
  const panelSnap = React.useMemo(
    () => snapWindowToScenes(panelScenes * DEFAULT_SCENE_SECONDS),
    [panelScenes],
  );

  /* Quote the render that is actually configured.
   *
   * `draftUsd` is stills-only and `fullUsd` includes the motion pass, scaled
   * server-side to the opening window. Showing `fullUsd ?? draftUsd`
   * unconditionally meant a project with no window — which every project born
   * in Create Video has, since nothing sets animUntilS there — was quoted a
   * whole-video motion bill for a render that will produce stills and no
   * motion at all. At $3.60/min against $0.90/min that is a 4x overstatement,
   * and it is where "$21" came from.
   *
   * Read off the slider rather than the row so the number moves the instant it
   * is dragged, instead of waiting for the PATCH and the re-quote to land. */
  const approveUsd =
    panelSnap.sceneCount === 0
      ? estimate.draftUsd
      : (estimate.fullUsd ?? estimate.draftUsd);
  /* Re-seed when a different project is selected — DetailPanel is keyed by id
     so this is belt-and-braces, but a slider showing the previous project's
     window while quoting this one's price is exactly the class of bug being
     fixed here. */
  React.useEffect(() => {
    setPanelScenes(Math.round((project.animUntilS ?? 0) / DEFAULT_SCENE_SECONDS));
  }, [project.id, project.animUntilS]);

  /* Persist + re-quote, debounced: a drag emits a tick per scene and each one
     would otherwise be a PATCH and a fresh estimate. Skips the write when the
     value already matches the row (mount, and the echo of our own save). */
  const reloadEstimate = estimate.reload;
  React.useEffect(() => {
    const desired = Math.round(panelScenes * DEFAULT_SCENE_SECONDS);
    const current = project.animUntilS ?? 0;
    if (desired === current) return;
    const id = setTimeout(() => {
      let cancelled = false;
      setSavingWindow(true);
      void (async () => {
        try {
          const res = await fetch(`/api/vater/youtube/${project.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ animUntilS: desired }),
          });
          if (!cancelled && res.ok) reloadEstimate();
        } catch {
          /* leave the slider where the user put it; the next drag retries */
        } finally {
          if (!cancelled) setSavingWindow(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, 400);
    return () => clearTimeout(id);
  }, [panelScenes, project.id, project.animUntilS, reloadEstimate]);

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
      </div>

      {/* The opening window, ON the panel that shows the price it changes.
          It used to be a read-only stat here, while the only slider lived in
          ScriptIntake at the top of the screen — a control belonging to the
          NEXT project. Dragging it could not move this quote, and did not.
          Now it PATCHes this project and re-quotes, so the number under the
          Approve button responds. Still steps by whole scenes. */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 6,
          }}
        >
          <label
            htmlFor={`anim-window-${project.id}`}
            style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}
          >
            Animated window
          </label>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
            {panelSnap.sceneCount === 0
              ? 'Stills only'
              : `${panelSnap.sceneCount} scene${panelSnap.sceneCount === 1 ? '' : 's'} · first ${clockOf(panelSnap.coverageEndS)}`}
            {savingWindow ? ' · saving…' : ''}
          </span>
        </div>
        <input
          id={`anim-window-${project.id}`}
          type="range"
          min={0}
          max={Math.max(1, Math.ceil((words / WORDS_PER_MINUTE) * 60 / DEFAULT_SCENE_SECONDS))}
          step={1}
          value={panelScenes}
          onChange={(e) => setPanelScenes(Number(e.target.value))}
          disabled={savingWindow}
          data-testid="review-anim-window"
          aria-label="How many opening scenes to animate"
          style={{ width: '100%', accentColor: JELLY_TOKENS.brand }}
        />
        <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
          Moves a whole scene at a time. The estimate below follows it.
        </div>
      </div>

      {overLimit && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            ...TINT_BG.error,
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
          {approving
            ? 'Starting render…'
            : approveUsd !== null
              ? `Approve & Animate — est. $${approveUsd.toFixed(2)}`
              : 'Approve & Animate'}
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
