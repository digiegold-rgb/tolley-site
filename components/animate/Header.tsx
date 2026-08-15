'use client';

/* Header + SettingsModal — ported from vater-core.jsx lines 282-380.
 *
 * Everything here reads live data: the usage pill and the Settings "plan"
 * card both come from /api/vater/billing/status, and the tier line comes
 * from /api/vater/me. There is no $200/month plan — the product is
 * pay-per-video, and the modal says so.
 *
 * Account links point at /settings (works for any signed-in user). They used
 * to point at /account, which is requireAdminPageSession — a dead end that
 * redirected every customer to the homepage.
 */

import * as React from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { JELLY_TOKENS } from './tokens';
import { useTheme, useRoute } from './theme-context';
import { useTier } from './tier-context';
import { Icon } from './Icon';
import { VBtn } from './primitives';
import { VaterCostPill } from './LatestUpdate';

function formatDollars(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

interface VaterBillingStatus {
  usage: {
    usedCents: number;
    includedCents: number;
    limitCents: number;
  };
  card: { brand: string | null; last4: string | null } | null;
  delinquent: boolean;
  isTrial: boolean;
  trial?: {
    transcripts: number;
    scenes: number;
    animations: number;
    caps: { transcripts: number; scenes: number; animations: number };
  };
}

/**
 * Shared fetch of /api/vater/billing/status. Used by the header pill and by
 * the Settings modal, which used to display a hardcoded "Full Access Plan —
 * $200/month". That plan does not exist: the product is pay-per-video.
 */
function useVaterBilling(): {
  billing: VaterBillingStatus | null;
  loading: boolean;
} {
  const [billing, setBilling] = React.useState<VaterBillingStatus | null>(null);
  const [billingLoading, setBillingLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/billing/status', { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as VaterBillingStatus;
        if (cancelled) return;
        setBilling(data);
      } catch {
        /* swallow — pill shows em-dash */
      } finally {
        if (!cancelled) setBillingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { billing, loading: billingLoading };
}

/** Truthful one-liner for the current billing state. */
function planSummary(
  billing: VaterBillingStatus | null,
  loading: boolean,
): { title: string; detail: string } {
  if (loading) return { title: 'Billing', detail: 'Loading…' };
  if (!billing) return { title: 'Billing', detail: 'Sign in to view your plan.' };
  if (billing.delinquent) {
    return {
      title: 'Past due',
      detail: 'A charge failed. Update your card to keep rendering.',
    };
  }
  if (billing.isTrial) {
    const tr = billing.trial;
    return {
      title: 'Free trial',
      detail: tr
        ? `${Math.max(0, tr.caps.transcripts - tr.transcripts)} transcripts, ${Math.max(0, tr.caps.scenes - tr.scenes)} scene generations and ${Math.max(0, tr.caps.animations - tr.animations)} animations left. No card on file.`
        : 'No card on file yet.',
    };
  }
  return {
    title: 'Pay per video',
    detail: billing.card?.last4
      ? `Card on file ending ${billing.card.last4}. No subscription — you are billed for what you render.`
      : 'No subscription — you are billed for what you render.',
  };
}

export interface HeaderProps {
  /** True below 768px — shows the hamburger that opens the nav drawer. */
  mobile?: boolean;
  onOpenNav?: () => void;
}

export function Header({ mobile = false, onOpenNav }: HeaderProps = {}): React.ReactElement {
  const { t, dark, toggle } = useTheme();
  const { setRoute } = useRoute();
  const { capabilities } = useTier();
  const [showSettings, setShowSettings] = React.useState(false);
  const { billing, loading: billingLoading } = useVaterBilling();

  // Trial pill: "Trial: 2 / 1 / 1" (transcripts / scenes / animations remaining)
  // Paid pill: "$X.XX of $250.00"
  const pillText = (() => {
    if (billingLoading) return '…';
    if (!billing) return '—';
    if (billing.isTrial && billing.trial) {
      const t = billing.trial;
      const remaining = {
        tr: Math.max(0, t.caps.transcripts - t.transcripts),
        sc: Math.max(0, t.caps.scenes - t.scenes),
        an: Math.max(0, t.caps.animations - t.animations),
      };
      return `Trial: ${remaining.tr}T · ${remaining.sc}S · ${remaining.an}A`;
    }
    return `${formatDollars(billing.usage.usedCents)} of ${formatDollars(billing.usage.includedCents)}`;
  })();

  const pillTitle = (() => {
    if (!billing) return 'Loading billing…';
    if (billing.isTrial && billing.trial) {
      return `Trial caps remaining — ${billing.trial.caps.transcripts - billing.trial.transcripts} transcripts, ${billing.trial.caps.scenes - billing.trial.scenes} scene generations, ${billing.trial.caps.animations - billing.trial.animations} animations`;
    }
    const overage = billing.usage.usedCents - billing.usage.includedCents;
    if (overage > 0) {
      return `Used ${formatDollars(billing.usage.usedCents)} this period (${formatDollars(overage)} over included $250). Limit: ${formatDollars(billing.usage.limitCents)}`;
    }
    return `Used ${formatDollars(billing.usage.usedCents)} of ${formatDollars(billing.usage.includedCents)} included this period. Limit: ${formatDollars(billing.usage.limitCents)}`;
  })();

  return (
    <>
      <div
        style={{
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: mobile ? '10px 12px' : '0 24px',
          gap: mobile ? 8 : 12,
          background: t.headerBg,
          borderBottom: `1px solid ${t.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 90,
        }}
      >
        {mobile && (
          <button
            type="button"
            aria-label="Open navigation"
            data-testid="nav-open"
            onClick={() => onOpenNav?.()}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              color: t.text,
              // pushes the account controls to the right edge without
              // spreading the pill/toggle/avatar apart
              marginRight: 'auto',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
            </svg>
          </button>
        )}
        {!mobile && <VaterCostPill />}
        {!mobile && (
          <VBtn
            size="sm"
            onClick={() => setRoute('pricing')}
            style={{ borderRadius: JELLY_TOKENS.radius.full, padding: '8px 20px' }}
          >
            Billing
          </VBtn>
        )}
        <div
          style={{
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderRadius: JELLY_TOKENS.radius.full,
            padding: '6px 14px',
            fontSize: mobile ? 12 : 14,
            fontWeight: 500,
            color: t.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: mobile ? 150 : undefined,
          }}
          title={pillTitle}
        >
          {pillText}
        </div>
        {capabilities.latestCosts && (
          <div
            role="button"
            tabIndex={0}
            aria-label="What's new"
            title="What's new — opens the update banner on your dashboard"
            data-testid="header-bell"
            onClick={() => setRoute('dashboard')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setRoute('dashboard');
              }
            }}
            style={{ cursor: 'pointer', padding: 8, borderRadius: '50%' }}
          >
            <Icon name="bell" size={20} color={t.textSecondary} />
          </div>
        )}
        <div
          role="button"
          tabIndex={0}
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          aria-pressed={dark}
          data-testid="theme-toggle"
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle();
            }
          }}
          style={{ cursor: 'pointer', padding: 8, borderRadius: '50%' }}
        >
          <Icon name={dark ? 'sun' : 'moon'} size={20} color={t.textSecondary} />
        </div>
        <div
          role="button"
          tabIndex={0}
          aria-label="Account settings"
          aria-expanded={showSettings}
          data-testid="account-menu"
          onClick={() => setShowSettings((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowSettings((prev) => !prev);
            }
          }}
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: JELLY_TOKENS.brand,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = 'profile' | 'security' | 'usage' | 'team';

const SETTINGS_TABS: ReadonlyArray<{ key: SettingsTab; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
  { key: 'usage', label: 'Usage' },
  { key: 'team', label: 'Team' },
];

export function SettingsModal({ onClose }: SettingsModalProps): React.ReactElement {
  const { t } = useTheme();
  const { setRoute } = useRoute();
  const { tier } = useTier();
  const [tab, setTab] = React.useState<SettingsTab>('profile');
  const { billing, loading: billingLoading } = useVaterBilling();
  const plan = planSummary(billing, billingLoading);
  const { data: session } = useSession();
  const fullName = session?.user?.name ?? '';
  const email = session?.user?.email ?? '';

  const activeLabel = SETTINGS_TABS.find((it) => it.key === tab)?.label ?? 'Profile';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.card,
          borderRadius: JELLY_TOKENS.radius.lg,
          boxShadow: JELLY_TOKENS.shadow24,
          width: 'min(720px, calc(100vw - 24px))',
          maxHeight: '85vh',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: `1px solid ${t.border}`,
            padding: '24px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <div
            style={{
              padding: '0 24px 16px',
              fontSize: 18,
              fontWeight: 700,
              color: t.text,
            }}
          >
            Account
          </div>
          {SETTINGS_TABS.map((tb) => (
            <div
              key={tb.key}
              onClick={() => setTab(tb.key)}
              style={{
                padding: '10px 24px',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: tab === tb.key ? 600 : 400,
                color: tab === tb.key ? JELLY_TOKENS.brand : t.text,
                background: tab === tb.key ? JELLY_TOKENS.brandGhost : 'transparent',
              }}
            >
              {tb.label}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div
            onClick={() => signOut({ callbackUrl: '/' })}
            style={{
              padding: '10px 24px',
              color: JELLY_TOKENS.error,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Logout
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: 24, overflowY: 'auto' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>{activeLabel}</div>
            <div onClick={onClose} style={{ cursor: 'pointer', padding: 4 }}>
              <Icon name="close" size={20} color={t.textSecondary} />
            </div>
          </div>
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: t.textSecondary,
                    marginBottom: 6,
                  }}
                >
                  Full Name
                </div>
                <div
                  style={{
                    padding: '14px',
                    fontSize: 16,
                    fontFamily: JELLY_TOKENS.font,
                    border: `1px solid ${t.border}`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    background: t.cardAlt,
                    color: fullName ? t.text : t.textSecondary,
                  }}
                >
                  {fullName || 'Not set'}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: t.textSecondary,
                    marginBottom: 6,
                  }}
                >
                  Email
                </div>
                <div
                  style={{
                    padding: '14px',
                    fontSize: 16,
                    fontFamily: JELLY_TOKENS.font,
                    border: `1px solid ${t.border}`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    background: t.cardAlt,
                    color: email ? t.text : t.textSecondary,
                  }}
                >
                  {email || 'Sign in to view'}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: t.textSecondary,
                    marginBottom: 6,
                  }}
                >
                  Access
                </div>
                <div
                  style={{
                    padding: '14px',
                    fontSize: 16,
                    fontFamily: JELLY_TOKENS.font,
                    border: `1px solid ${t.border}`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    background: t.cardAlt,
                    color: t.text,
                    textTransform: 'capitalize',
                  }}
                >
                  {tier} tier
                </div>
              </div>
              <div
                style={{
                  padding: 16,
                  background: t.cardAlt,
                  borderRadius: JELLY_TOKENS.radius.md,
                  border: `1px solid ${t.border}`,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                  {plan.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: t.textSecondary,
                    marginTop: 4,
                    lineHeight: 1.5,
                  }}
                >
                  {plan.detail}
                </div>
                <div
                  onClick={() => {
                    setRoute('pricing');
                    onClose();
                  }}
                  style={{
                    marginTop: 12,
                    display: 'inline-block',
                    padding: '8px 14px',
                    borderRadius: JELLY_TOKENS.radius.md,
                    background: JELLY_TOKENS.brandGhost,
                    color: JELLY_TOKENS.brand,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Manage billing →
                </div>
              </div>
              <SettingsExternalLink
                href="/settings"
                label="Open account settings →"
                description="Edit your name, email, and login methods on your account page."
              />
            </div>
          )}
          {tab === 'usage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>
                Per-section usage breakdown ships with the credit ledger. Section pricing
                and current rates live on the Pricing page.
              </div>
              <div
                onClick={() => {
                  setRoute('pricing');
                  onClose();
                }}
                style={{
                  alignSelf: 'flex-start',
                  padding: '10px 16px',
                  borderRadius: JELLY_TOKENS.radius.md,
                  background: JELLY_TOKENS.brandGhost,
                  color: JELLY_TOKENS.brand,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: JELLY_TOKENS.font,
                }}
              >
                See Pricing →
              </div>
            </div>
          )}
          {tab === 'security' && (
            <SettingsExternalLink
              href="/settings"
              label="Open account settings →"
              description="Sign-in method and active sessions are managed on your account page."
            />
          )}
          {tab === 'team' && (
            <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>
              Jelly Studio accounts are single-seat today — there are no
              teammates to invite yet. Projects and billing belong to{' '}
              {session?.user?.email || 'your account'} alone.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SettingsExternalLinkProps {
  href: string;
  label: string;
  description: string;
}

function SettingsExternalLink({
  href,
  label,
  description,
}: SettingsExternalLinkProps): React.ReactElement {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: t.textSecondary, fontSize: 14, lineHeight: 1.6 }}>{description}</div>
      <Link
        href={href}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          padding: '10px 16px',
          borderRadius: JELLY_TOKENS.radius.md,
          background: JELLY_TOKENS.brandGhost,
          color: JELLY_TOKENS.brand,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
          fontFamily: JELLY_TOKENS.font,
        }}
      >
        {label}
      </Link>
    </div>
  );
}
