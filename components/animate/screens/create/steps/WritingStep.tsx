'use client';

/* Step 4 — Writing… (async, pulses in the sidebar). Nothing to click: the
 * DGX is extracting principles and writing the script. The customer can
 * leave; the Progress badge, an email and (opt-in) a push bring them back.
 */

import * as React from 'react';
import { useTheme } from '../../../theme-context';
import { VBtn } from '../../../primitives';
import { STATUS_LABELS, type YouTubeProjectStatus } from '@/lib/vater/youtube-status';
import { RenderProgress } from '../../live/RenderProgress';
import { RenderTerminal } from '../../../RenderTerminal';
import { NotifyOptInCard } from '../../../NotifyOptInCard';
import { BillingBlockModal, BillingBlockedError, type BillingBlockReason, type BillingBlockContext } from '../../editor/BillingBlock';
import { useCreateFlow } from '../create-context';
import { createApi, errorMessage } from '../create-api';
import { StepCard, ErrorNote, StepActions, DoneSummary, PulseCard, wordsIn } from './step-ui';

export function WritingStep(): React.ReactElement {
  const { t } = useTheme();
  const flow = useCreateFlow();
  const { project, derived, readOnly } = flow;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [block, setBlock] = React.useState<BillingBlockReason | null>(null);
  const [blockCtx, setBlockCtx] = React.useState<BillingBlockContext | undefined>(undefined);

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

  const tryAgain = async (): Promise<void> => {
    if (!project.transcript) {
      flow.goTo(1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const row = await createApi.fromTranscript({
        transcript: project.transcript,
        sourceUrl: project.sourceUrl,
        targetDuration: project.targetDuration,
        projectId: project.id,
      });
      flow.adopt(row);
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBlock(err.reason);
        setBlockCtx(err.context);
      } else setError(errorMessage(err, 'Could not restart the writer'));
    } finally {
      setBusy(false);
    }
  };

  if (derived.kind === 'failed') {
    return (
      <>
        <StepCard testId="writing-failed">
          <ErrorNote testId="writing-error">
            Writing failed{project.errorMessage ? `: ${project.errorMessage}` : ''}. Nothing was charged for a script that did not land.
          </ErrorNote>
          <StepActions>
            <VBtn variant="ghost" onClick={() => flow.goTo(3)} disabled={busy}>← Change the length</VBtn>
            <VBtn onClick={() => void tryAgain()} disabled={busy} data-testid="writing-retry">{busy ? 'Starting…' : 'Try again'}</VBtn>
          </StepActions>
        </StepCard>
        <BillingBlockModal reason={block} context={blockCtx} projectId={project.id} onClose={() => setBlock(null)} />
      </>
    );
  }

  const phase = STATUS_LABELS[project.status as YouTubeProjectStatus] ?? project.status;
  const hasLogs = Array.isArray(project.stepDetails?.logs) && project.stepDetails!.logs!.length > 0;

  return (
    <>
      <PulseCard title="Writing your script…" line={phase} testId="writing-pulse">
        <div style={{ fontSize: 13.5, color: t.textSecondary, lineHeight: 1.6 }}>
          Kimi is reading the transcript, pulling the principles and writing your script under your rules. A few minutes.
        </div>
        <div data-testid="writing-leave-note" style={{ fontSize: 13.5, color: t.text, lineHeight: 1.6, fontWeight: 500 }}>
          You can leave — the Progress tab will light up and we&rsquo;ll email you when it is ready to review.
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
      </PulseCard>
      {hasLogs && <RenderProgress project={project} hideLog />}
      <RenderTerminal projectId={project.id} active={derived.kind === 'async'} compact={false} initialLines={project.stepDetails?.logs} />
      <NotifyOptInCard />
    </>
  );
}
