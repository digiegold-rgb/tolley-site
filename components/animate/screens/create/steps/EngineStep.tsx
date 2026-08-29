'use client';

/* Step 6 — Choose engine. THE money click.
 *
 * EnginePicker (Jelly Auto / Fable 5 Concierge) + the existing
 * RenderConfirmModal fed by [id]/preflight + [id]/estimate. Confirm →
 * POST [id]/produce {engine}. 402 → the add-credit wall. Nothing else here
 * spends anything.
 */

import * as React from 'react';
import { useTheme, useRoute } from '../../../theme-context';
import { VBtn } from '../../../primitives';
import { EnginePicker, type ConciergeEngine } from '../../../engine/EnginePicker';
import { RenderConfirmModal, type RenderManifest } from '../../../engine/RenderConfirmModal';
import { useRenderEstimate } from '../../editor/use-render-estimate';
import { BillingBlockModal, BillingBlockedError, type BillingBlockReason, type BillingBlockContext } from '../../editor/BillingBlock';
import { quickEstimateUsd } from '@/lib/vater/billing/estimate';
import { readEngineClient, CONCIERGE_ENGINE_COPY } from '@/lib/vater/concierge-client';
import { useCreateFlow } from '../create-context';
import { createApi, errorMessage, isExpiredError } from '../create-api';
import { StepCard, Lede, ErrorNote, StepActions, DoneSummary, wordsIn } from './step-ui';

export function EngineStep(): React.ReactElement {
  const { t } = useTheme();
  const { openProjectInEditor, setRoute } = useRoute();
  const flow = useCreateFlow();
  const { project, derived, readOnly } = flow;
  const estimate = useRenderEstimate(project?.id ?? null);

  const [engine, setEngine] = React.useState<ConciergeEngine>('auto');
  const [confirm, setConfirm] = React.useState<ConciergeEngine | null>(null);
  const [manifest, setManifest] = React.useState<RenderManifest | null>(null);
  const [manifestLoading, setManifestLoading] = React.useState(false);
  const [manifestError, setManifestError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<'produce' | 'reopen' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [block, setBlock] = React.useState<BillingBlockReason | null>(null);
  const [blockCtx, setBlockCtx] = React.useState<BillingBlockContext | undefined>(undefined);

  if (!project || !derived) {
    return (
      <StepCard testId="engine-empty">
        <div style={{ color: t.textSecondary, fontSize: 14 }}>Approve a script first (step 5).</div>
      </StepCard>
    );
  }

  const words = wordsIn(project.script);
  const animated = (project.animUntilS ?? 0) > 0;
  const est = animated ? estimate.fullUsd ?? estimate.draftUsd : estimate.draftUsd;
  const estimateUsd = est ?? (words > 0 ? quickEstimateUsd(words) : null);

  if (readOnly) {
    const chosen = readEngineClient(project.settingsJson);
    return (
      <DoneSummary onContinue={() => flow.goTo(derived.step)} continueLabel={`Continue to step ${derived.step} →`} testId="engine-done">
        Engine: {CONCIERGE_ENGINE_COPY[chosen].name}. Render started — see step {derived.step} or the Progress tab.
      </DoneSummary>
    );
  }

  const reopen = async (): Promise<void> => {
    setBusy('reopen');
    setError(null);
    try {
      flow.adopt(await createApi.reopen(project.id));
    } catch (err) {
      setError(errorMessage(err, 'Could not reopen'));
    } finally {
      setBusy(null);
    }
  };

  if (derived.kind === 'expired') {
    return (
      <StepCard variant="ticket" testId="engine-expired">
        <div style={{ fontSize: 18, fontWeight: 600, color: t.text }}>This approval expired after 7 days</div>
        <Lede>Reopen to continue — you re-approve the script (free) and land back here to pick an engine.</Lede>
        {error && <ErrorNote>{error}</ErrorNote>}
        <StepActions>
          <VBtn onClick={() => void reopen()} disabled={busy !== null} data-testid="engine-reopen">
            {busy === 'reopen' ? 'Reopening…' : 'Reopen'}
          </VBtn>
        </StepActions>
      </StepCard>
    );
  }

  const openConfirm = async (): Promise<void> => {
    setConfirm(engine);
    setManifestLoading(true);
    setManifestError(null);
    setError(null);
    try {
      const m = await createApi.preflight(project.id);
      setManifest(m);
    } catch (err) {
      setManifestError(errorMessage(err, 'Could not check the project setup'));
    } finally {
      setManifestLoading(false);
    }
  };

  const produce = async (): Promise<void> => {
    if (!confirm) return;
    setBusy('produce');
    setError(null);
    try {
      const { project: row } = await createApi.produce(project.id, confirm);
      setConfirm(null);
      flow.adopt(row);
      flow.goTo(7);
    } catch (err) {
      setConfirm(null);
      if (err instanceof BillingBlockedError) {
        setBlock(err.reason);
        setBlockCtx(err.context);
      } else if (isExpiredError(err)) {
        setError('This approval expired — reopen it to continue.');
        void flow.refresh();
      } else {
        setError(errorMessage(err, 'Could not start the render'));
        if (err instanceof Error && /409/.test(err.message)) void flow.refresh();
      }
    } finally {
      setBusy(null);
    }
  };

  const chosen = engine === 'fable5' ? 'Send to Fable 5' : 'Produce with Jelly';

  return (
    <>
      <StepCard testId="engine-step">
        <Lede>Who directs this? Same price either way. This is the one click that spends credit — you confirm the full manifest first.</Lede>
        <EnginePicker
          value={engine}
          onChange={(e) => {
            setEngine(e);
            setError(null);
          }}
          estimateUsd={estimateUsd}
          estimateLoading={estimate.loading}
          disabled={busy !== null}
        />
        {error && <ErrorNote>{error}</ErrorNote>}
        <StepActions
          left={
            <span style={{ fontSize: 12, color: t.textFaint }}>
              {words.toLocaleString()} words approved. Nothing has been charged yet.
            </span>
          }
        >
          <VBtn onClick={() => void openConfirm()} disabled={busy !== null || words === 0} data-testid="engine-produce" icon="play">
            {estimateUsd != null ? `${chosen} — est. $${estimateUsd.toFixed(2)}` : chosen}
          </VBtn>
        </StepActions>
      </StepCard>

      <RenderConfirmModal
        engine={confirm}
        manifest={manifest}
        loading={manifestLoading}
        loadError={manifestError}
        estimateUsd={estimateUsd}
        confirming={busy === 'produce'}
        onConfirm={() => void produce()}
        onClose={() => setConfirm(null)}
        onGoToStep={(s) => {
          setConfirm(null);
          openProjectInEditor(project.id, s);
        }}
        onOpenStyles={() => {
          setConfirm(null);
          setRoute('styles-list');
        }}
      />
      <BillingBlockModal reason={block} context={blockCtx} projectId={project.id} onClose={() => setBlock(null)} />
    </>
  );
}
