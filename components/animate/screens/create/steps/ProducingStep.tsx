'use client';

/* Step 7 — Producing… (async). Jelly Auto rows show the live phase ladder
 * (RenderProgress) under the three-stage rail; Fable 5 rows show the ticket
 * card with its stage chips. failed → the error and a Retry that re-calls
 * produce with the engine the row was on.
 */

import * as React from 'react';
import { useTheme } from '../../../theme-context';
import { VBtn } from '../../../primitives';
import { RenderProgress } from '../../live/RenderProgress';
import { RenderTerminal } from '../../../RenderTerminal';
import { CustomerStageRail } from '../../studio/CustomerStageRail';
import { CustomerStageChip } from '../../studio/CustomerStageChip';
import { ConciergeStatusCard } from '../../editor/ConciergeStatusCard';
import { NotifyOptInCard } from '../../../NotifyOptInCard';
import { BillingBlockModal, BillingBlockedError, type BillingBlockReason, type BillingBlockContext } from '../../editor/BillingBlock';
import { customerStage, isConciergeStatus, STATUS_LABELS, type YouTubeProjectStatus } from '@/lib/vater/youtube-status';
import { readConciergeClient, readEngineClient } from '@/lib/vater/concierge-client';
import { DriveSyncChip } from '../../../DriveSyncChip';
import { useCreateFlow } from '../create-context';
import { createApi, errorMessage } from '../create-api';
import { StepCard, ErrorNote, StepActions, DoneSummary, PulseCard } from './step-ui';

export function ProducingStep(): React.ReactElement {
  const { t } = useTheme();
  const flow = useCreateFlow();
  const { project, derived, readOnly } = flow;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [block, setBlock] = React.useState<BillingBlockReason | null>(null);
  const [blockCtx, setBlockCtx] = React.useState<BillingBlockContext | undefined>(undefined);

  if (!project || !derived) {
    return (
      <StepCard testId="producing-empty">
        <div style={{ color: t.textSecondary, fontSize: 14 }}>Nothing is rendering yet — pick an engine on step 6.</div>
      </StepCard>
    );
  }

  if (readOnly) {
    return (
      <DoneSummary onContinue={() => flow.goTo(derived.step)} continueLabel="See the video →" testId="producing-done">
        Rendered. Your video is in the Library.
      </DoneSummary>
    );
  }

  const engine = readEngineClient(project.settingsJson);
  const ticket = readConciergeClient(project.settingsJson);
  const concierge = isConciergeStatus(project.status) || (engine === 'fable5' && ticket);

  const retry = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const { project: row } = await createApi.produce(project.id, engine);
      flow.adopt(row);
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBlock(err.reason);
        setBlockCtx(err.context);
      } else setError(errorMessage(err, 'Could not restart the render'));
    } finally {
      setBusy(false);
    }
  };

  if (derived.kind === 'failed') {
    return (
      <>
        <StepCard testId="producing-failed">
          <ErrorNote testId="producing-error">
            The render failed{project.errorMessage ? `: ${project.errorMessage}` : ''}. Failed renders are never charged.
          </ErrorNote>
          <StepActions>
            <VBtn variant="ghost" onClick={() => flow.goTo(6)} disabled={busy}>← Pick a different engine</VBtn>
            <VBtn onClick={() => void retry()} disabled={busy} data-testid="producing-retry">{busy ? 'Starting…' : 'Retry'}</VBtn>
          </StepActions>
        </StepCard>
        <BillingBlockModal reason={block} context={blockCtx} projectId={project.id} onClose={() => setBlock(null)} />
      </>
    );
  }

  const phase = STATUS_LABELS[project.status as YouTubeProjectStatus] ?? project.status;

  return (
    <>
      <PulseCard
        title={concierge ? 'Fable 5 is on it…' : 'Producing your video…'}
        line={concierge ? undefined : phase}
        testId="producing-pulse"
      >
        <DriveSyncChip project={project} onSynced={flow.adopt} style={{ alignSelf: 'flex-start' }} />
        <div style={{ fontSize: 13.5, color: t.text, lineHeight: 1.6, fontWeight: 500 }}>
          You can leave — the Progress tab will light up and we&rsquo;ll email you when it lands in your Library.
        </div>
        {concierge && <CustomerStageChip status={project.status} project={project} />}
        {error && <ErrorNote>{error}</ErrorNote>}
      </PulseCard>

      {concierge && ticket ? (
        <ConciergeStatusCard projectId={project.id} status={project.status} ticket={ticket} refresh={flow.refresh} />
      ) : (
        <>
          <CustomerStageRail current={customerStage(project) ?? 'in_progress'} caption="Queued, being made, then ready to play in Library." />
          <RenderProgress project={project} hideLog />
        </>
      )}
      {/* The terminal box — every lane, including Fable 5 (the site never
          polls concierge rows, so this is the only place its lines show). */}
      <RenderTerminal projectId={project.id} active={derived.kind === 'async'} compact={false} initialLines={project.stepDetails?.logs} />
      <NotifyOptInCard compact />
    </>
  );
}
