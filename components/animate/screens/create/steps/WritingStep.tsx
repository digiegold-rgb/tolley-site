'use client';

/* Step 4 — Writing. The on-site Claude editor (model / quote / generate /
 * live edit / undo). A leftover DGX `scripting` job still pulses here.
 *
 * Own-script and generate-from-video both land on this same editor.
 */

import * as React from 'react';
import { useTheme } from '../../../theme-context';
import { VBtn } from '../../../primitives';
import { STATUS_LABELS, type YouTubeProjectStatus } from '@/lib/vater/youtube-status';
import { RenderProgress } from '../../live/RenderProgress';
import { RenderTerminal } from '../../../RenderTerminal';
import { NotifyOptInCard } from '../../../NotifyOptInCard';
import { ScriptReviewCard } from '../../review/ScriptReviewCard';
import { BillingBlockModal, BillingBlockedError, type BillingBlockReason, type BillingBlockContext } from '../../editor/BillingBlock';
import { useCreateFlow } from '../create-context';
import { createApi, errorMessage } from '../create-api';
import { ScriptWriterControls } from './ScriptWriterControls';
import { StepCard, Lede, ErrorNote, StepActions, DoneSummary, PulseCard, wordsIn } from './step-ui';

export function WritingStep(): React.ReactElement {
  const { t } = useTheme();
  const flow = useCreateFlow();
  const { project, derived, readOnly } = flow;
  const [draft, setDraft] = React.useState(project?.script ?? '');
  const [saved, setSaved] = React.useState(project?.script ?? '');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [block, setBlock] = React.useState<BillingBlockReason | null>(null);
  const [blockCtx, setBlockCtx] = React.useState<BillingBlockContext | undefined>(undefined);

  const serverScript = project?.script ?? '';
  React.useEffect(() => {
    if (draft === saved) setDraft(serverScript);
    setSaved(serverScript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, serverScript]);

  /** Reopen the length slider. Derived step is 4 whenever flowStep >= 4 on
   *  a transcribed row, so goTo(3) alone lands on a locked DoneSummary.
   *  Patch flowStep back to 3 first — no charge, no jump ahead. */
  const reopenLength = async (): Promise<void> => {
    if (!project) return;
    setBusy(true);
    setError(null);
    try {
      // On a transcribed row, derived step is 4 whenever flowStep >= 4.
      // Patch back to 3 so Length is the live step, not a locked summary.
      // Own-script (no transcript) must not PATCH — derive would drop to Source.
      if (wordsIn(project.transcript) > 0) {
        const row = await createApi.patchProject(project.id, { flowStep: 3 });
        flow.adopt(row);
      }
      flow.goTo(3);
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBlock(err.reason);
        setBlockCtx(err.context);
      } else setError(errorMessage(err, 'Could not reopen the length'));
    } finally {
      setBusy(false);
    }
  };

  if (!project || !derived) {
    return (
      <StepCard testId="writing-empty">
        <div style={{ color: t.textSecondary, fontSize: 14 }}>Nothing is being written yet — start from step 1.</div>
      </StepCard>
    );
  }

  if (readOnly) {
    return (
      <DoneSummary onContinue={() => flow.goTo(derived.step)} continueLabel={`Continue to step ${derived.step} →`} testId="writing-done">
        Your script is written — {wordsIn(project.script).toLocaleString()} words.
      </DoneSummary>
    );
  }

  if (derived.kind === 'failed') {
    return (
      <>
        <StepCard testId="writing-failed">
          <ErrorNote testId="writing-error">
            Writing failed{project.errorMessage ? `: ${project.errorMessage}` : ''}. Nothing was charged for a script that did not land.
          </ErrorNote>
          <StepActions>
            <VBtn variant="ghost" onClick={() => void reopenLength()} disabled={busy} data-testid="writing-change-length">
              ← Change length
            </VBtn>
          </StepActions>
        </StepCard>
        <BillingBlockModal reason={block} context={blockCtx} projectId={project.id} onClose={() => setBlock(null)} />
      </>
    );
  }

  // Leftover DGX writer still in flight.
  if (derived.kind === 'async') {
    const phase = STATUS_LABELS[project.status as YouTubeProjectStatus] ?? project.status;
    const hasLogs = Array.isArray(project.stepDetails?.logs) && project.stepDetails!.logs!.length > 0;
    return (
      <>
        <PulseCard title="Writing your script…" line={phase} testId="writing-pulse">
          <div style={{ fontSize: 13.5, color: t.textSecondary, lineHeight: 1.6 }}>
            The previous writer is still finishing. You can leave — the Progress tab will light up when it is ready.
          </div>
          <div data-testid="writing-leave-note" style={{ fontSize: 13.5, color: t.text, lineHeight: 1.6, fontWeight: 500 }}>
            You can leave — the Progress tab will light up and we&rsquo;ll email you when it is ready to review.
          </div>
        </PulseCard>
        {hasLogs && <RenderProgress project={project} hideLog />}
        <RenderTerminal projectId={project.id} active compact={false} initialLines={project.stepDetails?.logs} />
        <NotifyOptInCard />
      </>
    );
  }

  const continueToReview = async (): Promise<void> => {
    if (wordsIn(draft) === 0) {
      setError('Generate or paste a script first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let row = project;
      if (draft !== saved) {
        row = await createApi.patchProject(project.id, { script: draft, flowStep: 5 });
      } else {
        row = await createApi.patchProject(project.id, { flowStep: 5 });
      }
      flow.adopt(row);
      setSaved(draft);
      flow.goTo(5);
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBlock(err.reason);
        setBlockCtx(err.context);
      } else setError(errorMessage(err, 'Could not save the script'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <StepCard testId="writing-step">
        <Lede>
          Same editor whether you brought a script or a video. Pick a model, see the quote, generate,
          then edit any time. Undo keeps the last good draft.
        </Lede>
        <ScriptWriterControls
          project={project}
          draft={draft}
          disabled={busy}
          onGenerated={(row) => {
            setDraft(row.script ?? '');
            setSaved(row.script ?? '');
          }}
        />
      </StepCard>

      <StepCard testId="writing-editor">
        <ScriptReviewCard
          project={project}
          draft={draft}
          saved={saved}
          onDraftChange={setDraft}
          disabled={busy}
          minHeight={280}
          testId="writing-script"
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <StepActions
          left={
            <span style={{ fontSize: 12, color: t.textSecondary }}>
              {draft !== saved ? 'Unsaved edits — Continue saves the text in the box.' : 'Continue is free. Generate is the paid click.'}
            </span>
          }
        >
          <VBtn
            variant="ghost"
            onClick={() => void reopenLength()}
            disabled={busy}
            data-testid="writing-change-length"
          >
            ← Change length
          </VBtn>
          <VBtn
            onClick={() => void continueToReview()}
            disabled={busy || wordsIn(draft) === 0}
            data-testid="writing-continue"
          >
            {busy ? 'Saving…' : 'Continue to review →'}
          </VBtn>
        </StepActions>
      </StepCard>
      <BillingBlockModal reason={block} context={blockCtx} projectId={project.id} onClose={() => setBlock(null)} />
    </>
  );
}
