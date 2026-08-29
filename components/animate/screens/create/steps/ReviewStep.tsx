'use client';

/* Step 5 — Review script (approval gate, FREE).
 *
 *   Approve script                 → POST approve-script → status awaiting_engine → step 6
 *   Rewrite — make it more different → MoneyConfirmModal at the LIST script
 *                                    price → POST rewrite {directive?} → scripting → step 4
 *   Reopen (expired gate)          → POST reopen → awaiting_script_approval
 *
 * The editor + version history is ScriptReviewCard (shared with the studio
 * Script Review screen). Approve sends the draft in the box.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../../tokens';
import { useTheme } from '../../../theme-context';
import { useTier } from '../../../tier-context';
import { VBtn } from '../../../primitives';
import { Icon } from '../../../Icon';
import { ScriptReviewCard } from '../../review/ScriptReviewCard';
import { ConciergeStatusCard } from '../../editor/ConciergeStatusCard';
import { MoneyConfirmModal, useBillingMode, type MoneyConfirmRequest } from '@/components/vater/editor/MoneyConfirmModal';
import { BillingBlockModal, BillingBlockedError, type BillingBlockReason, type BillingBlockContext } from '../../editor/BillingBlock';
import { FLAT_ACTION_PRICES, formatPrice } from '@/lib/vater/pricing';
import { isOverLength, lengthMessageFor } from '@/lib/vater/script-limits';
import { readConciergeClient } from '@/lib/vater/concierge-client';
import {
  VARIATION_DIRECTIVES,
  VARIATION_DIRECTIVE_LABELS,
  type VariationDirective,
} from '@/lib/vater/create-steps';
import { useCreateFlow } from '../create-context';
import { createApi, errorMessage, isExpiredError } from '../create-api';
import { StepCard, Lede, FieldLabel, ErrorNote, InfoNote, StepActions, DoneSummary, inputStyle, wordsIn } from './step-ui';

/** Our rough real cost of one Kimi script pass, cents — shown to unmetered accounts only. */
const SCRIPT_EST_COST_CENTS = 14;

export function ReviewStep(): React.ReactElement {
  const { t } = useTheme();
  const { maxWords } = useTier();
  const billing = useBillingMode();
  const flow = useCreateFlow();
  const { project, derived, readOnly } = flow;

  const [draft, setDraft] = React.useState(project?.script ?? '');
  const [saved, setSaved] = React.useState(project?.script ?? '');
  const [busy, setBusy] = React.useState<'approve' | 'save' | 'rewrite' | 'reopen' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [money, setMoney] = React.useState<MoneyConfirmRequest | null>(null);
  const [directive, setDirective] = React.useState<VariationDirective | ''>('');
  const [block, setBlock] = React.useState<BillingBlockReason | null>(null);
  const [blockCtx, setBlockCtx] = React.useState<BillingBlockContext | undefined>(undefined);

  // A rewrite that lands (poll → new script) replaces the draft unless the
  // customer is mid-edit of the previous one.
  const serverScript = project?.script ?? '';
  React.useEffect(() => {
    if (draft === saved) setDraft(serverScript);
    setSaved(serverScript);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, serverScript]);

  if (!project || !derived) {
    return (
      <StepCard testId="review-empty">
        <div style={{ color: t.textSecondary, fontSize: 14 }}>No script to review yet — start from step 1.</div>
      </StepCard>
    );
  }

  const words = wordsIn(draft);
  const dirty = draft !== saved;
  const overLimit = isOverLength(words, maxWords);
  const rewriteCount = project.variationJson?.count ?? 0;
  const ticket = readConciergeClient(project.settingsJson);

  const handleErr = (err: unknown, fallback: string): void => {
    if (err instanceof BillingBlockedError) {
      setBlock(err.reason);
      setBlockCtx(err.context);
      return;
    }
    if (isExpiredError(err)) {
      setError('This approval expired after 7 days — reopen it to continue.');
      void flow.refresh();
      return;
    }
    setError(errorMessage(err, fallback));
    if (err instanceof Error && /409/.test(err.message)) void flow.refresh();
  };

  const save = async (): Promise<void> => {
    setBusy('save');
    setError(null);
    try {
      const row = await createApi.patchProject(project.id, { script: draft });
      flow.adopt(row);
      setSaved(draft);
    } catch (err) {
      handleErr(err, 'Could not save the script');
    } finally {
      setBusy(null);
    }
  };

  const approve = async (): Promise<void> => {
    setBusy('approve');
    setError(null);
    try {
      const row = await createApi.approveScript(project.id, draft);
      flow.adopt(row);
      flow.goTo(6);
    } catch (err) {
      handleErr(err, 'Could not approve the script');
    } finally {
      setBusy(null);
    }
  };

  const rewrite = async (): Promise<void> => {
    setBusy('rewrite');
    setError(null);
    try {
      const row = await createApi.rewrite(project.id, directive || undefined);
      flow.adopt(row);
      flow.goTo(4);
    } catch (err) {
      handleErr(err, 'Could not start the rewrite');
    } finally {
      setBusy(null);
    }
  };

  const askRewrite = (): void => {
    const emphasis = directive ? VARIATION_DIRECTIVE_LABELS[directive].toLowerCase() : 'a surprise angle';
    setMoney({
      title: 'Rewrite — make it more different',
      lines: [
        `Jelly writes a NEW script from the same transcript with ${emphasis}: a different hook, different examples and a different order. Facts, claims and your rules stay the same.`,
        'The current draft is kept in History. You review the new one before anything renders.',
        rewriteCount > 0 ? `This will be rewrite #${rewriteCount + 1}.` : 'This is rewrite #1.',
      ],
      unitCents: FLAT_ACTION_PRICES.script.priceCents,
      unitLabel: 'script',
      count: 1,
      estCostCents: SCRIPT_EST_COST_CENTS,
      onConfirm: () => {
        setMoney(null);
        void rewrite();
      },
    });
  };

  const reopen = async (): Promise<void> => {
    setBusy('reopen');
    setError(null);
    try {
      const row = await createApi.reopen(project.id);
      flow.adopt(row);
    } catch (err) {
      handleErr(err, 'Could not reopen');
    } finally {
      setBusy(null);
    }
  };

  // ── Looking back after approval ─────────────────────────────────────────
  if (readOnly) {
    const when = project.scriptApprovedAt ? new Date(project.scriptApprovedAt).toLocaleString() : null;
    return (
      <>
        <DoneSummary onContinue={() => flow.goTo(derived.step)} continueLabel={`Continue to step ${derived.step} →`} testId="review-done">
          Script approved{when ? ` on ${when}` : ''} — {wordsIn(project.script).toLocaleString()} words.
        </DoneSummary>
        <StepCard>
          <ScriptReviewCard project={project} draft={project.script ?? ''} onDraftChange={() => {}} disabled minHeight={240} />
        </StepCard>
      </>
    );
  }

  // ── Expired gate ────────────────────────────────────────────────────────
  if (derived.kind === 'expired') {
    return (
      <StepCard variant="ticket" testId="review-expired">
        <div style={{ fontSize: 18, fontWeight: 600, color: t.text }}>This approval expired after 7 days</div>
        <Lede>Nothing was lost — the script is still here. Reopen it to keep going; you get another 7 days.</Lede>
        {error && <ErrorNote>{error}</ErrorNote>}
        <StepActions>
          <VBtn onClick={() => void reopen()} disabled={busy !== null} data-testid="review-reopen">
            {busy === 'reopen' ? 'Reopening…' : 'Reopen'}
          </VBtn>
        </StepActions>
      </StepCard>
    );
  }

  const conciergeNeedsInfo = project.status === 'concierge_needs_info' && ticket;

  return (
    <>
      {conciergeNeedsInfo && (
        <ConciergeStatusCard projectId={project.id} status={project.status} ticket={ticket} refresh={flow.refresh} />
      )}
      <StepCard testId="review-step">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Lede>Read it, edit it, then approve — free. Or ask for a rewrite that is genuinely different.</Lede>
          {rewriteCount > 0 && (
            <span
              data-testid="rewrite-chip"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '3px 9px',
                borderRadius: JELLY_TOKENS.radius.pill,
                background: JELLY_TOKENS.gradChipOn,
                border: `1px solid ${JELLY_TOKENS.brandOutline}`,
                color: t.text,
              }}
            >
              Rewrite #{rewriteCount}
            </span>
          )}
        </div>

        <ScriptReviewCard project={project} draft={draft} saved={saved} onDraftChange={setDraft} disabled={busy !== null} />

        {overLimit && (
          <ErrorNote testId="review-over-limit">
            {words.toLocaleString()} words is over the {maxWords.toLocaleString()}-word ceiling. {lengthMessageFor(maxWords)}
          </ErrorNote>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}

        <StepActions
          left={
            <>
              <VBtn variant="ghost" size="sm" onClick={() => void save()} disabled={busy !== null || !dirty} data-testid="review-save">
                {busy === 'save' ? 'Saving…' : dirty ? 'Save edits' : 'Saved'}
              </VBtn>
              <span style={{ fontSize: 12, color: t.textSecondary }}>
                {dirty ? 'Unsaved edits — Approve sends the text in the box.' : 'Approving is free. The paid step is next.'}
              </span>
            </>
          }
        >
          <VBtn onClick={() => void approve()} disabled={busy !== null || words === 0 || overLimit} data-testid="review-approve" icon="play">
            {busy === 'approve' ? 'Approving…' : 'Approve script'}
          </VBtn>
        </StepActions>
      </StepCard>

      <StepCard testId="review-rewrite-card">
        <FieldLabel right={`${formatPrice(FLAT_ACTION_PRICES.script.priceCents)} per rewrite`}>Not it? Rewrite</FieldLabel>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={directive}
            onChange={(e) => setDirective(e.target.value as VariationDirective | '')}
            disabled={busy !== null}
            data-testid="rewrite-directive"
            aria-label="What should be different"
            style={{ ...inputStyle(t), width: 'auto', minWidth: 220 }}
          >
            <option value="">Surprise me</option>
            {VARIATION_DIRECTIVES.map((d) => (
              <option key={d} value={d}>
                {VARIATION_DIRECTIVE_LABELS[d]}
              </option>
            ))}
          </select>
          <VBtn variant="outlined" onClick={askRewrite} disabled={busy !== null} data-testid="review-rewrite" icon="sparkle">
            {busy === 'rewrite' ? 'Starting…' : 'Rewrite — make it more different'}
          </VBtn>
        </div>
        <div style={{ fontSize: 12, color: t.textFaint, lineHeight: 1.5 }}>
          A new script from the same source — different hook, examples and order, same facts and rules. Never a copy. The current draft stays in History.
        </div>
      </StepCard>

      <div
        data-testid="review-drive-card"
        aria-disabled="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          borderRadius: JELLY_TOKENS.radius.lg,
          border: `1px dashed ${t.border}`,
          color: t.textFaint,
          fontSize: 13,
          opacity: 0.7,
        }}
      >
        <Icon name="folder" size={18} color={t.textFaint} />
        <span style={{ flex: 1 }}>Link Google Drive — pull scripts from a Doc or Sheet</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>Coming soon</span>
      </div>

      {rewriteCount === 0 && !dirty && (
        <InfoNote tone="brand" testId="review-hint">
          Approving is free and does not render anything. Step 6 is where you pick Jelly or Fable and pay.
        </InfoNote>
      )}

      <MoneyConfirmModal request={money} billing={billing} onClose={() => setMoney(null)} />
      <BillingBlockModal reason={block} context={blockCtx} projectId={project.id} onClose={() => setBlock(null)} />
    </>
  );
}
