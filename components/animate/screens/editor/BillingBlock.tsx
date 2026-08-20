'use client';

/* BillingBlockModal — the 402 wall, shared by every editor step.
 *
 * It lived inside VisualsStep, so Script / Title / Thumbnail / Description
 * showed a raw "HTTP 402" string instead of an "Add a card" button — a dead
 * end right in the middle of the golden path. Extracted verbatim so the
 * Visuals behaviour is unchanged.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { JELLY_TOKENS, glass } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn } from '../../primitives';
import { AdmitOneTicket, GlassCard, MicroLabel, type TicketNote } from '../../cinema';
import { useRenderEstimate } from '@/lib/vater/use-estimate';

/** 402 budget.reason values from the generation routes' billing gate. */
export type BillingBlockReason =
  | 'insufficient_credits'
  // Legacy reasons — only reachable before the credit-ledger migration is
  // applied, while checkBudget() is still falling back to the old rules.
  | 'trial_cap_reached'
  | 'subscription_inactive'
  | 'payment_past_due'
  | 'monthly_limit_exceeded';

const BLOCK_REASONS: readonly string[] = [
  'insufficient_credits',
  'trial_cap_reached',
  'subscription_inactive',
  'payment_past_due',
  'monthly_limit_exceeded',
];

/** Credit context the 402 carries, so the wall can name real numbers. */
export interface BillingBlockContext {
  balanceCents?: number;
  estimateCents?: number;
  /** True when a stills-only welcome grant could not fund an animation. */
  grantBlocked?: boolean;
}

const usd = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/**
 * Reads a failed fetch Response and returns the billing reason if it is a
 * 402 the modal can act on, else null (caller shows its own error).
 * Consumes the body, so it hands the parsed JSON back.
 */
export async function readBillingBlock(res: Response): Promise<{
  reason: BillingBlockReason | null;
  context: BillingBlockContext;
  data: { error?: string; detail?: string; retryAfterSeconds?: number };
}> {
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    detail?: string;
    retryAfterSeconds?: number;
    budget?: {
      reason?: string;
      balanceCents?: number;
      estimateCents?: number;
      grantBlocked?: boolean;
    };
  };
  const reason =
    res.status === 402 && data.budget?.reason && BLOCK_REASONS.includes(data.budget.reason)
      ? (data.budget.reason as BillingBlockReason)
      : null;
  return {
    reason,
    context: {
      balanceCents: data.budget?.balanceCents,
      estimateCents: data.budget?.estimateCents,
      grantBlocked: data.budget?.grantBlocked,
    },
    data,
  };
}

/** Thrown by assertOk() when the failure is an actionable 402. */
export class BillingBlockedError extends Error {
  readonly reason: BillingBlockReason;
  /** Balance + estimate, so the modal can show what is actually missing. */
  readonly context: BillingBlockContext;
  constructor(reason: BillingBlockReason, context: BillingBlockContext = {}) {
    super('billing_blocked');
    this.name = 'BillingBlockedError';
    this.reason = reason;
    this.context = context;
  }
}

/**
 * Throws on a failed response: BillingBlockedError for an actionable 402
 * (caller opens the modal), otherwise a plain Error carrying the API message.
 * No-op when the response is ok.
 */
export async function assertOk(res: Response): Promise<void> {
  if (res.ok) return;
  const { reason, context, data } = await readBillingBlock(res);
  if (reason) throw new BillingBlockedError(reason, context);
  throw new Error(data.detail || data.error || `HTTP ${res.status}`);
}

export interface BillingBlockModalProps {
  reason: BillingBlockReason | null;
  /** Optional credit context from the 402 (balance, estimate). */
  context?: BillingBlockContext;
  /**
   * The project that got blocked. When supplied the wall shows what this
   * specific render is expected to cost, split draft vs full — "add credit"
   * with no number attached makes the customer guess how much, and the two
   * numbers are far enough apart that guessing is how people overbuy or come
   * back to the same wall. Optional: every existing caller still works.
   */
  projectId?: string | null;
  onClose: () => void;
}

export function BillingBlockModal({
  reason,
  context,
  projectId,
  onClose,
}: BillingBlockModalProps): React.ReactElement | null {
  const { t } = useTheme();
  const { setRoute } = useRoute();
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset transient state whenever the modal (re)opens with a new reason.
  React.useEffect(() => {
    setWorking(false);
    setError(null);
  }, [reason]);

  /* Balance fallback.
   *
   * Most callers pass the 402's own budget context. The ones that only keep
   * the reason (they predate credits) would otherwise show a wall with no
   * numbers on it, so fetch the balance here instead of asking six editor
   * steps to thread a prop through. Cheap, one call, only on the credit wall. */
  const [fetchedBalanceCents, setFetchedBalanceCents] = React.useState<number | null>(null);
  React.useEffect(() => {
    setFetchedBalanceCents(null);
    if (reason !== 'insufficient_credits' || context?.balanceCents !== undefined) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/vater/billing/credits', { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as { balance?: { balanceCents?: number } };
        if (!cancelled && typeof body.balance?.balanceCents === 'number') {
          setFetchedBalanceCents(body.balance.balanceCents);
        }
      } catch {
        /* the wall still works without a number */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reason, context?.balanceCents]);

  /* What this render is expected to cost, from the same endpoint the render
   * button quotes. Only fetched on the credit wall — the legacy card-on-file
   * reasons have nothing to do with a render's price. A failed fetch leaves
   * `estimate` null and the wall renders exactly as it did before. */
  const { estimate } = useRenderEstimate(
    reason === 'insufficient_credits' ? (projectId ?? null) : null,
  );

  const goStripe = React.useCallback(
    async (endpoint: '/api/vater/billing/setup' | '/api/vater/billing/portal') => {
      setWorking(true);
      setError(null);
      try {
        const res = await fetch(endpoint, { method: 'POST' });
        const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        window.location.href = data.url;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Redirect failed');
        setWorking(false);
      }
    },
    [],
  );

  if (!reason) return null;

  const openBilling = () => {
    onClose();
    setRoute('pricing');
  };

  const balanceCents = context?.balanceCents ?? fetchedBalanceCents ?? undefined;
  const shortBy =
    context?.estimateCents !== undefined && balanceCents !== undefined
      ? Math.max(0, context.estimateCents - balanceCents)
      : null;

  /* Every reason keeps its own copy and its own CTA; what the cinema pass adds
   * is the stub around it. `ticket` is the "NOT ADMITTED — …" label, `state`
   * the blinking status line, and `amountUsd` the one number worth printing
   * big: what is missing, or failing that what the render is quoted at. When
   * there is no honest number (the legacy card-on-file reasons are not about a
   * price) the fare is omitted rather than faked as $0.00. */
  const content: Record<
    BillingBlockReason,
    {
      title: string;
      body: string;
      cta: string;
      onCta: () => void;
      ticket: string;
      state: string;
      amountUsd: number | null;
      amountNote: string | null;
    }
  > = {
    // The live wall. Name the two numbers — a customer who is told only "add
    // credit" has to go and work out how much.
    insufficient_credits: {
      title: context?.grantBlocked ? 'Animation needs purchased credit' : 'Add credit to continue',
      body: context?.grantBlocked
        ? `Your welcome credit covers scripts and still images, but animation runs on purchased credit.${
            context.estimateCents !== undefined
              ? ` This render is estimated at ${usd(context.estimateCents)}.`
              : ''
          } Nothing has been charged.`
        : `${
            balanceCents !== undefined
              ? `Your balance is ${usd(balanceCents)}`
              : 'You are out of render credit'
          }${
            context?.estimateCents !== undefined
              ? ` and this render is estimated at ${usd(context.estimateCents)}`
              : ''
          }${shortBy ? ` — about ${usd(shortBy)} short` : ''}. You are only ever charged for videos that finish; failed renders are free.`,
      cta: 'Buy credits',
      onCta: openBilling,
      ticket: context?.grantBlocked
        ? 'NOT ADMITTED — PURCHASED CREDIT REQUIRED'
        : 'NOT ADMITTED — OUT OF CREDIT',
      state: context?.grantBlocked ? 'WELCOME CREDIT — STILLS ONLY' : 'BOX OFFICE CLOSED',
      amountUsd:
        shortBy !== null && shortBy > 0
          ? shortBy / 100
          : context?.estimateCents !== undefined
            ? context.estimateCents / 100
            : null,
      amountNote:
        shortBy !== null && shortBy > 0 ? 'short by' : 'estimated for this render',
    },
    trial_cap_reached: {
      title: 'Free tier used up',
      body: "You've hit the free-tier cap. Add a card to keep going — pay per clip, no subscription, nothing charged until you generate.",
      cta: 'Add a card',
      onCta: () => void goStripe('/api/vater/billing/setup'),
      ticket: 'NOT ADMITTED — FREE TIER USED UP',
      state: 'NO CARD ON FILE',
      amountUsd: null,
      amountNote: null,
    },
    subscription_inactive: {
      title: 'Add a card to keep going',
      body: 'Generation needs a card on file. No subscription — you only pay the per-action price for what you make.',
      cta: 'Add a card',
      onCta: () => void goStripe('/api/vater/billing/setup'),
      ticket: 'NOT ADMITTED — CARD REQUIRED',
      state: 'NO CARD ON FILE',
      amountUsd: null,
      amountNote: null,
    },
    payment_past_due: {
      title: 'Payment failed — update your card',
      body: 'Your last invoice could not be charged, so rendering is paused. Update your card to resume — your projects are safe.',
      cta: 'Update card',
      onCta: () => void goStripe('/api/vater/billing/portal'),
      ticket: 'NOT ADMITTED — PAYMENT FAILED',
      state: 'CARD DECLINED',
      amountUsd: null,
      amountNote: null,
    },
    monthly_limit_exceeded: {
      title: 'Monthly limit reached',
      body: 'This action would put you over your self-set monthly spending limit. Raise the limit on the Pricing screen to continue.',
      cta: 'Open Billing',
      onCta: openBilling,
      ticket: 'NOT ADMITTED — MONTHLY LIMIT',
      state: 'SELF-SET CEILING',
      amountUsd: null,
      amountNote: null,
    },
  };
  const c = content[reason];

  /* Fine print under the fare: only numbers we actually have. */
  const wallNotes: TicketNote[] = [];
  if (reason === 'insufficient_credits') {
    if (balanceCents !== undefined) {
      wallNotes.push({ label: 'your balance', value: usd(balanceCents) });
    }
    if (context?.estimateCents !== undefined && c.amountNote !== 'estimated for this render') {
      wallNotes.push({ label: 'this render', value: usd(context.estimateCents) });
    }
    wallNotes.push({
      label: 'failed renders',
      value: 'never charged',
      tone: 'cyan',
    });
  } else {
    wallNotes.push({ label: 'charged so far', value: 'nothing', tone: 'cyan' });
  }

  // Portalled to <body>: fixed overlays rendered inside <main> stack BELOW
  // the studio header/sidebar (2026-08-19 beta finding).
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !working) onClose();
      }}
    >
      {/* Opaque `t.panel`, not `t.card`: a modal that lets the editor show
        * through is a modal you cannot read. */}
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: t.panel,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: JELLY_TOKENS.radius.xxl,
          padding: 20,
          boxShadow: JELLY_TOKENS.shadow24,
          fontFamily: JELLY_TOKENS.font,
        }}
      >
        {c.amountUsd !== null ? (
          <AdmitOneTicket
            data-testid="billing-block-ticket"
            size="card"
            label={c.ticket}
            state={c.state}
            totalUsd={c.amountUsd}
            notes={wallNotes}
            footer={c.body}
          />
        ) : (
          /* No number to print, so the stub carries the headline instead of a
           * fare. Same ticket furniture, no invented amount. */
          <GlassCard variant="ticket" data-testid="billing-block-ticket" padding={22}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
              }}
            >
              <MicroLabel tone="violet" size={11} tracking="0.24em">
                {c.ticket}
              </MicroLabel>
              <div style={{ fontSize: 11, color: JELLY_TOKENS.cyan, letterSpacing: '0.04em' }}>
                ● {c.state}
              </div>
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: t.text,
                marginTop: 8,
                lineHeight: 1.25,
              }}
            >
              {c.title}
            </div>
            <div style={{ borderTop: `1px dashed ${t.borderStrong}`, margin: '16px 0' }} />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 12.5,
                color: JELLY_TOKENS.cyan,
              }}
            >
              <span>charged so far</span>
              <span>nothing</span>
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: t.textFaint,
                lineHeight: 1.5,
                marginTop: 12,
              }}
            >
              {c.body}
            </div>
          </GlassCard>
        )}

        {/* Draft vs full, for THIS project. The gap between them is the whole
          * decision: a stills draft often clears a balance that the animated
          * cut does not, and someone staring at a wall should be told that
          * rather than left to buy blind. */}
        {estimate && (
          <GlassCard
            data-testid="billing-block-estimate"
            padding={0}
            radius={JELLY_TOKENS.radius.lg}
            style={{ marginTop: 14, overflow: 'hidden', fontSize: 13 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '9px 14px',
                borderBottom: `1px dashed ${t.border}`,
              }}
            >
              <MicroLabel tone="faint" size={10.5} tracking="0.2em" color={t.textFaint}>
                Estimated for this video
              </MicroLabel>
              <span className="jc-tabular" style={{ fontSize: 11, color: t.textFaint }}>
                {estimate.minutes.toFixed(1)} min
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 14px',
                color: t.text,
              }}
            >
              <span>Draft — still scenes</span>
              <strong className="jc-tabular">${estimate.draftUsd.toFixed(2)}</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 14px',
                color: t.text,
                borderTop: `1px solid ${t.border}`,
              }}
            >
              <span>Full — with motion</span>
              <strong className="jc-tabular">${estimate.fullUsd.toFixed(2)}</strong>
            </div>
          </GlassCard>
        )}

        {error && (
          <div
            style={{
              ...glass(t),
              marginTop: 12,
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: JELLY_TOKENS.radius.md,
              borderLeft: `3px solid ${JELLY_TOKENS.error}`,
              color: JELLY_TOKENS.error,
            }}
          >
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <VBtn size="sm" variant="ghost" onClick={onClose} disabled={working}>
            Not now
          </VBtn>
          <VBtn size="sm" onClick={c.onCta} disabled={working}>
            {working ? 'Redirecting…' : c.cta}
          </VBtn>
        </div>
      </div>
    </div>,
    document.body,
  );
}
