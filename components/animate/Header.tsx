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
import { signOut, useSession } from 'next-auth/react';
import { JELLY_TOKENS } from './tokens';
import { useTheme, useRoute } from './theme-context';
import { useTier } from './tier-context';
import { Icon } from './Icon';
import { VBtn } from './primitives';
import { MicroLabel, PillButton } from './cinema';
import { VaterCostPill } from './LatestUpdate';
import {
  APP_VERSION,
  LAST_SEEN_VERSION_KEY,
  compareVersions,
} from '@/lib/vater/changelog';
import { AnimateSmsOptInPanel } from './AnimateSmsConsent';

/** Modal scrim — the ink base at 66%, not a palette hue. */
const SCRIM = 'rgba(8,7,15,0.66)';

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
  /** Opens the Help drawer scrolled to its "What's new" section. */
  onOpenWhatsNew?: () => void;
}

export function Header({
  mobile = false,
  onOpenNav,
  onOpenWhatsNew,
}: HeaderProps = {}): React.ReactElement {
  const { t, dark, toggle } = useTheme();
  const { setRoute } = useRoute();
  const { capabilities } = useTier();
  const [showSettings, setShowSettings] = React.useState(false);
  const { billing, loading: billingLoading } = useVaterBilling();

  // Unread dot on the version pill until this browser has opened the release
  // notes for the CURRENT version. Same per-browser localStorage pattern as
  // LatestUpdate's SEEN_KEY — a version compare rather than an id match, so a
  // user who skipped v1.2 still sees the dot on v1.3.
  const [versionUnread, setVersionUnread] = React.useState(false);
  React.useEffect(() => {
    try {
      const seen = window.localStorage.getItem(LAST_SEEN_VERSION_KEY);
      setVersionUnread(compareVersions(seen, APP_VERSION) < 0);
    } catch {
      // Private mode — no nag rather than a dot that can never be cleared.
      setVersionUnread(false);
    }
  }, []);

  const openWhatsNew = React.useCallback(() => {
    try {
      window.localStorage.setItem(LAST_SEEN_VERSION_KEY, APP_VERSION);
    } catch {
      /* private mode — the dot simply returns next load */
    }
    setVersionUnread(false);
    onOpenWhatsNew?.();
  }, [onOpenWhatsNew]);

  // Trial pill — desktop: "Trial · 3 transcripts · 1 scene · 1 animation";
  // mobile: "Trial 3T·1S·1A". Paid pill: "$X.XX of $250.00".
  // A native `title=` tooltip was the only explainer before, which needs a
  // ~1s still hover and never fires on touch — so the pill read as noise.
  // It now opens a real popover (hover or click) that spells out each cap.
  const trialRemaining = (() => {
    if (!billing?.isTrial || !billing.trial) return null;
    const t = billing.trial;
    return {
      tr: Math.max(0, t.caps.transcripts - t.transcripts),
      sc: Math.max(0, t.caps.scenes - t.scenes),
      an: Math.max(0, t.caps.animations - t.animations),
      caps: t.caps,
    };
  })();

  const pillText = (() => {
    if (billingLoading) return '…';
    if (!billing) return '—';
    if (trialRemaining) {
      const r = trialRemaining;
      if (mobile) return `Trial ${r.tr}T·${r.sc}S·${r.an}A`;
      return `Trial · ${r.tr} transcript${r.tr === 1 ? '' : 's'} · ${r.sc} scene${r.sc === 1 ? '' : 's'} · ${r.an} animation${r.an === 1 ? '' : 's'}`;
    }
    return `${formatDollars(billing.usage.usedCents)} of ${formatDollars(billing.usage.includedCents)}`;
  })();

  const pillTitle = (() => {
    if (!billing) return 'Loading billing…';
    if (trialRemaining) {
      return `Free trial — ${trialRemaining.tr} transcripts, ${trialRemaining.sc} scene generations, ${trialRemaining.an} animations left. Click for details.`;
    }
    const overage = billing.usage.usedCents - billing.usage.includedCents;
    if (overage > 0) {
      return `Used ${formatDollars(billing.usage.usedCents)} this period (${formatDollars(overage)} over included $250). Limit: ${formatDollars(billing.usage.limitCents)}`;
    }
    return `Used ${formatDollars(billing.usage.usedCents)} of ${formatDollars(billing.usage.includedCents)} included this period. Limit: ${formatDollars(billing.usage.limitCents)}`;
  })();

  // Popover state: opens on hover (desktop) or tap (any); closes on outside
  // click / Escape. Hover-close is delayed so the cursor can travel into it.
  const [pillOpen, setPillOpen] = React.useState(false);
  const pillWrapRef = React.useRef<HTMLDivElement | null>(null);
  const hoverTimer = React.useRef<number | null>(null);
  const openPill = React.useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setPillOpen(true);
  }, []);
  const closePillSoon = React.useCallback(() => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setPillOpen(false), 180);
  }, []);
  React.useEffect(() => {
    if (!pillOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!pillWrapRef.current?.contains(e.target as Node)) setPillOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPillOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [pillOpen]);

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
          backdropFilter: t.glassBlur,
          WebkitBackdropFilter: t.glassBlur,
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
        {/* Billing is always a box-office ticket. At header scale that is a
            compact ADMIT ONE pill: violet outline, ticket tint, cyan tabular
            balance. Hover or click opens the explainer popover. */}
        <div
          ref={pillWrapRef}
          style={{ position: 'relative', display: 'inline-flex', flexShrink: 1, minWidth: 0 }}
          onMouseEnter={mobile ? undefined : openPill}
          onMouseLeave={mobile ? undefined : closePillSoon}
        >
          <button
            type="button"
            data-testid="usage-chip"
            aria-haspopup="dialog"
            aria-expanded={pillOpen}
            aria-label={pillTitle}
            title={pillOpen ? undefined : pillTitle}
            onClick={() => setPillOpen((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: JELLY_TOKENS.gradTicket,
              border: `1px solid ${pillOpen ? JELLY_TOKENS.brand : JELLY_TOKENS.brandOutline}`,
              borderRadius: JELLY_TOKENS.radius.pill,
              padding: mobile ? '5px 11px' : '6px 14px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: mobile ? 170 : undefined,
              cursor: 'pointer',
              color: 'inherit',
              font: 'inherit',
            }}
          >
            {!mobile && (
              <MicroLabel tone="violet" as="span" size={9.5} tracking="0.22em">
                Admit one
              </MicroLabel>
            )}
            <span
              className="jc-tabular"
              style={{
                fontSize: mobile ? 12 : 13.5,
                fontWeight: 600,
                color: JELLY_TOKENS.cyan,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {pillText}
            </span>
          </button>
          {pillOpen && (
            <div
              role="dialog"
              aria-label="Your ticket"
              onMouseEnter={openPill}
              onMouseLeave={mobile ? undefined : closePillSoon}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                zIndex: 60,
                width: 300,
                maxWidth: 'calc(100vw - 24px)',
                padding: 14,
                borderRadius: 14,
                background: t.cardAlt,
                border: `1px solid ${JELLY_TOKENS.brandOutline}`,
                boxShadow: '0 18px 48px rgba(8,7,15,0.45)',
                color: t.text,
                fontFamily: JELLY_TOKENS.font,
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                <MicroLabel tone="violet" as="span" size={9.5} tracking="0.22em">
                  Admit one
                </MicroLabel>
                <span style={{ fontSize: 11, color: t.textSecondary }}>
                  {trialRemaining ? 'Free trial' : billing?.delinquent ? 'Past due' : 'Pay per video'}
                </span>
              </div>
              {trialRemaining ? (
                <>
                  <div style={{ fontSize: 12.5, lineHeight: 1.45, color: t.textSecondary, marginBottom: 10 }}>
                    Your ticket is a free trial. Every new account gets a small allowance of each step so you can try the whole pipeline before adding a card:
                  </div>
                  <TicketRow
                    k="T"
                    label="Transcripts"
                    hint="Scripts / transcripts Jelly writes or pulls from a video"
                    left={trialRemaining.tr}
                    cap={trialRemaining.caps.transcripts}
                    t={t}
                  />
                  <TicketRow
                    k="S"
                    label="Scene generations"
                    hint="Full sets of still images for a script"
                    left={trialRemaining.sc}
                    cap={trialRemaining.caps.scenes}
                    t={t}
                  />
                  <TicketRow
                    k="A"
                    label="Animations"
                    hint="Rendered, voiced MP4s"
                    left={trialRemaining.an}
                    cap={trialRemaining.caps.animations}
                    t={t}
                  />
                  <div style={{ fontSize: 11.5, lineHeight: 1.45, color: t.textSecondary, margin: '10px 0 12px' }}>
                    When one runs out, add a card and you move to pay-per-video — you are only billed for what you render.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, lineHeight: 1.45, color: t.textSecondary, marginBottom: 12 }}>
                  {pillTitle}
                </div>
              )}
              <VBtn
                size="sm"
                onClick={() => {
                  setPillOpen(false);
                  setShowSettings(true);
                }}
              >
                {trialRemaining ? 'Add a card / view plan' : 'View plan & usage'}
              </VBtn>
            </div>
          )}
        </div>
        <button
          type="button"
          data-testid="version-pill"
          onClick={openWhatsNew}
          aria-label={
            versionUnread
              ? `What's new in version ${APP_VERSION} — unread`
              : `What's new in version ${APP_VERSION}`
          }
          title={`Jelly Studio v${APP_VERSION} — click for release notes`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            padding: '5px 10px',
            borderRadius: JELLY_TOKENS.radius.full,
            border: `1px solid ${versionUnread ? JELLY_TOKENS.brand : t.border}`,
            background: 'transparent',
            color: versionUnread ? JELLY_TOKENS.brand : t.textSecondary,
            fontFamily: JELLY_TOKENS.font,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.02em',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          v{APP_VERSION}
          {versionUnread && (
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: JELLY_TOKENS.brand,
                flexShrink: 0,
              }}
            />
          )}
        </button>
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
            background: JELLY_TOKENS.gradPrimary,
            boxShadow: JELLY_TOKENS.brandGlow,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={JELLY_TOKENS.onGradient} aria-hidden="true">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  );
}

function TicketRow({
  k,
  label,
  hint,
  left,
  cap,
  t,
}: {
  k: string;
  label: string;
  hint: string;
  left: number;
  cap: number;
  t: ReturnType<typeof useTheme>['t'];
}): React.ReactElement {
  const out = left <= 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: 8, alignItems: 'start', padding: '5px 0', borderTop: `1px solid ${t.border}` }}>
      <span className="jc-tabular" style={{ fontSize: 11, fontWeight: 700, color: JELLY_TOKENS.brand, marginTop: 1 }}>{k}</span>
      <span>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: t.text }}>{label}</span>
        <span style={{ display: 'block', fontSize: 11, color: t.textSecondary, lineHeight: 1.35 }}>{hint}</span>
      </span>
      <span className="jc-tabular" style={{ fontSize: 12.5, fontWeight: 700, color: out ? t.textSecondary : JELLY_TOKENS.cyan, whiteSpace: 'nowrap' }}>
        {left} / {cap} left
      </span>
    </div>
  );
}

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsTab = 'profile' | 'security' | 'usage' | 'team' | 'studios';

const SETTINGS_TABS: ReadonlyArray<{ key: SettingsTab; label: string }> = [
  { key: 'profile', label: 'Profile' },
  { key: 'studios', label: 'Studios' },
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
        background: SCRIM,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* Opaque `t.panel`, never glass: a menu you can read the page through
          is a menu nobody can read. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.panel,
          border: `1px solid ${t.border}`,
          borderRadius: JELLY_TOKENS.radius.xl,
          boxShadow: `${JELLY_TOKENS.shadow24}, ${t.halo}`,
          width: 'min(720px, calc(100vw - 24px))',
          maxHeight: '85vh',
          display: 'flex',
          overflow: 'hidden',
          fontFamily: JELLY_TOKENS.font,
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
          <MicroLabel tone="faint" color={t.textFaint} size={10.5} tracking="0.26em" style={{ padding: '0 24px 16px' }}>
            Account
          </MicroLabel>
          {SETTINGS_TABS.map((tb) => (
            <div
              key={tb.key}
              onClick={() => setTab(tb.key)}
              style={{
                padding: '10px 24px',
                cursor: 'pointer',
                fontSize: 13.5,
                fontWeight: tab === tb.key ? 600 : 500,
                color: tab === tb.key ? t.text : t.textSecondary,
                background: tab === tb.key ? JELLY_TOKENS.gradChipOn : 'transparent',
                borderLeft: `2px solid ${tab === tb.key ? JELLY_TOKENS.brand : 'transparent'}`,
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
                <div style={{ marginTop: 12 }}>
                  <PillButton
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRoute('pricing');
                      onClose();
                    }}
                  >
                    Manage billing →
                  </PillButton>
                </div>
              </div>
              <ShowcaseOptOutToggle />
              <AnimateSmsOptInPanel />
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
                Your itemized ledger — every debit, refund, and pack purchase —
                lives on the Billing page, and each finished video carries its
                own line-by-line receipt in the Library.
              </div>
              <div style={{ alignSelf: 'flex-start' }}>
                <PillButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRoute('pricing');
                    onClose();
                  }}
                >
                  Open Billing →
                </PillButton>
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
          {tab === 'studios' && <StudiosSettings />}
          {tab === 'team' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>
                Invite teammates to see and work on this account&apos;s
                projects. Credits are never shared — a render is always billed
                to whoever owns the project.
              </div>
              <div style={{ alignSelf: 'flex-start' }}>
                <PillButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRoute('team');
                    onClose();
                  }}
                >
                  Manage team →
                </PillButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Settings → Studios: the management view behind the tab strip
 * (components/animate/WorkspaceTabs.tsx). Lists every studio including
 * archived ones, with rename / archive / restore. The strip is for switching;
 * this is for housekeeping.
 */
interface StudioRow {
  id: string;
  name: string;
  isPrimary: boolean;
  active: boolean;
  archivedAt: string | null;
}

function StudiosSettings(): React.ReactElement {
  const { t } = useTheme();
  const [rows, setRows] = React.useState<StudioRow[] | null>(null);
  const [max, setMax] = React.useState(10);
  const [notReady, setNotReady] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch('/api/vater/workspaces?archived=1', { cache: 'no-store' });
      if (r.status === 503) {
        setNotReady(true);
        setRows([]);
        return;
      }
      const data = (await r.json()) as { workspaces?: StudioRow[]; max?: number };
      setRows(Array.isArray(data.workspaces) ? data.workspaces : []);
      if (typeof data.max === 'number') setMax(data.max);
    } catch {
      setRows([]);
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const call = async (id: string, init: RequestInit, okMsg: string, reloadOnSwitch = false) => {
    setBusy(id);
    setMsg(null);
    try {
      const r = await fetch(`/api/vater/workspaces/${encodeURIComponent(id)}`, init);
      const data = (await r.json().catch(() => ({}))) as { message?: string; switched?: boolean };
      if (!r.ok) {
        setMsg(data.message || (r.status === 403 ? 'Read-only support session.' : 'That didn’t save.'));
      } else {
        setMsg(okMsg);
        if (reloadOnSwitch && data.switched) {
          window.location.assign('/animate');
          return;
        }
      }
    } catch {
      setMsg('That didn’t save.');
    } finally {
      setBusy(null);
      void load();
    }
  };

  const live = (rows ?? []).filter((r) => !r.archivedAt);
  const archived = (rows ?? []).filter((r) => r.archivedAt);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="studios-settings">
      <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.6 }}>
        Each studio is completely separate — its own library, characters, voices,
        connections, rules and balance — under this one login. Switch between them
        with the tabs at the top of the page. Archiving keeps everything; it just
        hides the tab.
      </div>
      {notReady ? (
        <div style={{ fontSize: 13, color: t.textFaint }}>Studios aren’t switched on for this account yet.</div>
      ) : null}
      {rows === null ? (
        <div style={{ fontSize: 13, color: t.textFaint }}>Loading…</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {live.map((r) => (
              <StudioSettingsRow
                key={r.id}
                row={r}
                busy={busy === r.id}
                onRename={(name) =>
                  void call(
                    r.id,
                    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) },
                    'Renamed.',
                  )
                }
                onArchive={() => {
                  if (window.confirm(`Archive “${r.name}”? Nothing is deleted — you can restore it here.`)) {
                    void call(r.id, { method: 'DELETE' }, 'Archived.', true);
                  }
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: t.textFaint, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {live.length} / {max} studios
          </div>
          {archived.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.textSecondary }}>Archived</div>
              {archived.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    border: `1px solid ${t.border}`,
                    borderRadius: JELLY_TOKENS.radius.md,
                    background: t.cardAlt,
                    opacity: 0.8,
                  }}
                >
                  <span style={{ flex: 1, fontSize: 14, color: t.textSecondary, textDecoration: 'line-through' }}>{r.name}</span>
                  <PillButton
                    variant="outline"
                    size="sm"
                    disabled={busy === r.id || live.length >= max}
                    onClick={() =>
                      void call(
                        r.id,
                        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restore: true }) },
                        'Restored.',
                      )
                    }
                  >
                    Restore
                  </PillButton>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}
      {msg ? <div style={{ fontSize: 12.5, color: t.textSecondary }}>{msg}</div> : null}
    </div>
  );
}

function StudioSettingsRow({
  row,
  busy,
  onRename,
  onArchive,
}: {
  row: StudioRow;
  busy: boolean;
  onRename: (name: string) => void;
  onArchive: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [name, setName] = React.useState(row.name);
  React.useEffect(() => setName(row.name), [row.name]);
  const dirty = name.trim() !== row.name && name.trim().length > 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        border: `1px solid ${row.active ? t.borderStrong : t.border}`,
        borderRadius: JELLY_TOKENS.radius.md,
        background: row.active ? JELLY_TOKENS.gradChipOn : t.cardAlt,
      }}
    >
      <input
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && dirty) onRename(name.trim());
        }}
        aria-label={`Studio name for ${row.name}`}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${dirty ? JELLY_TOKENS.brand : 'transparent'}`,
          outline: 'none',
          color: t.text,
          font: 'inherit',
          fontSize: 14,
          fontWeight: 600,
          padding: '2px 0',
        }}
      />
      {row.isPrimary ? (
        <span style={{ fontSize: 11, color: t.textFaint, letterSpacing: '0.1em' }}>MAIN</span>
      ) : null}
      {row.active ? (
        <span style={{ fontSize: 11, color: JELLY_TOKENS.cyan, letterSpacing: '0.1em' }}>OPEN</span>
      ) : null}
      {dirty ? (
        <PillButton variant="gradient" size="sm" disabled={busy} onClick={() => onRename(name.trim())}>
          Save
        </PillButton>
      ) : null}
      {!row.isPrimary ? (
        <PillButton variant="outline" size="sm" disabled={busy} onClick={onArchive}>
          Archive
        </PillButton>
      ) : null}
    </div>
  );
}

/**
 * Terms § 7 promotional-license opt-out.
 *
 * Default is OPT-IN (showcaseOptOut === false): the Beta Addendum says we may
 * showcase renders. This is the switch that makes that promise keepable —
 * a licence term with no way to withdraw consent is not a licence term.
 *
 * Reads and writes /api/vater/me. The checkbox reflects SERVER state at all
 * times: it goes disabled during the save and reverts on failure rather than
 * showing a preference that didn't persist, because "I turned that off" is
 * exactly the kind of thing someone will later be certain about.
 *
 * ⚠️ During an admin view-as session this PATCH is 403'd by proxy.ts. That is
 * intended — support must never flip a customer's licensing consent for them.
 */
function ShowcaseOptOutToggle(): React.ReactElement {
  const { t } = useTheme();
  const [optOut, setOptOut] = React.useState<boolean | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/me', { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as { beta?: { showcaseOptOut?: boolean } };
        if (!cancelled) setOptOut(Boolean(data.beta?.showcaseOptOut));
      } catch {
        /* leave it indeterminate rather than guessing a consent value */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = React.useCallback(
    async (next: boolean) => {
      const previous = optOut;
      setOptOut(next);
      setSaving(true);
      setError(null);
      try {
        const r = await fetch('/api/vater/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ showcaseOptOut: next }),
        });
        if (!r.ok) {
          setOptOut(previous);
          setError(
            r.status === 403
              ? "Can't change this from a support session."
              : "Couldn't save that — try again.",
          );
        }
      } catch {
        setOptOut(previous);
        setError("Couldn't save that — try again.");
      } finally {
        setSaving(false);
      }
    },
    [optOut],
  );

  // `optOut` is the opt-OUT flag; the checkbox asks the positive question.
  const allowed = optOut === null ? true : !optOut;

  return (
    <div
      style={{
        padding: 16,
        background: t.cardAlt,
        borderRadius: JELLY_TOKENS.radius.md,
        border: `1px solid ${t.border}`,
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          cursor: optOut === null || saving ? 'default' : 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={allowed}
          disabled={optOut === null || saving}
          onChange={(e) => void toggle(!e.target.checked)}
          data-testid="showcase-opt-out"
          style={{ marginTop: 3 }}
        />
        <span>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
            Allow Jelly Studio to showcase my renders
          </span>
          <span
            style={{
              display: 'block',
              marginTop: 4,
              fontSize: 13,
              color: t.textSecondary,
              lineHeight: 1.5,
            }}
          >
            Beta licence (Terms § 7). On by default. Turn it off and we won&apos;t use
            your videos in demos, the landing page or social posts. Your videos are
            yours either way.
          </span>
        </span>
      </label>
      {error ? (
        <div style={{ marginTop: 8, fontSize: 12, color: JELLY_TOKENS.error }}>{error}</div>
      ) : null}
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
      <PillButton variant="outline" size="sm" href={href} style={{ alignSelf: 'flex-start' }}>
        {label}
      </PillButton>
    </div>
  );
}
