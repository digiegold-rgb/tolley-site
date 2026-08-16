'use client';

/* Billing — Jelly Studio prepaid credits.
 *
 * Route id is still 'pricing' (nav-visibility.ts labels it "Billing"), but the
 * screen is no longer a price list. It is a wallet:
 *
 *   balance headline → pack buttons → card on file → ledger → how pricing works
 *
 * WHAT THIS REPLACED (2026-08-15): a card-on-file + per-action price table
 * (25¢ a scene, $2.50 a render) that invented numbers unrelated to what a
 * render actually costs, plus a self-set monthly ceiling to contain the
 * damage. Prepaid credit is its own spending limit, in dollars the customer
 * chose, and the price is the real one: compute at cost + $0.35 per finished
 * minute.
 *
 * Reads GET /api/vater/billing/credits — one call, so balance, packs and
 * ledger can never disagree with each other. Pack buttons render from the
 * server's own net-credit figures rather than recomputing the Stripe fee on
 * the client, because two copies of that formula is one copy too many.
 *
 * Errors surface inline with a real message. No silent catches — see
 * feedback_silent_failures_leads.md.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, SectionHeader } from '../../primitives';

// ─── GET /api/vater/billing/credits ───────────────────────────────────────

interface PackOption {
  pack: number;
  priceCents: number;
  creditsCents: number;
}

interface LedgerRow {
  id: string;
  createdAt: string;
  kind: string;
  deltaCents: number;
  projectId: string | null;
  note: string | null;
  expiresAt: string | null;
  stillsOnly: boolean;
  lineJson: {
    computeUsd?: number;
    minutes?: number;
    opsUsd?: number;
    totalUsd?: number;
    cappedAt?: number;
  } | null;
}

interface CreditsResponse {
  ready: boolean;
  unmetered: boolean;
  opsRatePerMinute: number;
  starterGrantCents: number;
  balance: {
    balanceCents: number;
    purchasedCents: number;
    grantCents: number;
    grantExpiresAt: string | null;
    lifetimePurchasedCents: number;
    lifetimeSpentCents: number;
  };
  packs: PackOption[];
  card: {
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
  } | null;
  ledger: LedgerRow[];
}

const KIND_LABEL: Record<string, string> = {
  purchase: 'Credit pack',
  grant: 'Welcome credit',
  debit: 'Video',
  refund: 'Refund',
  adjust: 'Adjustment',
};

function usd(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${Math.abs(cents / 100).toFixed(2)}`;
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

function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function PricingScreen(): React.ReactElement {
  const { t } = useTheme();

  const [data, setData] = React.useState<CreditsResponse | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [buying, setBuying] = React.useState<number | null>(null);
  const [redirecting, setRedirecting] = React.useState<'setup' | 'portal' | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [creditsAdded, setCreditsAdded] = React.useState(false);
  const [cardAdded, setCardAdded] = React.useState(false);

  /* Stripe redirect confirmations.
   *
   * The card flow is handed over by Shell via sessionStorage (Shell strips
   * ?card_added before this screen mounts). The credit-pack flow returns with
   * ?credits=ok, which Shell leaves alone, so this screen consumes it itself
   * and cleans the URL — a reload should not re-announce a purchase. */
  React.useEffect(() => {
    try {
      if (window.sessionStorage.getItem('vater-card-added') === '1') {
        setCardAdded(true);
        window.sessionStorage.removeItem('vater-card-added');
      }
    } catch {
      /* private mode — the Shell toast already confirmed it */
    }

    const search = new URLSearchParams(window.location.search);
    const credits = search.get('credits');
    if (!credits) return;
    if (credits === 'ok') setCreditsAdded(true);
    if (credits === 'cancelled') {
      setActionError('Checkout cancelled — nothing was charged.');
    }
    search.delete('credits');
    search.delete('session_id');
    const rest = search.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`,
    );
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // no-store: coming back from Stripe must show the new balance, not the
      // pre-checkout one.
      const res = await fetch('/api/vater/billing/credits', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData((await res.json()) as CreditsResponse);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load billing');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  /**
   * Stripe's webhook credits the balance, and it can land a beat after the
   * browser returns. One delayed refetch turns "I paid and nothing happened"
   * into "there it is" without making the customer reload.
   */
  React.useEffect(() => {
    if (!creditsAdded) return;
    const timer = window.setTimeout(() => void load(), 2500);
    return () => window.clearTimeout(timer);
  }, [creditsAdded, load]);

  const buyPack = React.useCallback(async (pack: number) => {
    setBuying(pack);
    setActionError(null);
    try {
      const res = await fetch('/api/vater/billing/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) throw new Error(body.error || `HTTP ${res.status}`);
      window.location.href = body.url as string;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not start checkout');
      setBuying(null);
    }
  }, []);

  const goStripe = React.useCallback(
    async (endpoint: '/api/vater/billing/setup' | '/api/vater/billing/portal') => {
      setRedirecting(endpoint.endsWith('setup') ? 'setup' : 'portal');
      setActionError(null);
      try {
        const res = await fetch(endpoint, { method: 'POST' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.url) throw new Error(body.error || `HTTP ${res.status}`);
        window.location.href = body.url as string;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Redirect failed');
        setRedirecting(null);
      }
    },
    [],
  );

  // ─── Sub-renders ─────────────────────────────────────────────────────

  const banner = (tone: 'ok' | 'warn' | 'error', text: string) => (
    <div
      style={{
        padding: '10px 14px',
        fontSize: 13,
        borderRadius: JELLY_TOKENS.radius.md,
        background:
          tone === 'ok'
            ? 'rgba(22,163,74,0.10)'
            : tone === 'warn'
              ? 'rgba(245,158,11,0.10)'
              : 'rgba(220,38,38,0.08)',
        color:
          tone === 'ok'
            ? JELLY_TOKENS.success
            : tone === 'warn'
              ? JELLY_TOKENS.warning
              : JELLY_TOKENS.error,
      }}
    >
      {text}
    </div>
  );

  const renderBalance = () => {
    if (!data) return null;
    const { balance } = data;

    if (data.unmetered) {
      return (
        <VCard variant="hero" style={{ borderTop: `4px solid ${JELLY_TOKENS.brand}` }}>
          <div style={{ fontSize: 12, color: JELLY_TOKENS.brand, fontWeight: 600 }}>
            Unmetered account
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: t.text, marginTop: 6 }}>
            No credit needed
          </div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8, lineHeight: 1.6 }}>
            This account is billed outside the app, so renders never draw down a
            balance. Every video still shows its full cost on its receipt.
          </div>
        </VCard>
      );
    }

    return (
      <VCard variant="hero" style={{ borderTop: `4px solid ${JELLY_TOKENS.brand}` }}>
        <div style={{ fontSize: 12, color: JELLY_TOKENS.brand, fontWeight: 600 }}>
          Credit balance
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: t.text, marginTop: 2 }}>
          {usd(balance.balanceCents)}
        </div>

        {balance.grantCents > 0 && (
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8, lineHeight: 1.6 }}>
            Includes <strong style={{ color: t.text }}>{usd(balance.grantCents)}</strong>{' '}
            of welcome credit
            {balance.grantExpiresAt ? ` — expires ${fmtDay(balance.grantExpiresAt)}` : ''}.
            It covers scripts and still images; animation runs on purchased
            credit.
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
            marginTop: 16,
            fontSize: 12,
            color: t.textSecondary,
          }}
        >
          <span>
            Purchased to date{' '}
            <strong style={{ color: t.text }}>{usd(balance.lifetimePurchasedCents)}</strong>
          </span>
          <span>
            Spent on videos{' '}
            <strong style={{ color: t.text }}>{usd(balance.lifetimeSpentCents)}</strong>
          </span>
        </div>

        {balance.balanceCents <= 0 && (
          <div style={{ marginTop: 16 }}>
            {banner('warn', 'Out of credit — add a pack below to keep rendering.')}
          </div>
        )}
      </VCard>
    );
  };

  const renderPacks = () => {
    if (!data || data.unmetered) return null;
    return (
      <VCard variant="flat">
        <SectionHeader
          icon="affiliate"
          title="Add credit"
          description="One-off purchase. No subscription, and credit you buy does not expire."
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            marginTop: 18,
          }}
        >
          {data.packs.map((p) => (
            <button
              key={p.pack}
              type="button"
              onClick={() => void buyPack(p.pack)}
              disabled={buying !== null}
              data-testid={`credit-pack-${p.pack}`}
              style={{
                textAlign: 'left',
                cursor: buying !== null ? 'default' : 'pointer',
                opacity: buying !== null && buying !== p.pack ? 0.5 : 1,
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.lg,
                padding: '16px 18px',
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 700, color: t.text }}>
                ${p.pack}
              </div>
              <div style={{ fontSize: 13, color: JELLY_TOKENS.brand, fontWeight: 600, marginTop: 2 }}>
                {buying === p.pack ? 'Redirecting…' : `${usd(p.creditsCents)} credit`}
              </div>
              <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
                {usd(p.priceCents - p.creditsCents)} Stripe fee
              </div>
            </button>
          ))}
        </div>
        <div
          style={{
            fontSize: 12,
            color: t.textSecondary,
            marginTop: 14,
            lineHeight: 1.6,
          }}
        >
          {/* Say it plainly rather than hiding the fee behind a $10.61 price. */}
          A $10 pack is $9.41 of credit. The difference is Stripe&apos;s card
          processing fee — we don&apos;t add anything on top of it.
        </div>
      </VCard>
    );
  };

  const renderCard = () => {
    if (!data || data.unmetered) return null;
    const card = data.card;
    return (
      <VCard variant="flat">
        <SectionHeader
          icon="affiliate"
          title="Card on file"
          description="Optional. Saved automatically when you buy a pack, so a top-up is one click."
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            marginTop: 16,
          }}
        >
          <div style={{ fontSize: 14, color: t.text }}>
            {card?.last4 ? (
              <>
                {card.brand ? card.brand.toUpperCase() : 'Card'} ····{card.last4}
                {card.expMonth && card.expYear ? (
                  <span style={{ color: t.textSecondary, fontSize: 12 }}>
                    {'  '}exp {String(card.expMonth).padStart(2, '0')}/{String(card.expYear).slice(-2)}
                  </span>
                ) : null}
              </>
            ) : (
              <span style={{ color: t.textSecondary }}>No card saved</span>
            )}
          </div>
          <VBtn
            size="sm"
            variant={card?.last4 ? 'ghost' : 'outlined'}
            disabled={redirecting !== null}
            onClick={() => void goStripe(card?.last4 ? '/api/vater/billing/portal' : '/api/vater/billing/setup')}
          >
            {redirecting !== null
              ? 'Opening…'
              : card?.last4
                ? 'Manage in Stripe'
                : 'Save a card'}
          </VBtn>
        </div>
      </VCard>
    );
  };

  const renderLedger = () => {
    if (!data || data.ledger.length === 0) return null;
    return (
      <VCard variant="flat">
        <SectionHeader
          icon="history"
          title="Activity"
          description="Every credit in and every credit out, with the video it paid for."
        />
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: t.textSecondary, textAlign: 'left' }}>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Date</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Detail</th>
                <th style={{ padding: '6px 8px', fontWeight: 600, textAlign: 'right' }}>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.map((row) => (
                <tr key={row.id} style={{ borderTop: `1px solid ${t.border}` }}>
                  <td style={{ padding: '8px', color: t.textSecondary, whiteSpace: 'nowrap' }}>
                    {fmtDate(row.createdAt)}
                  </td>
                  <td style={{ padding: '8px', color: t.text }}>
                    {KIND_LABEL[row.kind] ?? row.kind}
                  </td>
                  <td style={{ padding: '8px', color: t.textSecondary }}>
                    {row.note ?? '—'}
                    {row.lineJson?.cappedAt !== undefined && (
                      <span style={{ color: JELLY_TOKENS.success, marginLeft: 6 }}>
                        (capped — we covered the overrun)
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '8px',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                      fontWeight: 600,
                      color: row.deltaCents >= 0 ? JELLY_TOKENS.success : t.text,
                    }}
                  >
                    {row.deltaCents >= 0 ? '+' : ''}
                    {usd(row.deltaCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VCard>
    );
  };

  const renderExplainer = () => (
    <VCard variant="flat">
      <SectionHeader icon="help" title="How pricing works" />
      <div style={{ fontSize: 14, color: t.text, lineHeight: 1.8, marginTop: 14 }}>
        <p style={{ margin: '0 0 12px' }}>
          A finished video costs{' '}
          <strong>the compute it used, at cost</strong>, plus{' '}
          <strong>
            ${(data?.opsRatePerMinute ?? 0.35).toFixed(2)} per finished minute
          </strong>{' '}
          of render operations. Nothing else — no per-scene fees, no seat fees,
          no subscription.
        </p>
        <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
          <li>A typical long-form video lands between $1 and $7.</li>
          <li>You are charged when the video finishes, never before.</li>
          <li>
            <strong>Failed renders are never charged.</strong>
          </li>
          <li>
            If a video needs repair passes and overruns its estimate, we cap
            what you pay and cover the rest.
          </li>
          <li>Every video shows an itemised receipt when it&apos;s done.</li>
        </ul>
        <p style={{ margin: 0, color: t.textSecondary, fontSize: 13 }}>
          Credit is prepaid, so your balance is your spending limit — there is
          no bill to be surprised by.
        </p>
      </div>
    </VCard>
  );

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} data-testid="billing-screen">
      {cardAdded && banner('ok', 'Card saved.')}
      {creditsAdded && banner('ok', 'Payment received — your credit will appear in a moment.')}
      {actionError && banner('error', actionError)}

      {loading && (
        <div style={{ fontSize: 14, color: t.textSecondary }}>Loading billing…</div>
      )}

      {loadError && (
        <VCard variant="flat">
          {banner('error', loadError)}
          <VBtn size="sm" variant="outlined" style={{ marginTop: 12 }} onClick={() => void load()}>
            Try again
          </VBtn>
        </VCard>
      )}

      {data && !data.ready && !data.unmetered && (
        // "We can't see your credit" and "you have no credit" are different
        // sentences. Say the true one, and hide the buy buttons rather than
        // take money the ledger cannot record yet.
        <VCard variant="flat">
          {banner(
            'warn',
            'Credits are not switched on for this database yet. Nothing is being charged, and rendering is unaffected.',
          )}
        </VCard>
      )}

      {data && (data.ready || data.unmetered) && (
        <>
          {renderBalance()}
          {renderPacks()}
          {renderCard()}
          {renderLedger()}
        </>
      )}

      {renderExplainer()}
    </div>
  );
}
