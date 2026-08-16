'use client';

/* BillingBlockModal — the 402 wall, shared by every editor step.
 *
 * It lived inside VisualsStep, so Script / Title / Thumbnail / Description
 * showed a raw "HTTP 402" string instead of an "Add a card" button — a dead
 * end right in the middle of the golden path. Extracted verbatim so the
 * Visuals behaviour is unchanged.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn } from '../../primitives';

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
  onClose: () => void;
}

export function BillingBlockModal({
  reason,
  context,
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

  const content: Record<
    BillingBlockReason,
    { title: string; body: string; cta: string; onCta: () => void }
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
    },
    trial_cap_reached: {
      title: 'Free tier used up',
      body: "You've hit the free-tier cap. Add a card to keep going — pay per clip, no subscription, nothing charged until you generate.",
      cta: 'Add a card',
      onCta: () => void goStripe('/api/vater/billing/setup'),
    },
    subscription_inactive: {
      title: 'Add a card to keep going',
      body: 'Generation needs a card on file. No subscription — you only pay the per-action price for what you make.',
      cta: 'Add a card',
      onCta: () => void goStripe('/api/vater/billing/setup'),
    },
    payment_past_due: {
      title: 'Payment failed — update your card',
      body: 'Your last invoice could not be charged, so rendering is paused. Update your card to resume — your projects are safe.',
      cta: 'Update card',
      onCta: () => void goStripe('/api/vater/billing/portal'),
    },
    monthly_limit_exceeded: {
      title: 'Monthly limit reached',
      body: 'This action would put you over your self-set monthly spending limit. Raise the limit on the Pricing screen to continue.',
      cta: 'Open Billing',
      onCta: openBilling,
    },
  };
  const c = content[reason];

  return (
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
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: JELLY_TOKENS.radius.lg,
          padding: 20,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{c.title}</div>
        <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8, lineHeight: 1.6 }}>
          {c.body}
        </div>
        {error && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: JELLY_TOKENS.radius.md,
              background: 'rgba(220,38,38,0.08)',
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
    </div>
  );
}
