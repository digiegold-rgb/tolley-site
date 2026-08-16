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
import { JELLY_TOKENS, glass } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, SectionHeader } from '../../primitives';
import { AdmitOneTicket, GlassCard, MicroLabel, type TicketNote } from '../../cinema';
import { PricingCalculator } from '../../landing/PricingCalculator';

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

// ─── GET /api/vater/me/referrals ──────────────────────────────────────────

interface ReferralCode {
  code: string;
  display: string;
  link: string;
  used: boolean;
}

interface ReferralsResponse {
  ready: boolean;
  bonusCents: number;
  earnedCents: number;
  codes: ReferralCode[];
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

  const [referrals, setReferrals] = React.useState<ReferralsResponse | null>(null);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

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

  /* Referrals load separately from the balance on purpose: the codes come out
   * of a different table with its own migration, and a BetaInvite table that
   * is not there yet must not stop the Billing screen showing a balance. */
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/vater/me/referrals', { cache: 'no-store' });
        if (!res.ok) return;
        const body = (await res.json()) as ReferralsResponse;
        if (!cancelled && body.ready) setReferrals(body);
      } catch {
        /* the wallet still works without the referral card */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  /* Glass notice strip. The hue is the semantic token and the fill is the
   * glass recipe, so a banner reads as part of the same surface family as
   * every other panel rather than a coloured block bolted on. */
  const banner = (tone: 'ok' | 'warn' | 'error', text: string) => {
    const hue =
      tone === 'ok'
        ? JELLY_TOKENS.success
        : tone === 'warn'
          ? JELLY_TOKENS.warning
          : JELLY_TOKENS.error;
    return (
      <div
        style={{
          ...glass(t),
          padding: '10px 14px',
          fontSize: 13,
          borderRadius: JELLY_TOKENS.radius.md,
          borderLeft: `3px solid ${hue}`,
          color: hue,
        }}
      >
        {text}
      </div>
    );
  };

  /* The balance IS the ticket. Same stub the landing page's live meter uses,
   * so the number a customer watches tick up before signing up and the number
   * in their wallet afterwards are visibly the same object. */
  const renderBalance = () => {
    if (!data) return null;
    const { balance } = data;

    /* Unmetered gets the ticket shell but no fare: there is no number here,
     * and printing "$0.00" would read as a balance rather than as "this
     * account is not metered". */
    if (data.unmetered) {
      return (
        <GlassCard
          data-testid="credit-balance-ticket"
          variant="ticket"
          padding={30}
          halo
          shadow
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <MicroLabel tone="violet" size={11} tracking="0.24em">
              ADMIT ONE — UNMETERED
            </MicroLabel>
            <div style={{ fontSize: 11, color: JELLY_TOKENS.cyan, letterSpacing: '0.04em' }}>
              ● SEASON PASS
            </div>
          </div>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: t.text,
              marginTop: 6,
              lineHeight: 1.1,
            }}
          >
            No credit needed
          </div>
          <div style={{ borderTop: `1px dashed ${t.borderStrong}`, margin: '18px 0 12px' }} />
          <div style={{ fontSize: 11.5, color: t.textFaint, lineHeight: 1.5 }}>
            This account is billed outside the app, so renders never draw down a
            balance. Every video still shows its full cost on its receipt.
          </div>
        </GlassCard>
      );
    }

    const notes: TicketNote[] = [];
    if (balance.grantCents > 0) {
      notes.push({
        label: balance.grantExpiresAt
          ? `welcome credit — expires ${fmtDay(balance.grantExpiresAt)}`
          : 'welcome credit',
        value: usd(balance.grantCents),
        tone: 'cyan',
      });
    }
    notes.push({ label: 'purchased to date', value: usd(balance.lifetimePurchasedCents) });
    notes.push({ label: 'spent on videos', value: usd(balance.lifetimeSpentCents) });

    return (
      <div>
        <AdmitOneTicket
          data-testid="credit-balance-ticket"
          size="hero"
          label="ADMIT ONE — CREDIT BALANCE"
          state={balance.balanceCents > 0 ? 'GOOD FOR ONE PICTURE' : 'BOX OFFICE CLOSED'}
          totalUsd={balance.balanceCents / 100}
          notes={notes}
          action={
            <VBtn
              size="md"
              onClick={() => {
                document
                  .getElementById('credit-packs')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
            >
              Buy credits
            </VBtn>
          }
          footer={
            balance.grantCents > 0
              ? 'Welcome credit covers scripts and still images; animation runs on purchased credit. Credit you buy never expires.'
              : 'Credit is prepaid, so your balance is your spending limit. Failed renders are never charged.'
          }
        />
        {balance.balanceCents <= 0 && (
          <div style={{ marginTop: 12 }}>
            {banner('warn', 'Out of credit — add a pack below to keep rendering.')}
          </div>
        )}
      </div>
    );
  };

  /* Each pack is its own stub. The fare is what Stripe charges; the notes are
   * the credit it lands, the fee that is not ours, and what that buys in
   * finished minutes at the ops rate — the last one being the number people
   * actually want and previously had to work out themselves. */
  const renderPacks = () => {
    if (!data || data.unmetered) return null;
    const opsRate = data.opsRatePerMinute || 0.35;
    return (
      <div id="credit-packs">
        <SectionHeader
          icon="affiliate"
          eyebrow="THE BOX OFFICE"
          title="Add credit"
          description="One-off purchase. No subscription, and credit you buy does not expire."
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 14,
            marginTop: 18,
          }}
        >
          {data.packs.map((p) => (
            <AdmitOneTicket
              key={p.pack}
              data-testid={`credit-pack-ticket-${p.pack}`}
              size="card"
              label="ADMIT ONE — CREDIT PACK"
              totalUsd={p.priceCents / 100}
              notes={[
                { label: 'credit', value: usd(p.creditsCents), tone: 'cyan' },
                { label: 'Stripe fee', value: usd(p.priceCents - p.creditsCents), tone: 'faint' },
                {
                  label: 'ops covered',
                  value: `≈ ${(p.creditsCents / 100 / opsRate).toFixed(0)} min`,
                  tone: 'faint',
                },
              ]}
              action={
                /* The pack testid stays on the thing that starts checkout —
                 * it used to be the whole card, and a testid on a non-clickable
                 * wrapper is a click that silently does nothing. */
                <VBtn
                  size="sm"
                  data-testid={`credit-pack-${p.pack}`}
                  onClick={() => void buyPack(p.pack)}
                  disabled={buying !== null}
                  style={{ width: '100%' }}
                >
                  {buying === p.pack ? 'Redirecting…' : `Buy $${p.pack} pack`}
                </VBtn>
              }
              style={{ opacity: buying !== null && buying !== p.pack ? 0.5 : 1 }}
            />
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
          processing fee — we don&apos;t add anything on top of it. &ldquo;Ops
          covered&rdquo; is finished minutes at the ${opsRate.toFixed(2)}/min
          render-ops rate; compute is on top of it, at cost.
        </div>
      </div>
    );
  };

  const renderCard = () => {
    if (!data || data.unmetered) return null;
    const card = data.card;
    return (
      <VCard variant="flat">
        <SectionHeader
          icon="affiliate"
          eyebrow="THE BOX OFFICE — ON FILE"
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
          eyebrow="THE LEDGER"
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

  /* Referral card. Two single-use codes per account; the referrer is paid $5
   * of credit when someone who signed up on their link renders their first
   * billed video — not at signup, because signups are free to manufacture and
   * a finished video is not. Lives on Billing because what it pays out IS
   * credit, and this is the screen where credit is understood. */
  const renderReferrals = () => {
    if (!referrals || referrals.codes.length === 0) return null;
    return (
      <VCard variant="flat">
        <SectionHeader
          icon="affiliate"
          eyebrow="COMP TICKETS"
          title="Invite a friend, get credit"
          description={`You have ${referrals.codes.length} invite ${
            referrals.codes.length === 1 ? 'link' : 'links'
          }. Each one is single-use — when someone you invited finishes their first video, ${usd(
            referrals.bonusCents,
          )} of credit lands here.`}
        />
        {referrals.earnedCents > 0 && (
          <div style={{ fontSize: 13, color: JELLY_TOKENS.success, marginTop: 12, fontWeight: 600 }}>
            {usd(referrals.earnedCents)} earned so far.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {referrals.codes.map((c) => (
            <div
              key={c.code}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: '10px 14px',
                borderRadius: JELLY_TOKENS.radius.md,
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
                opacity: c.used ? 0.55 : 1,
              }}
            >
              <code style={{ fontSize: 14, color: t.text, letterSpacing: '0.04em' }}>
                {c.display}
              </code>
              <span style={{ fontSize: 12, color: t.textSecondary, flex: '1 1 auto' }}>
                {c.used ? 'Used — thank you' : 'Not used yet'}
              </span>
              {!c.used && (
                <VBtn
                  size="sm"
                  variant="outlined"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(c.link)
                      // No silent catch: a blocked clipboard has to say so, or
                      // the user pastes nothing and blames the link.
                      .then(() => setCopiedCode(c.code))
                      .catch(() =>
                        setActionError(
                          'Could not copy — your browser blocked clipboard access.',
                        ),
                      );
                  }}
                >
                  {copiedCode === c.code ? 'Copied' : 'Copy link'}
                </VBtn>
              )}
            </div>
          ))}
        </div>
      </VCard>
    );
  };

  /* The same calculator the public pricing page shows, themed for the studio.
   * It belongs here too: "how much credit should I buy?" is the question the
   * pack buttons above ask and do not answer, and a customer who has to guess
   * either overbuys or runs dry mid-render. */
  const renderCalculator = () => (
    <VCard variant="flat">
      <SectionHeader
        icon="affiliate"
        eyebrow="THE ESTIMATE"
        title="What will my month cost?"
        description="Describe the videos you plan to make. Estimates only — every project is quoted before it renders."
      />
      <div style={{ marginTop: 16 }}>
        <PricingCalculator
          title={null}
          fontFamily={JELLY_TOKENS.font}
          /* Cinema palette, built from the live theme slice so the calculator
           * tracks the studio's light/dark toggle instead of pinning the
           * landing page's own ink colours. */
          palette={{
            surface: t.card,
            surfaceAlt: t.cardAlt,
            text: t.text,
            textSecondary: t.textSecondary,
            border: t.border,
            accent: JELLY_TOKENS.brand,
          }}
        />
      </div>
    </VCard>
  );

  const renderExplainer = () => (
    <VCard variant="flat">
      <SectionHeader icon="help" eyebrow="THE FINE PRINT" title="How pricing works" />
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
          {renderReferrals()}
          {renderLedger()}
        </>
      )}

      {renderCalculator()}
      {renderExplainer()}
    </div>
  );
}
