'use client';

/* CreateScreen — the full-screen stepped Create flow (route `create`,
 * 2026-08-28). Replaces the 1,800-line StylePickerModal as the way a video
 * starts; the modal survives only for batch mode (Fable 5, ≤10 scripts).
 *
 *   1 Source · 2 Transcript · 3 Length · 4 Writing… · 5 Review script
 *   6 Choose engine · 7 Producing… · 8 Done
 *
 * State model (lib/vater/create-steps.ts): the project row is the truth.
 * `deriveCreateStep(project)` says how far the machine has moved; the URL's
 * `s` says which step the customer is LOOKING at. The view is clamped to the
 * derived step (you cannot jump ahead of the data), steps behind the machine
 * render read-only, and when the machine moves the hash is REPLACED to the
 * new step (server wins) — never pushed, so Back still walks history.
 *
 * Every user-driven step change goes through `setEditorStep`, which the
 * Shell's hash writer turns into a pushState. Back = previous step.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { MicroLabel, GlassCard } from '../../cinema';
import { VBtn } from '../../primitives';
import { deriveCreateStep, stepDef, CREATE_STEP_COUNT, type DerivedCreateStep } from '@/lib/vater/create-steps';
import { refreshProgress } from '../../ProgressBadgeProvider';
import { useCreatePoll } from './useCreatePoll';
import { createApi, type CreateProject, type StyleSummary } from './create-api';
import { CreateFlowContext, type CreateFlowValue } from './create-context';
import { CreateStepper } from './CreateStepper';
import { SourceStep } from './steps/SourceStep';
import { TranscriptStep } from './steps/TranscriptStep';
import { LengthStep } from './steps/LengthStep';
import { WritingStep } from './steps/WritingStep';
import { ReviewStep } from './steps/ReviewStep';
import { EngineStep } from './steps/EngineStep';
import { ProducingStep } from './steps/ProducingStep';
import { DoneStep } from './steps/DoneStep';

/** Same param order as the Shell's hash writer, so a replaceState here and
 *  the writer's own target compare equal and nothing double-pushes. */
function shellHash(projectId: string, step: number): string {
  const params = new URLSearchParams();
  params.set('r', 'create');
  if (step > 0) params.set('s', String(step));
  params.set('p', projectId);
  return `#${params.toString()}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Below this width the rail goes horizontal above the panel. */
const STACK_BELOW = 900;

function useStacked(): boolean {
  const [stacked, setStacked] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${STACK_BELOW - 1}px)`);
    const sync = (): void => setStacked(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return stacked;
}

export function CreateScreen(): React.ReactElement {
  const { t } = useTheme();
  const { selectedProjectId, editorStep, setEditorStep, setSelectedProjectId } = useRoute();
  const poll = useCreatePoll(selectedProjectId);
  const project = poll.project;
  const stacked = useStacked();

  // Step 1 → 2 hand-off before a row exists.
  const [pendingUrl, setPendingUrl] = React.useState('');

  // Styles: the voice + cast a new row is born with. Canon first.
  const [styles, setStyles] = React.useState<StyleSummary[]>([]);
  const [stylesLoaded, setStylesLoaded] = React.useState(false);
  const [styleId, setStyleId] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { styles: list, lockedStyleId } = await createApi.listStyles();
        if (cancelled) return;
        const canon = lockedStyleId && list.some((s) => s.id === lockedStyleId) ? lockedStyleId : null;
        const ordered = canon ? [...list.filter((s) => s.id === canon), ...list.filter((s) => s.id !== canon)] : list;
        setStyles(ordered);
        setStyleId((prev) => prev ?? canon ?? ordered[0]?.id ?? null);
      } catch {
        /* the Source step shows the "no styles" notice */
      } finally {
        if (!cancelled) setStylesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const derived: DerivedCreateStep | null = React.useMemo(
    () => (project ? deriveCreateStep(project) : null),
    [project],
  );

  // How far the customer may look. No row yet: 1, or 2 once a URL is queued.
  const maxStep = derived ? derived.step : pendingUrl ? 2 : 1;
  const requested = editorStep > 0 ? editorStep : maxStep;
  const viewStep = clamp(requested, 1, maxStep);
  const readOnly = derived !== null && viewStep < derived.step;

  /* Server wins. Whenever the derived step CHANGES (first load, a poll that
   * moved the machine, a POST we adopted) the view snaps to it and the hash
   * is replaced — not pushed — so Back keeps walking the customer's own
   * clicks. A stale `s` (reload after the machine moved, `s=8` on a row
   * parked at 6) lands here too. */
  const lastDerived = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!project || !derived) return;
    const key = `${project.id}:${derived.step}`;
    if (lastDerived.current === key) return;
    lastDerived.current = key;
    if (editorStep !== derived.step) {
      window.history.replaceState({ v2: true }, '', `${window.location.pathname}${window.location.search}${shellHash(project.id, derived.step)}`);
      setEditorStep(derived.step);
    }
  }, [project, derived, editorStep, setEditorStep]);

  // Leaving with no row: forget the queued URL so a fresh `#r=create` is clean.
  React.useEffect(() => {
    if (!selectedProjectId) lastDerived.current = null;
  }, [selectedProjectId]);

  /* The 5s project poll sees the machine move before the 15s badge poll does.
   * Pull the badge forward on every kind change so the sidebar (and the
   * "ready to review" toast) follow this screen, not the slower clock. */
  const lastKind = React.useRef<string | null>(null);
  React.useEffect(() => {
    const kind = derived?.kind ?? null;
    if (lastKind.current !== null && kind !== null && lastKind.current !== kind) refreshProgress();
    lastKind.current = kind;
  }, [derived?.kind]);

  const { setProject, refresh } = poll;
  const adopt = React.useCallback(
    (p: CreateProject) => {
      setProject(p);
      if (selectedProjectId !== p.id) setSelectedProjectId(p.id);
      refreshProgress();
    },
    [setProject, selectedProjectId, setSelectedProjectId],
  );

  const goTo = React.useCallback(
    (step: number) => {
      setEditorStep(clamp(Math.round(step), 1, CREATE_STEP_COUNT));
    },
    [setEditorStep],
  );

  const value = React.useMemo<CreateFlowValue>(
    () => ({
      project,
      derived,
      viewStep,
      readOnly,
      adopt,
      goTo,
      refresh,
      styles,
      stylesLoaded,
      styleId,
      setStyleId,
      pendingUrl,
      setPendingUrl,
    }),
    [project, derived, viewStep, readOnly, adopt, goTo, refresh, styles, stylesLoaded, styleId, pendingUrl],
  );

  const def = stepDef(viewStep);
  const title = project?.publishTitle || project?.sourceTitle || project?.topic || null;

  let panel: React.ReactNode;
  if (selectedProjectId && poll.loading && !project) {
    panel = (
      <GlassCard padding={24} data-testid="create-loading">
        <div style={{ color: t.textSecondary, fontSize: 14 }}>Loading your project…</div>
      </GlassCard>
    );
  } else if (selectedProjectId && !project && poll.error) {
    panel = (
      <GlassCard padding={24} data-testid="create-load-error">
        <div style={{ color: JELLY_TOKENS.error, fontSize: 14, marginBottom: 12 }}>{poll.error}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <VBtn size="sm" onClick={() => void poll.refresh()}>Try again</VBtn>
          <VBtn size="sm" variant="ghost" onClick={() => { setSelectedProjectId(null); setEditorStep(0); }}>
            Start over
          </VBtn>
        </div>
      </GlassCard>
    );
  } else {
    switch (viewStep) {
      case 1: panel = <SourceStep />; break;
      case 2: panel = <TranscriptStep />; break;
      case 3: panel = <LengthStep />; break;
      case 4: panel = <WritingStep />; break;
      case 5: panel = <ReviewStep />; break;
      case 6: panel = <EngineStep />; break;
      case 7: panel = <ProducingStep />; break;
      default: panel = <DoneStep />; break;
    }
  }

  return (
    <CreateFlowContext.Provider value={value}>
      <div
        data-testid="create-screen"
        data-step={viewStep}
        data-derived-step={derived?.step ?? ''}
        data-kind={derived?.kind ?? ''}
        style={{
          display: 'flex',
          flexDirection: stacked ? 'column' : 'row',
          gap: 24,
          alignItems: 'flex-start',
          width: '100%',
          maxWidth: 1180,
        }}
      >
        <aside
          style={{
            width: stacked ? '100%' : 280,
            minWidth: stacked ? 0 : 280,
            position: stacked ? 'static' : 'sticky',
            top: 24,
            flexShrink: 0,
          }}
        >
          <CreateStepper
            current={viewStep}
            derived={derived}
            maxStep={maxStep}
            onSelect={goTo}
            orientation={stacked ? 'horizontal' : 'vertical'}
            compact={stacked}
          />
        </aside>
        <section style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <MicroLabel tone="cyan">
              STUDIO — CREATE · STEP {viewStep} OF {CREATE_STEP_COUNT}
            </MicroLabel>
            <h2
              data-testid="create-step-title"
              style={{
                margin: 0,
                fontFamily: JELLY_TOKENS.font,
                fontWeight: 600,
                fontSize: 'clamp(26px, 3vw, 32px)',
                letterSpacing: '-0.02em',
                color: t.text,
                lineHeight: 1.15,
              }}
            >
              {def.label}
            </h2>
            {title && (
              <div style={{ fontSize: 13.5, color: t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </div>
            )}
          </div>
          {readOnly && (
            <div
              data-testid="create-readonly-note"
              style={{
                fontSize: 12.5,
                color: t.textSecondary,
                padding: '8px 12px',
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px dashed ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ flex: 1, minWidth: 180 }}>
                This step is done — you are looking back. The project is on step {derived!.step}, {stepDef(derived!.step).label}.
              </span>
              <VBtn size="sm" variant="ghost" onClick={() => goTo(derived!.step)} data-testid="create-jump-current">
                Go to step {derived!.step} →
              </VBtn>
            </div>
          )}
          {panel}
        </section>
      </div>
    </CreateFlowContext.Provider>
  );
}
