'use client';

/* ConciergeStatusCard — what a customer sees while Fable 5 has their ticket.
 *
 * Shown by ProjectShell when `settingsJson.engine === 'fable5'` and the
 * project is in a concierge status (or the ticket is `delivered`). Stage
 * CHIPS, never a percentage: the chips move when a real stage does.
 *
 *   queued → picked up → directing → rendering → quality check → delivered
 *   needs_info = an amber detour with the operator's note + a Resubmit button
 *
 * Cancel is only offered while `queued` (DELETE …/concierge); after pickup
 * the customer replies to the ticket email. Resubmit (needs_info) POSTs
 * …/concierge again with no body — the saved (edited) script is used — and
 * goes through the same 402 wall as every other kickoff.
 *
 * Polling is the parent's job (ProjectShell refreshes GET /api/vater/youtube/
 * [id] every 20 s while the status is a concierge status).
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { Icon } from '../../Icon';
import { VBtn } from '../../primitives';
import { GlassCard, MicroLabel } from '../../cinema';
import {
  CONCIERGE_NEXT_STEPS,
  CONCIERGE_STAGE_CHIPS,
  CONCIERGE_SUBCOPY,
  conciergeChipIndex,
  conciergeHeadline,
  relativeTimeLabel,
  type ConciergeTicketView,
} from '@/lib/vater/concierge-client';
import { isConciergeStatus } from '@/lib/vater/youtube-status';
import { TINT_BG } from '../tint';
import {
  BillingBlockModal,
  BillingBlockedError,
  assertOk,
  type BillingBlockReason,
  type BillingBlockContext,
} from './BillingBlock';

export interface ConciergeStatusCardProps {
  projectId: string;
  status: string | null | undefined;
  ticket: ConciergeTicketView;
  /** Re-fetch the project after a cancel / resubmit. */
  refresh: () => Promise<void>;
  style?: React.CSSProperties;
}

export function ConciergeStatusCard({
  projectId,
  status,
  ticket,
  refresh,
  style,
}: ConciergeStatusCardProps): React.ReactElement {
  const { t } = useTheme();
  const [busy, setBusy] = React.useState<'cancel' | 'resubmit' | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [billingBlock, setBillingBlock] = React.useState<BillingBlockReason | null>(null);
  const [billingCtx, setBillingCtx] = React.useState<BillingBlockContext | undefined>(undefined);
  // Re-render once a minute so "14 min ago" keeps moving between polls.
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const i = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(i);
  }, []);

  const stage = ticket.stage;
  const live = isConciergeStatus(status);
  const chipIdx = conciergeChipIndex(stage);
  const isNeedsInfo = stage === 'needs_info';
  const isDelivered = stage === 'delivered';
  const pulsing = live && !isNeedsInfo;

  const lastHistory = ticket.history[ticket.history.length - 1];
  const stamps: Array<{ label: string; at: string | null | undefined }> = [
    { label: 'queued', at: ticket.submittedAt },
    { label: 'picked up', at: ticket.claimedAt },
    { label: 'delivered', at: ticket.deliveredAt },
  ].filter((s) => !!s.at);
  if (lastHistory?.at && !stamps.some((s) => s.at === lastHistory.at)) {
    stamps.push({ label: 'updated', at: lastHistory.at });
  }

  const cancel = async () => {
    if (busy) return;
    setBusy('cancel');
    setError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/concierge`, { method: 'DELETE' });
      await assertOk(res);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(null);
    }
  };

  const resubmit = async () => {
    if (busy) return;
    setBusy('resubmit');
    setError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/concierge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await assertOk(res);
      await refresh();
    } catch (err) {
      if (err instanceof BillingBlockedError) {
        setBillingBlock(err.reason);
        setBillingCtx(err.context);
      } else {
        setError(err instanceof Error ? err.message : 'Resubmit failed');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <GlassCard
      variant="ticket"
      padding={20}
      radius={JELLY_TOKENS.radius.xl}
      data-testid="concierge-status-card"
      style={{ maxWidth: 700, margin: '0 auto 20px', ...style }}
    >
      {/* Badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 12px',
            borderRadius: JELLY_TOKENS.radius.pill,
            background: JELLY_TOKENS.brandGhost,
            border: `1px solid ${JELLY_TOKENS.brandOutline}`,
            color: JELLY_TOKENS.brandLight,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isNeedsInfo ? JELLY_TOKENS.warning : isDelivered ? JELLY_TOKENS.success : JELLY_TOKENS.brand,
              boxShadow: pulsing ? `0 0 0 0 ${JELLY_TOKENS.brand}` : undefined,
              animation: pulsing ? JELLY_TOKENS.motion.blink : undefined,
            }}
          />
          Fable 5 · Concierge render
        </span>
        <MicroLabel tone="violet" as="span" style={{ fontFamily: JELLY_TOKENS.fontMono, letterSpacing: '0.14em' }}>
          {ticket.code}
        </MicroLabel>
        <span
          style={{ marginLeft: 'auto', fontSize: 11.5, color: t.textFaint, fontFamily: JELLY_TOKENS.fontMono }}
          /* NOT "est." — this is `quickEstimateUsd`, which rounds UP to whole minutes and uses
             the worst observed stills rate, so it is the credit HOLD, not the expected cost.
             The engine card you picked from shows the expected cost and reads "typically $X".
             Labelling both "est." made a 342-word script look like it had two prices
             (Jared 2026-08-29). The receipt bills actual, which lands at or below this. */
          title={
            ticket.estimateUsd > 0
              ? `$${ticket.estimateUsd.toFixed(2)} is held against your balance while this renders — ${Math.max(1, ticket.estMinutes)} whole minutes at the top of our measured rate. The receipt bills what it actually cost, which is usually less.`
              : undefined
          }
        >
          {ticket.words.toLocaleString()} words · ~{Math.max(1, ticket.estMinutes)} min
          {ticket.estimateUsd > 0 ? ` · reserves $${ticket.estimateUsd.toFixed(2)}` : ''}
        </span>
      </div>

      {/* Headline */}
      <div style={{ marginTop: 14, fontSize: 20, fontWeight: 700, color: t.text, lineHeight: 1.25 }}>
        {conciergeHeadline(stage)}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>
        {isDelivered
          ? 'Open it from your Library — the receipt under the video shows exactly what it cost.'
          : CONCIERGE_SUBCOPY}
      </div>

      {/* Stage chips */}
      <div
        role="list"
        aria-label="Ticket progress"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16, alignItems: 'center' }}
      >
        {CONCIERGE_STAGE_CHIPS.map((c, i) => {
          const done = chipIdx > i || (isDelivered && i <= chipIdx);
          const current = chipIdx === i;
          const color = done ? JELLY_TOKENS.success : current ? JELLY_TOKENS.cyan : t.textFaint;
          return (
            <React.Fragment key={c.stage}>
              {i > 0 && (
                <span aria-hidden="true" style={{ width: 10, height: 1, background: t.borderStrong }} />
              )}
              <span
                role="listitem"
                aria-current={current ? 'step' : undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: JELLY_TOKENS.radius.pill,
                  border: `1px solid ${current ? 'rgba(111,214,255,0.6)' : done ? 'rgba(52,201,138,0.4)' : t.border}`,
                  background: current ? JELLY_TOKENS.cyanGhost : t.card,
                  color: done || current ? t.text : t.textSecondary,
                  fontSize: 12,
                  fontWeight: current ? 600 : 500,
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: color,
                    animation: current && pulsing ? JELLY_TOKENS.motion.blink : undefined,
                  }}
                />
                {c.label}
              </span>
            </React.Fragment>
          );
        })}
        {isNeedsInfo && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: JELLY_TOKENS.radius.pill,
              border: `1px solid rgba(245,179,75,0.5)`,
              background: 'rgba(245,179,75,0.10)',
              color: JELLY_TOKENS.warning,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name="sparkle" size={12} color={JELLY_TOKENS.warning} />
            Needs your input
          </span>
        )}
      </div>

      {/* Operator note */}
      {ticket.operatorNote && (
        <div
          style={{
            marginTop: 14,
            padding: '10px 12px',
            borderRadius: JELLY_TOKENS.radius.md,
            border: `1px solid ${isNeedsInfo ? 'rgba(245,179,75,0.45)' : t.border}`,
            background: isNeedsInfo ? 'rgba(245,179,75,0.08)' : t.card,
            fontSize: 13,
            color: t.text,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          <MicroLabel tone="secondary" size={10.5} style={{ marginBottom: 4 }}>
            {isNeedsInfo ? 'From Fable 5 — what we need' : 'A note from the studio'}
          </MicroLabel>
          {ticket.operatorNote}
        </div>
      )}

      {/* What happens next */}
      {!isDelivered && (
        <div style={{ marginTop: 14 }}>
          <MicroLabel tone="secondary" size={10.5} style={{ marginBottom: 6 }}>
            What happens next
          </MicroLabel>
          <ol style={{ margin: 0, paddingLeft: 18, color: t.textSecondary, fontSize: 12.5, lineHeight: 1.6 }}>
            {CONCIERGE_NEXT_STEPS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer: stamps + actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginTop: 16,
          paddingTop: 12,
          borderTop: `1px solid ${t.border}`,
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: t.textFaint }}>
          {stamps.map((s) => (
            <span key={s.label} title={s.at ? new Date(s.at).toLocaleString() : undefined}>
              {s.label} {relativeTimeLabel(s.at)}
            </span>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {stage === 'queued' && live && (
            <VBtn
              variant="ghost"
              size="sm"
              onClick={() => void cancel()}
              disabled={!!busy}
              data-testid="concierge-cancel"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel ticket'}
            </VBtn>
          )}
          {isNeedsInfo && (
            <VBtn
              variant="primary"
              size="sm"
              icon="sparkle"
              onClick={() => void resubmit()}
              disabled={!!busy}
              data-testid="concierge-resubmit"
            >
              {busy === 'resubmit' ? 'Sending…' : 'Resubmit to Fable 5'}
            </VBtn>
          )}
        </div>
      </div>
      {isNeedsInfo && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: t.textSecondary }}>
          Edit the script in the Script step (or your style&rsquo;s voice / characters in Styles), then resubmit
          — the ticket keeps its code.
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 10,
            padding: '8px 12px',
            borderRadius: JELLY_TOKENS.radius.md,
            ...TINT_BG.error,
            color: JELLY_TOKENS.error,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      <BillingBlockModal
        reason={billingBlock}
        context={billingCtx}
        projectId={projectId}
        onClose={() => setBillingBlock(null)}
      />
    </GlassCard>
  );
}
