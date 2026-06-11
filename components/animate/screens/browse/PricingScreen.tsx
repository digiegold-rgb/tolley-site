'use client';

/* PricingScreen — Jelly Studio pay-per-video billing (card on file).
 *
 * 2026-06-11: pay-per-video shipped server-side. This screen now drives the
 * full customer billing surface off GET /api/vater/billing/status:
 *   - trialing  (no card)  → hero "Add a card" CTA + trial-caps-remaining chips
 *   - active    (card)     → card summary, unbilled accrual, month spend vs
 *                            editable limit, recent usage table
 *   - past_due             → red update-card banner above the active content
 *
 * Errors: every fetch surfaces a real message inline. No silent catches —
 * see feedback_silent_failures_leads.md.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, SectionHeader } from '../../primitives';
import {
  ANIMATION_PRICES,
  FLAT_ACTION_PRICES,
  formatPrice,
} from '@/lib/vater/pricing';

const FLAT_LABELS: Record<keyof typeof FLAT_ACTION_PRICES, string> = {
  script: 'Script generation',
  voiceover: 'Voiceover',
  scene: 'Scene image',
  render: 'Video compose',
  thumbnail: 'Thumbnail',
  description: 'Description',
  transcription: 'Transcription',
};

const PER_ACTION_PRICES: ReadonlyArray<{ key: string; label: string; price: string; unit: string }> = [
  ...Object.entries(FLAT_ACTION_PRICES).map(([key, spec]) => ({
    key,
    label: FLAT_LABELS[key as keyof typeof FLAT_ACTION_PRICES],
    price: formatPrice(spec.priceCents),
    unit: spec.unit,
  })),
  ...Object.entries(ANIMATION_PRICES).map(([key, spec]) => ({
    key: `anim_${key}`,
    label: `Animation — ${spec.label}`,
    price: formatPrice(spec.priceCents),
    unit: '/clip',
  })),
];

const FAQ = [
  {
    q: 'How does billing work?',
    a: 'No subscription, no monthly fee. You put a card on file, then each action is billed at the fixed per-action price shown below (scripts, scenes, animations, renders, etc.). Charges accrue on your account and are invoiced to your card automatically once they reach $25, plus a monthly sweep for anything left over. Failed renders are never charged. Until you add a card, the free tier gives you 3 transcripts, 1 scene generation, and 1 animation.',
  },
  {
    q: 'Is there a free trial?',
    a: "Yes — every new account gets free trial usage: 3 transcripts, 1 scene generation, and 1 5-second animation. No card required. There's no time limit; it ends when you hit any cap.",
  },
  {
    q: 'What happens if my card is declined?',
    a: 'New jobs pause. We email you and show a banner in the app until you update payment. Existing projects stay safe.',
  },
  {
    q: 'Can I generate in other languages?',
    a: 'Yes — voiceovers support major languages via F5-TTS (local) and ElevenLabs; scripts can be generated in any major language.',
  },
];

// ─── /api/vater/billing/status response (client-side view) ────────────────

interface BillingCard {
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

interface BillingStatus {
  subscription: { status: string } | null;
  usage: {
    usedCents: number;
    includedCents: number;
    limitCents: number;
    periodStart: string | null;
    periodEnd: string | null;
  };
  trial: {
    transcripts: number;
    scenes: number;
    animations: number;
    caps: { transcripts: number; scenes: number; animations: number };
    capHitAt: string | null;
  };
  isTrial: boolean;
  card: BillingCard | null;
  unbilledCents: number;
  delinquent: boolean;
  defaultLimitCents: number;
}

interface UsageItem {
  id: string;
  action: string;
  tier: string | null;
  costCents: number;
  description: string | null;
  ts: string;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCentsExact(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PricingScreen(): React.ReactElement {
  const { t } = useTheme();
  const [openFaq, setOpenFaq] = React.useState<number | null>(0);

  const [status, setStatus] = React.useState<BillingStatus | null>(null);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [usageItems, setUsageItems] = React.useState<UsageItem[] | null>(null);
  const [usageError, setUsageError] = React.useState<string | null>(null);

  // CTA / mutation state
  const [redirecting, setRedirecting] = React.useState<'setup' | 'portal' | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Editable monthly limit (dollars in the input, cents over the wire)
  const [limitInput, setLimitInput] = React.useState<string>('');
  const [savingLimit, setSavingLimit] = React.useState(false);
  const [limitError, setLimitError] = React.useState<string | null>(null);
  const [limitSaved, setLimitSaved] = React.useState(false);

  const loadStatus = React.useCallback(async () => {
    setLoading(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/vater/billing/status');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as BillingStatus;
      setStatus(data);
      setLimitInput(String(Math.round((data.usage?.limitCents ?? 0) / 100)));
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Failed to load billing status');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Usage history — only relevant once a card is on file, but cheap to fetch
  // whenever the status says we're not on trial.
  const hasCard = Boolean(status?.card);
  React.useEffect(() => {
    if (!hasCard) return;
    let aborted = false;
    (async () => {
      setUsageError(null);
      try {
        const res = await fetch('/api/vater/billing/usage?period=current&limit=10');
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { items: UsageItem[] };
        if (!aborted) setUsageItems(data.items ?? []);
      } catch (err) {
        if (!aborted) {
          setUsageError(err instanceof Error ? err.message : 'Failed to load usage history');
        }
      }
    })();
    return () => {
      aborted = true;
    };
  }, [hasCard]);

  const startSetup = React.useCallback(async () => {
    setRedirecting('setup');
    setActionError(null);
    try {
      const res = await fetch('/api/vater/billing/setup', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      window.location.href = data.url as string;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start card setup');
      setRedirecting(null);
    }
  }, []);

  const openPortal = React.useCallback(async () => {
    setRedirecting('portal');
    setActionError(null);
    try {
      const res = await fetch('/api/vater/billing/portal', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      window.location.href = data.url as string;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not open billing portal');
      setRedirecting(null);
    }
  }, []);

  const saveLimit = React.useCallback(async () => {
    const dollars = Number(limitInput);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setLimitError('Enter a dollar amount, e.g. 500');
      return;
    }
    setSavingLimit(true);
    setLimitError(null);
    setLimitSaved(false);
    try {
      const res = await fetch('/api/vater/billing/limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitCents: Math.round(dollars * 100) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setLimitSaved(true);
      setStatus((prev) =>
        prev
          ? { ...prev, usage: { ...prev.usage, limitCents: data.limitCents as number } }
          : prev,
      );
      setLimitInput(String(Math.round((data.limitCents as number) / 100)));
    } catch (err) {
      setLimitError(err instanceof Error ? err.message : 'Failed to save limit');
    } finally {
      setSavingLimit(false);
    }
  }, [limitInput]);

  // ─── Derived state ───────────────────────────────────────────────────

  const isPastDue = Boolean(
    status && (status.delinquent || status.subscription?.status === 'past_due'),
  );
  const showTrialHero = Boolean(status && !status.card && !isPastDue);

  const trialChips: Array<{ key: string; label: string; left: number }> = status
    ? [
        {
          key: 'transcripts',
          left: Math.max(0, status.trial.caps.transcripts - status.trial.transcripts),
          label: 'free transcript',
        },
        {
          key: 'scenes',
          left: Math.max(0, status.trial.caps.scenes - status.trial.scenes),
          label: 'free scene gen',
        },
        {
          key: 'animations',
          left: Math.max(0, status.trial.caps.animations - status.trial.animations),
          label: 'free animation',
        },
      ]
    : [];

  // ─── Sub-renders ─────────────────────────────────────────────────────

  const renderPastDueBanner = () => (
    <VCard
      variant="flat"
      style={{
        border: `1px solid ${JELLY_TOKENS.error}`,
        background: 'rgba(220,38,38,0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: JELLY_TOKENS.error }}>
          Payment failed — update your card to resume rendering
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>
          Your last invoice could not be charged. New generation is paused until
          payment succeeds. Your projects are safe.
        </div>
      </div>
      <VBtn
        variant="danger"
        size="sm"
        onClick={openPortal}
        disabled={redirecting !== null}
      >
        {redirecting === 'portal' ? 'Opening…' : 'Update card'}
      </VBtn>
    </VCard>
  );

  const renderTrialHero = () => (
    <VCard
      variant="hero"
      style={{
        borderTop: `4px solid ${JELLY_TOKENS.brand}`,
        maxWidth: 540,
        alignSelf: 'flex-start',
        width: '100%',
      }}
    >
      <div style={{ fontSize: 12, color: JELLY_TOKENS.brand, fontWeight: 600 }}>
        Pay per video — no subscription
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: t.text, marginTop: 4 }}>
        Jelly Studio
      </div>
      <div style={{ fontSize: 14, color: t.textSecondary, marginTop: 4 }}>
        Add a card, generate a video, get charged the per-action price. That's it.
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color: t.text, marginTop: 20 }}>
        ~$25<span style={{ fontSize: 16, color: t.textSecondary, fontWeight: 500 }}> / video avg</span>
      </div>

      {/* Trial caps remaining */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        {trialChips.map((chip) => (
          <span
            key={chip.key}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: JELLY_TOKENS.radius.full,
              background: chip.left > 0 ? JELLY_TOKENS.brandGhost : t.cardAlt,
              color: chip.left > 0 ? JELLY_TOKENS.brand : t.textSecondary,
              border: `1px solid ${chip.left > 0 ? 'transparent' : t.border}`,
            }}
          >
            {chip.left} {chip.label}
            {chip.left === 1 ? '' : 's'} left
          </span>
        ))}
      </div>

      <ul style={{ paddingLeft: 18, marginTop: 16, fontSize: 14, color: t.text, lineHeight: 1.7 }}>
        <li>No subscription — pay only when you generate</li>
        <li>Fixed per-action prices, shown before every render</li>
        <li>Charges auto-invoiced at $25 — no surprise bills</li>
        <li>Failed renders never charged</li>
        <li>Set your own monthly spending limit</li>
      </ul>
      <VBtn
        onClick={startSetup}
        disabled={redirecting !== null}
        style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}
      >
        {redirecting === 'setup' ? 'Redirecting to Stripe…' : 'Add a card'}
      </VBtn>
      {actionError && (
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
          {actionError}
        </div>
      )}
      <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: t.textSecondary }}>
        Card capture via Stripe — nothing is charged until you generate.
      </div>
    </VCard>
  );

  const renderActiveBilling = () => {
    if (!status) return null;
    const card = status.card;
    const usedCents = status.usage.usedCents;
    const limitCents = status.usage.limitCents;
    const pct = limitCents > 0 ? Math.min(100, (usedCents / limitCents) * 100) : 0;
    return (
      <>
        {/* Card on file */}
        <VCard variant="flat">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 12, color: t.textSecondary }}>Card on file</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginTop: 4 }}>
                {(card?.brand ?? 'Card').toUpperCase()} •••• {card?.last4 ?? '????'}
                {card?.expMonth && card?.expYear ? (
                  <span style={{ fontSize: 13, fontWeight: 500, color: t.textSecondary, marginLeft: 8 }}>
                    exp {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
                  </span>
                ) : null}
              </div>
            </div>
            <VBtn
              variant="outlined"
              size="sm"
              onClick={openPortal}
              disabled={redirecting !== null}
            >
              {redirecting === 'portal' ? 'Opening…' : 'Manage card'}
            </VBtn>
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 12 }}>
            Unbilled balance:{' '}
            <span style={{ color: t.text, fontWeight: 600 }}>
              {formatCentsExact(status.unbilledCents)}
            </span>{' '}
            (invoiced automatically at $25)
          </div>
          {actionError && (
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
              {actionError}
            </div>
          )}
        </VCard>

        {/* Month spend vs limit */}
        <VCard variant="flat">
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>
            This month
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary }}>
            <span style={{ color: t.text, fontWeight: 600 }}>{formatCentsExact(usedCents)}</span>
            {' of '}
            <span style={{ color: t.text, fontWeight: 600 }}>{formatCentsExact(limitCents)}</span>
            {' monthly limit'}
          </div>
          <div
            style={{
              marginTop: 10,
              height: 8,
              borderRadius: 4,
              background: t.cardAlt,
              border: `1px solid ${t.border}`,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: pct >= 90 ? JELLY_TOKENS.error : JELLY_TOKENS.brand,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: t.textSecondary }}>Monthly limit: $</span>
            <input
              type="number"
              min={50}
              step={50}
              value={limitInput}
              onChange={(e) => {
                setLimitInput(e.target.value);
                setLimitSaved(false);
                setLimitError(null);
              }}
              style={{
                width: 100,
                padding: '8px 10px',
                borderRadius: JELLY_TOKENS.radius.md,
                border: `1px solid ${t.border}`,
                background: t.card,
                color: t.text,
                fontSize: 14,
                fontFamily: JELLY_TOKENS.font,
              }}
              aria-label="Monthly spending limit in dollars"
            />
            <VBtn size="sm" variant="outlined" onClick={saveLimit} disabled={savingLimit}>
              {savingLimit ? 'Saving…' : 'Save limit'}
            </VBtn>
            {limitSaved && (
              <span style={{ fontSize: 12, color: JELLY_TOKENS.success }}>✓ saved</span>
            )}
          </div>
          {limitError && (
            <div style={{ marginTop: 8, fontSize: 12, color: JELLY_TOKENS.error }}>
              {limitError}
            </div>
          )}
          <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 8 }}>
            A safety cap, not a plan — generation is blocked once this month's
            spend would exceed it. $50 minimum.
          </div>
        </VCard>

        {/* Recent usage */}
        <VCard variant="flat">
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 12 }}>
            Recent usage
          </div>
          {usageError && (
            <div
              style={{
                padding: '8px 12px',
                fontSize: 13,
                borderRadius: JELLY_TOKENS.radius.md,
                background: 'rgba(220,38,38,0.08)',
                color: JELLY_TOKENS.error,
              }}
            >
              {usageError}
            </div>
          )}
          {!usageError && usageItems === null && (
            <div style={{ fontSize: 13, color: t.textSecondary }}>Loading usage…</div>
          )}
          {!usageError && usageItems !== null && usageItems.length === 0 && (
            <div style={{ fontSize: 13, color: t.textSecondary }}>
              No charges this month yet.
            </div>
          )}
          {!usageError && usageItems !== null && usageItems.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {usageItems.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 12,
                    padding: '8px 0',
                    borderTop: i === 0 ? 'none' : `1px solid ${t.border}`,
                    fontSize: 13,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, color: t.text }}>
                    {item.description || `${item.action}${item.tier ? ` — ${item.tier}` : ''}`}
                  </span>
                  <span style={{ color: t.textSecondary, fontSize: 12, whiteSpace: 'nowrap' }}>
                    {fmtDate(item.ts)}
                  </span>
                  <span style={{ fontWeight: 600, color: t.text, whiteSpace: 'nowrap' }}>
                    {formatCentsExact(item.costCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </VCard>
      </>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <SectionHeader
        icon="folder"
        title="Jelly Studio"
        description="Pay only for what you make. No subscription, no commitment."
      />

      {loading && (
        <VCard variant="flat" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: t.textSecondary }}>Loading billing status…</div>
        </VCard>
      )}

      {!loading && statusError && (
        <VCard
          variant="flat"
          style={{
            border: `1px solid ${JELLY_TOKENS.error}`,
            background: 'rgba(220,38,38,0.08)',
          }}
        >
          <div style={{ fontSize: 13, color: JELLY_TOKENS.error }}>
            Could not load billing status: {statusError}
          </div>
          <VBtn size="sm" variant="outlined" onClick={loadStatus} style={{ marginTop: 12 }}>
            Retry
          </VBtn>
        </VCard>
      )}

      {!loading && !statusError && status && (
        <>
          {isPastDue && renderPastDueBanner()}
          {showTrialHero ? renderTrialHero() : renderActiveBilling()}
        </>
      )}

      <VCard variant="flat">
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 4 }}>
          Per-action pricing
        </div>
        <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 16 }}>
          You see the exact cost before you click Generate. No subscription — pay only for what you make.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {PER_ACTION_PRICES.map((row) => (
            <div
              key={row.key}
              style={{
                padding: 12,
                borderRadius: JELLY_TOKENS.radius.sm,
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
              }}
            >
              <div style={{ fontSize: 12, color: t.textSecondary }}>{row.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text, marginTop: 4 }}>
                {row.price}
                <span style={{ fontSize: 12, color: t.textSecondary, fontWeight: 500 }}>{row.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </VCard>

      <VCard variant="flat">
        <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginBottom: 16 }}>
          Frequently Asked Questions
        </div>
        {FAQ.map((q, i) => (
          <div key={i} style={{ borderTop: i === 0 ? 'none' : `1px solid ${t.border}`, padding: '12px 0' }}>
            <div
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 14,
                fontWeight: 600,
                color: t.text,
              }}
            >
              <span>{q.q}</span>
              <span style={{ color: t.textSecondary }}>{openFaq === i ? '−' : '+'}</span>
            </div>
            {openFaq === i && (
              <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8, lineHeight: 1.7 }}>{q.a}</div>
            )}
          </div>
        ))}
      </VCard>
    </div>
  );
}
