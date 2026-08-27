'use client';

/* ProjectShell — Phase-2 replacement for EditorScreen.
 *
 * Owns project-load, polling, derived per-step state, and renders the active
 * step component below the PillStepper. Unlike the legacy EditorScreen this
 * shell ASSUMES a project already exists (created upstream via the
 * StylePickerModal → /api/vater/youtube/new-from-style flow). If
 * `projectId` is missing it bails back to the dashboard.
 *
 * Per-step state is derived purely from the project record:
 *   Title       — done if project.sourceTitle set
 *   Script      — in-progress while status ∈ scripting-phases; done when
 *                 project.script set
 *   Voiceover   — done if project.audioUrl set; in-progress on
 *                 generating_audio / aligning_captions
 *   Visuals     — done if scenesJson length > 0; in-progress on
 *                 generating_scenes
 *   Soundtrack  — done if project.backgroundMusicId set
 *   Thumbnail   — done if project.thumbnailUrl set
 *   Description — done if the user has clicked Generate this session
 *                 (server-side description is not persisted on project).
 *
 * Polling: while ANY step is `in-progress` we poll
 * `GET /api/vater/youtube/[id]/poll` every 2s and refresh project state.
 * We stop polling as soon as no in-flight phase remains (poll endpoint is
 * the existing autopilot bridge — see /api/vater/youtube/[id]/poll route).
 *
 * Auto-advance: when a step transitions from non-done to done we move
 * editorStep to the next pending/in-progress step. We only advance when the
 * stepper is currently sitting on the step that just completed, so users
 * who jumped ahead don't get yanked back.
 */

import * as React from 'react';
import { JELLY_TOKENS, EDITOR_STEPS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { Icon } from '../../Icon';
import { PillStepper, EDITOR_STEP_HINTS, ConfirmDialog } from '../../primitives';
import { Footer } from '../../Footer';
import {
  IN_FLIGHT_STATUSES,
  STATUS_LABELS,
  isConciergeStatus,
  type YouTubeProjectStatus,
} from '@/lib/vater/youtube-status';
import {
  readConciergeClient,
  readEngineClient,
} from '@/lib/vater/concierge-client';
import { HowItWorksStrip } from '../../engine/HowItWorksStrip';
import { EngineBar } from '../../engine/EngineBar';
import { ConciergeStatusCard } from './ConciergeStatusCard';
import {
  DEMO_CTA_HREF,
  DEMO_CTA_LABEL,
  DEMO_RECEIPT,
} from '@/lib/vater/demo-data';
import {
  RenderReceiptTicket,
  type RenderReceipt,
} from '../browse/RenderReceiptTicket';

import { TitleStep } from './TitleStep';
import { ScriptStep } from './ScriptStep';
import { VoiceoverStep } from './VoiceoverStep';
import { VisualsStep } from './VisualsStep';
import { SoundtrackStep } from './SoundtrackStep';
import { ThumbnailStep } from './ThumbnailStep';
import { DescriptionStep } from './DescriptionStep';
import { TINT_BG } from '../tint';

/* Common project shape every step receives. Mirrors what the legacy v1
 * EditorScreen exported, plus the v2-specific fields (titleSuggestions,
 * backgroundMusicId, styleId). */
export interface EditorProject {
  id: string;
  styleId?: string | null;
  sourceTitle?: string | null;
  topic?: string | null;
  status?: string | null;
  progress?: number | null;
  audioUrl?: string | null;
  audioDuration?: number | null;
  scenesJson?: unknown;
  captionTimings?: unknown;
  finalVideoUrl?: string | null;
  thumbnailUrl?: string | null;
  autopilotJobId?: string | null;
  script?: string | null;
  targetWordCount?: number | null;
  targetDuration?: number | null;
  voiceCloneName?: string | null;
  voiceName?: string | null;
  goal?: string | null;
  goalSuggestions?: unknown;
  sourceChannel?: string | null;
  sourceUrl?: string | null;
  backgroundMusicId?: string | null;
  musicVolume?: number | null;
  titleSuggestions?: unknown;
  customStylePrompt?: string | null;
  description?: string | null;
  /** Optional feature bag (jelly-feature-contract 2026-08-16). Parse with
   *  readFeatures() from lib/vater/project-features. */
  settingsJson?: unknown;
}

export interface EditorStepProps {
  projectId: string | null;
  project: EditorProject | null;
  refresh: () => Promise<void>;
  /** Jump to another editor step (confirm-modal "Fix it" buttons). */
  goToStep?: (step: number) => void;
}

export type StepState = 'pending' | 'in-progress' | 'done';

export interface ProjectShellProps {
  projectId: string;
  /* ── Read-only demo mode (/animate/demo, 2026-08-16) ────────────────────
   * Renders a real finished project to a signed-out visitor so they can see
   * the actual editor before creating an account. When set:
   *   - `project` comes from this prop; nothing is fetched and nothing polls
   *     (every /api/vater route would 401 for a stranger anyway)
   *   - `projectId` is passed to the steps as null, which is the guard every
   *     step already uses to skip its own fetches — so no step needed a
   *     demo-specific branch
   *   - the step area is wrapped in a disabled <fieldset>, which natively
   *     disables every button/input/select inside it, no matter which lane
   *     added them or when
   * The prop is optional and defaults off, so the signed-in editor path is
   * byte-for-byte unchanged. */
  demoProject?: EditorProject;
}

const SCRIPT_PHASES: ReadonlySet<YouTubeProjectStatus> = new Set([
  'fetching',
  'transcribing',
  'extracting_principles',
  'scripting',
  'verifying',
]);

const VOICE_PHASES: ReadonlySet<YouTubeProjectStatus> = new Set([
  'generating_audio',
  'aligning_captions',
]);

const VISUAL_PHASES: ReadonlySet<YouTubeProjectStatus> = new Set([
  'generating_scenes',
  'composing_video',
]);

function asStatus(s: string | null | undefined): YouTubeProjectStatus | null {
  if (!s) return null;
  return s as YouTubeProjectStatus;
}

function deriveStepStates(
  project: EditorProject | null,
  descriptionDone: boolean,
): StepState[] {
  if (!project) return EDITOR_STEPS.map(() => 'pending');
  const status = asStatus(project.status);
  const titleDone = !!project.sourceTitle?.trim();
  const scriptDone = !!project.script?.trim();
  const voiceDone = !!project.audioUrl;
  const scenes = Array.isArray(project.scenesJson)
    ? (project.scenesJson as unknown[])
    : [];
  const visualsDone = scenes.length > 0;
  const musicDone = !!project.backgroundMusicId;
  const thumbnailDone = !!project.thumbnailUrl;

  const titleState: StepState = titleDone ? 'done' : 'in-progress';

  let scriptState: StepState;
  if (!titleDone) scriptState = 'pending';
  else if (scriptDone) scriptState = 'done';
  else if (status && SCRIPT_PHASES.has(status)) scriptState = 'in-progress';
  else scriptState = 'pending';

  let voiceState: StepState;
  if (!scriptDone) voiceState = 'pending';
  else if (voiceDone) voiceState = 'done';
  else if (status && VOICE_PHASES.has(status)) voiceState = 'in-progress';
  else voiceState = 'pending';

  let visualState: StepState;
  if (!voiceDone) visualState = 'pending';
  else if (visualsDone) visualState = 'done';
  else if (status && VISUAL_PHASES.has(status)) visualState = 'in-progress';
  else visualState = 'pending';

  const musicState: StepState = !visualsDone
    ? 'pending'
    : musicDone
      ? 'done'
      : 'pending';

  const thumbState: StepState = !visualsDone
    ? 'pending'
    : thumbnailDone
      ? 'done'
      : 'pending';

  const descState: StepState = !thumbnailDone
    ? 'pending'
    : descriptionDone
      ? 'done'
      : 'pending';

  return [
    titleState,
    scriptState,
    voiceState,
    visualState,
    musicState,
    thumbState,
    descState,
  ];
}

export function ProjectShell({
  projectId,
  demoProject,
}: ProjectShellProps): React.ReactElement {
  const { t } = useTheme();
  const { editorStep, setEditorStep, setRoute } = useRoute();
  const isDemo = !!demoProject;
  const [project, setProject] = React.useState<EditorProject | null>(
    demoProject ?? null,
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [descriptionDone, setDescriptionDone] = React.useState(false);
  const prevStatesRef = React.useRef<StepState[]>([]);
  const lastEditorStepRef = React.useRef<number>(editorStep);

  React.useEffect(() => {
    lastEditorStepRef.current = editorStep;
  }, [editorStep]);

  /* Loader. Same pattern the legacy EditorScreen used: GET /api/vater/youtube/[id]
   * → { project }. We never silent-catch — surface to a banner. */
  const refresh = React.useCallback(async (): Promise<void> => {
    // Demo mode has nothing to refresh from — the project is a constant and
    // the API would 401 for a signed-out visitor.
    if (isDemo) return;
    if (!projectId) {
      setProject(null);
      return;
    }
    setLoadError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { project: EditorProject };
      setProject(data.project);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load project');
    }
  }, [projectId, isDemo]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  /* Poll loop. Spin while project.status is in-flight. The poll endpoint
   * advances autopilot state on the DB, so a follow-up GET picks up the new
   * shape via refresh(). 2s tick matches the legacy EditorShell cadence. */
  React.useEffect(() => {
    if (isDemo || !projectId || !project) return;
    const status = asStatus(project.status);
    if (!status || !IN_FLIGHT_STATUSES.has(status)) return;
    let cancelled = false;
    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try {
        await fetch(`/api/vater/youtube/${projectId}/poll`, { method: 'GET' });
      } catch {
        // poll() is best-effort — its errors don't block the UI's local
        // GET refresh below. We surface load errors via the refresh banner.
      }
      if (cancelled) return;
      await refresh();
    };
    const interval = window.setInterval(() => {
      void tick();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isDemo, projectId, project, refresh]);

  /* Fable 5 Concierge (2026-08-19). A concierge project is NOT in-flight for
   * the auto pipeline — /poll must never run for it (it would read a DGX job
   * the operator owns and rewrite status). Instead a plain GET every 20 s so
   * the stage chips move when the operator moves them. */
  React.useEffect(() => {
    if (isDemo || !projectId || !project) return;
    if (!isConciergeStatus(project.status)) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, 20_000);
    return () => window.clearInterval(interval);
  }, [isDemo, projectId, project, refresh]);

  /* Auto-advance when a step transitions to done. Compute current states,
   * compare against prevStatesRef, and on any non-done→done transition, if
   * the user is still on that step, bump them to the next non-done step. */
  const stepStates = React.useMemo(
    () => deriveStepStates(project, descriptionDone),
    [project, descriptionDone],
  );

  React.useEffect(() => {
    const prev = prevStatesRef.current;
    if (prev.length === stepStates.length) {
      for (let i = 0; i < stepStates.length; i += 1) {
        if (prev[i] !== 'done' && stepStates[i] === 'done') {
          if (lastEditorStepRef.current === i) {
            const nextIdx = stepStates.findIndex(
              (s, j) => j > i && s !== 'done',
            );
            if (nextIdx !== -1) {
              setEditorStep(nextIdx);
              lastEditorStepRef.current = nextIdx;
            }
          }
          break;
        }
      }
    }
    prevStatesRef.current = stepStates;
  }, [stepStates, setEditorStep]);

  /* projectId is deliberately NULL in demo mode. Every step already guards
   * its own fetches with `if (!projectId) return` — that one line is what
   * makes seven step components safe to render for a stranger without any of
   * them knowing the demo exists. */
  const stepProps: EditorStepProps = React.useMemo(
    () => ({
      projectId: isDemo ? null : (projectId ?? null),
      project,
      refresh,
      goToStep: setEditorStep,
    }),
    [isDemo, projectId, project, refresh, setEditorStep],
  );

  /* Description-step "done" tracking. Description text is generated on-demand
   * from /social-metadata and not persisted on the project row, so we treat
   * the step as done as soon as the user runs Generate this session. The
   * step component will call this via the descProps shim below. */
  const markDescriptionDone = React.useCallback(() => {
    setDescriptionDone(true);
  }, []);

  const StepEl = React.useMemo(() => {
    const map = [
      TitleStep,
      ScriptStep,
      VoiceoverStep,
      VisualsStep,
      SoundtrackStep,
      ThumbnailStep,
      DescriptionStep,
    ];
    return map[editorStep] ?? TitleStep;
  }, [editorStep]);

  const breadcrumbTitle =
    project?.sourceTitle?.trim() ||
    project?.topic?.trim() ||
    'Untitled Project';

  /* ── Fable 5 Concierge surface ─────────────────────────────────────────
   * engine + ticket live on settingsJson (server-owned). The card shows for
   * a live concierge status OR a delivered ticket (status is `ready` then);
   * the steps are locked while the operator owns the project (queued /
   * in_progress) and re-enabled for needs_info so the customer can edit the
   * script and resubmit. The EngineBar offers the choice only when there is
   * a script and nothing has been rendered yet. */
  const engine = readEngineClient(project?.settingsJson);
  const ticket = readConciergeClient(project?.settingsJson);
  const projStatus = project?.status ?? null;
  const showConciergeCard =
    !isDemo &&
    !!project &&
    engine === 'fable5' &&
    !!ticket &&
    ticket.stage !== 'cancelled' &&
    (isConciergeStatus(projStatus) || ticket.stage !== 'queued');
  const conciergeLocked =
    projStatus === 'concierge_queued' || projStatus === 'concierge_in_progress';
  const sceneCount = Array.isArray(project?.scenesJson)
    ? (project.scenesJson as unknown[]).length
    : 0;
  const scriptWords = (project?.script ?? '').split(/\s+/).filter(Boolean).length;
  const inFlight =
    !isDemo &&
    !!projStatus &&
    IN_FLIGHT_STATUSES.has(projStatus as YouTubeProjectStatus);
  const showEngineBar =
    !isDemo &&
    !!project &&
    !!projectId &&
    engine !== 'fable5' &&
    scriptWords > 0 &&
    !project.audioUrl &&
    sceneCount === 0 &&
    (projStatus === 'draft' ||
      projStatus === 'scripted' ||
      projStatus === 'awaiting_script_approval' ||
      projStatus === 'failed');

  return (
    <div>
      {isDemo && <DemoBanner />}

      {/* Breadcrumb pill — top-right (clickable: back to Dashboard) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <div
          onClick={() => setRoute('dashboard')}
          title="Back to Dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${t.border}`,
            background: t.card,
            cursor: 'pointer',
            maxWidth: 360,
          }}
        >
          <Icon name="chevronLeft" size={16} color={t.textSecondary} />
          <Icon name="folder" size={16} color={JELLY_TOKENS.brand} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: t.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {breadcrumbTitle}
            </div>
            <div style={{ fontSize: 11, color: t.textSecondary }}>
              {projectId ? `• ${project?.status ?? 'loading…'}` : '• new project'}
            </div>
          </div>
        </div>
      </div>

      {/* Page header */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: t.text, margin: 0 }}>
          Create Video
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
          <HowItWorksStrip
            active={
              showConciergeCard || showEngineBar
                ? 2
                : project?.finalVideoUrl
                  ? 3
                  : project?.script
                    ? 1
                    : 0
            }
          />
        </div>
      </div>

      {/* Pill stepper with per-step state badges. HIDDEN while Fable 5 owns
          the render — a wall of locked Voiceover/Visuals/Soundtrack pills
          under a queued ticket read as "a big mess" of things to do when the
          honest answer is "nothing" (2026-08-20 walkthrough). */}
      {!conciergeLocked && (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <PillStepper
              steps={EDITOR_STEPS as unknown as ReadonlyArray<string>}
              active={editorStep}
              onSelect={setEditorStep}
              hints={EDITOR_STEP_HINTS}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
            <StepStateRow states={stepStates} />
          </div>
          <div
            style={{
              textAlign: 'center',
              fontSize: 11.5,
              color: t.textFaint,
              marginBottom: 24,
            }}
          >
            Hover any step name for what it does. Steps unlock in order — each
            lights up when the green checks before it are done. Nothing renders (or
            costs anything) until you press Generate Video or send the script to
            Fable 5.
          </div>
        </>
      )}
      {conciergeLocked && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 13,
            color: t.textSecondary,
            maxWidth: 640,
            margin: '0 auto 20px',
            lineHeight: 1.6,
          }}
        >
          Fable 5 has this one — voiceover, visuals, soundtrack and thumbnail
          are all directed for you. Sit back; you&apos;ll get an email when it
          lands in your Library. Changed your mind? Cancel from the ticket
          card below.
        </div>
      )}

      {/* Load-error banner */}
      {loadError && (
        <div
          style={{
            maxWidth: 700,
            margin: '0 auto 16px',
            padding: '10px 14px',
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${JELLY_TOKENS.error}`,
            ...TINT_BG.error,
            color: JELLY_TOKENS.error,
            fontSize: 13,
          }}
        >
          Could not load project: {loadError}
        </div>
      )}

      {/* Fable 5 Concierge: ticket card while the operator owns the render,
          engine choice when a script exists and nothing has rendered yet. */}
      {showConciergeCard && ticket && projectId && (
        <ConciergeStatusCard
          projectId={projectId}
          status={projStatus}
          ticket={ticket}
          refresh={refresh}
        />
      )}
      {showEngineBar && projectId && (
        <EngineBar
          projectId={projectId}
          words={scriptWords}
          script={project?.script}
          refresh={refresh}
          goToStep={setEditorStep}
        />
      )}
      {inFlight && projectId && (
        <RenderInFlightBar
          projectId={projectId}
          status={projStatus}
          progress={project?.progress ?? null}
          refresh={refresh}
        />
      )}

      {/* Step content. Description step is rendered via a wrapper that
          marks the step done after a successful Generate; all other steps
          pass through stepProps unchanged. */}
      {/* In demo mode the whole step area is a disabled <fieldset>. Native
          `disabled` propagates to every descendant form control, so a button
          another lane adds tomorrow is inert here without anyone remembering
          this file exists. `pointer-events: none` catches the click handlers
          that live on plain <div>s. */}
      {/* Step content is fully hidden while Fable 5 owns the project — the
          ticket card above is the whole story until delivery. */}
      {!conciergeLocked && (
        <StepArea disabled={isDemo}>
          {editorStep === 6 ? (
            <DescriptionStepWrapper
              stepProps={stepProps}
              onCompleted={markDescriptionDone}
            />
          ) : (
            <StepEl {...stepProps} />
          )}
        </StepArea>
      )}

      {/* The stub for a finished film. A render that quietly costs money and
          shows one opaque total is exactly the thing customers do not trust —
          so as soon as there is an MP4, there is an itemised ticket under it.
          Demo mode renders DEMO_RECEIPT statically: the route needs a session,
          and these are the real reconciled numbers for #23. */}
      {isDemo ? (
        <div style={{ maxWidth: 460, margin: '28px auto 0' }}>
          <RenderReceiptTicket
            projectId="demo"
            title={DEMO_PROJECT_TITLE}
            duration={DEMO_RECEIPT.durationSeconds}
            receipt={DEMO_RECEIPT_TICKET}
          />
        </div>
      ) : project?.finalVideoUrl && projectId ? (
        <div style={{ maxWidth: 460, margin: '28px auto 0' }}>
          <RenderReceiptTicket
            projectId={projectId}
            title={project.sourceTitle ?? null}
            duration={project.audioDuration ?? null}
          />
        </div>
      ) : null}

      <Footer />
    </div>
  );
}

/* DEMO_RECEIPT in the shape the receipt endpoint returns. Nothing is invented:
 * the ops rate is opsUsd ÷ minutes, and the single compute line is the
 * reconciled compute total — #23's per-stage split is not in the demo bundle,
 * so it is shown as one honest row rather than a made-up breakdown. */
const DEMO_PROJECT_TITLE = 'The Quiet Exit — My Money Mindset';
const DEMO_RECEIPT_TICKET: RenderReceipt = {
  computeUsd: DEMO_RECEIPT.computeUsd,
  byStage: [{ key: 'compute', label: 'compute — at cost', usd: DEMO_RECEIPT.computeUsd }],
  minutes: DEMO_RECEIPT.minutes,
  opsRate: Math.round((DEMO_RECEIPT.opsUsd / DEMO_RECEIPT.minutes) * 100) / 100,
  opsUsd: DEMO_RECEIPT.opsUsd,
  totalUsd: DEMO_RECEIPT.totalUsd,
  estimateUsd: DEMO_RECEIPT.totalUsd,
  cappedAt: null,
  debitedCents: Math.round(DEMO_RECEIPT.totalUsd * 100),
  refundedCents: null,
  refundReason: null,
  netChargedCents: Math.round(DEMO_RECEIPT.totalUsd * 100),
  wallClockSec: null,
  unmetered: false,
};

/* Wrapper that neutralises the step area in demo mode and renders it
 * untouched otherwise — no extra DOM node in the signed-in path. */
function StepArea({
  disabled,
  label,
  children,
}: {
  disabled: boolean;
  /** aria-label for the disabled wrapper; defaults to the demo wording. */
  label?: string;
  children: React.ReactNode;
}): React.ReactElement {
  if (!disabled) return <>{children}</>;
  return (
    <fieldset
      disabled
      aria-label={label ?? 'Read-only demo — sign up to render'}
      style={{
        border: 0,
        margin: 0,
        padding: 0,
        minInlineSize: 0,
        pointerEvents: 'none',
        opacity: label ? 0.55 : undefined,
      }}
    >
      {children}
    </fieldset>
  );
}

/* Sticky "this is a demo" strip with the only live control on the page. */
function DemoBanner(): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        padding: '12px 16px',
        marginBottom: 16,
        borderRadius: JELLY_TOKENS.radius.md,
        border: `1px solid ${t.border}`,
        background: t.card,
      }}
    >
      <Icon name="sparkle" size={18} color={JELLY_TOKENS.brand} />
      <div style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
          You&rsquo;re looking at a real finished video — {DEMO_RECEIPT.minutes} minutes,
          ${DEMO_RECEIPT.totalUsd.toFixed(2)} all in.
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
          Every control below is switched off in this preview. Sign up to render
          your own script.
        </div>
      </div>
      <a
        href={DEMO_CTA_HREF}
        style={{
          padding: '9px 18px',
          borderRadius: JELLY_TOKENS.radius.full,
          background: JELLY_TOKENS.gradCreate,
          color: JELLY_TOKENS.onGradient,
          fontSize: 13,
          fontWeight: 600,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {DEMO_CTA_LABEL}
      </a>
    </div>
  );
}

/* Renders a small pending/in-progress/done icon row underneath the pill
 * stepper. We stay aligned with PillStepper visually by sharing its 4px
 * gutter, and we hide on screens < 480px to avoid overflow. */
function StepStateRow({ states }: { states: StepState[] }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        flexWrap: 'wrap',
        justifyContent: 'center',
        fontSize: 11,
        color: t.textSecondary,
      }}
    >
      {states.map((s, i) => {
        const label = EDITOR_STEPS[i];
        let badge = '';
        let color = t.textSecondary;
        if (s === 'done') {
          badge = '✓';
          color = JELLY_TOKENS.success;
        } else if (s === 'in-progress') {
          badge = '…';
          // In-flight reads cyan everywhere in the cinema language.
          color = JELLY_TOKENS.cyan;
        } else {
          badge = '·';
        }
        return (
          <span
            key={i}
            style={{
              padding: '2px 8px',
              borderRadius: JELLY_TOKENS.radius.full,
              border: `1px solid ${t.border}`,
              background: t.card,
              color,
              minWidth: 64,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden style={{ marginRight: 4 }}>{badge}</span>
            {label}
          </span>
        );
      })}
    </div>
  );
}

/* DescriptionStep wrapper that detects when the user has run Generate (the
 * underlying step shows the result inline; we attach a MutationObserver-free
 * heuristic by overriding refresh to also flip our "done" flag once the
 * user has interacted with the step). The cleaner path is to extend
 * EditorStepProps with an onCompleted callback; the existing step doesn't
 * use it, so we simulate it by detecting any successful refresh after the
 * user lands on the step. */
function DescriptionStepWrapper({
  stepProps,
  onCompleted,
}: {
  stepProps: EditorStepProps;
  onCompleted: () => void;
}): React.ReactElement {
  /* The DescriptionStep component itself owns the "generated" local state;
   * since its result isn't persisted on the project row we can't observe
   * it from here. We treat reaching the step + a successful project
   * refresh as "engaged"; the onCompleted callback is wired to the
   * Description step via a passthrough refresh that also flips the flag.
   * This is intentionally optimistic — when the description text never
   * lands on the project the rest of the shell still treats step 6 as
   * the terminal step. */
  const wrappedRefresh = React.useCallback(async () => {
    await stepProps.refresh();
    onCompleted();
  }, [stepProps, onCompleted]);
  return (
    <DescriptionStep
      projectId={stepProps.projectId}
      project={stepProps.project}
      refresh={wrappedRefresh}
    />
  );
}


/* ── RenderInFlightBar ───────────────────────────────────────────────────
 * Shown whenever the project status is an in-flight pipeline phase. Beta
 * testers watched "generating a voice… running on its own" with no banner,
 * no % and no way to stop it — this is that banner. Cancel goes through
 * POST /api/vater/youtube/[id]/cancel (refund logic is server-side).
 */
function RenderInFlightBar({
  projectId,
  status,
  progress,
  refresh,
}: {
  projectId: string;
  status: string | null;
  progress: number | null;
  refresh: () => Promise<void>;
}): React.ReactElement {
  const { t } = useTheme();
  const [cancelling, setCancelling] = React.useState(false);
  /* Request/run pair replacing window.confirm() before the cancel POST. */
  const [confirmStop, setConfirmStop] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const label =
    (status && STATUS_LABELS[status as YouTubeProjectStatus]) || 'Rendering';
  const pct =
    typeof progress === 'number' && Number.isFinite(progress)
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : null;

  const cancel = async (): Promise<void> => {
    if (cancelling) return;
    setConfirmStop(false);
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/cancel`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Cancel failed (HTTP ${res.status})`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div
      data-testid="render-inflight-bar"
      style={{
        maxWidth: 700,
        margin: '0 auto 20px',
        padding: '12px 16px',
        borderRadius: JELLY_TOKENS.radius.xl,
        border: `1px solid ${JELLY_TOKENS.brandOutline}`,
        background: JELLY_TOKENS.brandGhost,
        fontFamily: JELLY_TOKENS.font,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          aria-hidden
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: JELLY_TOKENS.brand,
            animation: 'jc-blink 1.6s ease-in-out infinite',
            flex: 'none',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
          {label}
          {pct != null ? ` · ${pct}%` : ''}
        </span>
        <span style={{ fontSize: 12, color: t.textSecondary, flex: '1 1 200px' }}>
          This page updates itself — you can leave and watch it from the Queue.
        </span>
        <button
          type="button"
          onClick={() => setConfirmStop(true)}
          disabled={cancelling}
          style={{
            fontSize: 12,
            padding: '6px 12px',
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${JELLY_TOKENS.error}66`,
            background: 'transparent',
            color: JELLY_TOKENS.error,
            cursor: cancelling ? 'default' : 'pointer',
          }}
        >
          {cancelling ? 'Stopping…' : 'Cancel render'}
        </button>
      </div>
      {pct != null && (
        <div
          style={{
            marginTop: 10,
            height: 5,
            borderRadius: 999,
            background: JELLY_TOKENS.brandOutline,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: 999,
              background: JELLY_TOKENS.brand,
              transition: 'width 600ms ease',
            }}
          />
        </div>
      )}
      {error && (
        <div style={{ marginTop: 8, fontSize: 12, color: JELLY_TOKENS.error }}>
          {error}
        </div>
      )}
      <ConfirmDialog
        open={confirmStop}
        title="Stop this render?"
        body="You are never charged for a render that does not finish."
        confirmLabel="Stop render"
        danger
        onConfirm={() => void cancel()}
        onCancel={() => setConfirmStop(false)}
      />
    </div>
  );
}
