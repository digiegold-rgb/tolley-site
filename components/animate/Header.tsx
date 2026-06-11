'use client';

/* Header + SettingsModal — ported from vater-core.jsx lines 282-380.
 *
 * Phase 1 wiring (2026-04-26 audit fixes):
 *  - Credits pill fetches /api/billing/status on mount (was hardcoded "81.1K credits")
 *  - Profile name + email read from useSession() (was hardcoded "Tyler Vater" + test email)
 *  - Logout calls signOut() from next-auth/react (was unwired)
 *  - Profile Save Changes replaced with external link to /account (matches Security/Team pattern)
 *  - Usage tab shows polished empty state + link to Pricing (was literal "Usage chart placeholder")
 *
 * Security and Team tabs continue to redirect to /account/security and /account/team.
 */

import * as React from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { JELLY_TOKENS } from './tokens';
import { useTheme, useRoute } from './theme-context';
import { Icon } from './Icon';
import { VBtn } from './primitives';

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
  isTrial: boolean;
  trial?: {
    transcripts: number;
    scenes: number;
    animations: number;
    caps: { transcripts: number; scenes: number; animations: number };
  };
}

export function Header(): React.ReactElement {
  const { t, dark, toggle } = useTheme();
  const { setRoute } = useRoute();
  const [showSettings, setShowSettings] = React.useState(false);
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
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 24px',
          gap: 12,
          background: t.headerBg,
          borderBottom: `1px solid ${t.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 90,
        }}
      >
        <VBtn
          size="sm"
          onClick={() => setRoute('pricing')}
          style={{ borderRadius: JELLY_TOKENS.radius.full, padding: '8px 20px' }}
        >
          Buy Credits
        </VBtn>
        <div
          style={{
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderRadius: JELLY_TOKENS.radius.full,
            padding: '6px 14px',
            fontSize: 14,
            fontWeight: 500,
            color: t.text,
          }}
          title={pillTitle}
        >
          {pillText}
        </div>
        <div style={{ cursor: 'pointer', padding: 8, borderRadius: '50%' }}>
          <Icon name="bell" size={20} color={t.textSecondary} />
        </div>
        <div onClick={toggle} style={{ cursor: 'pointer', padding: 8, borderRadius: '50%' }}>
          <Icon name={dark ? 'sun' : 'moon'} size={20} color={t.textSecondary} />
        </div>
        <div
          onClick={() => setShowSettings((prev) => !prev)}
          style={{
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
  const [tab, setTab] = React.useState<SettingsTab>('profile');
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
          width: 720,
          maxHeight: '80vh',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 200,
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
        <div style={{ flex: 1, padding: 24 }}>
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
                    color: fullName ? t.text : t.textDisabled,
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
                    color: email ? t.text : t.textDisabled,
                  }}
                >
                  {email || 'Sign in to view'}
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
                  Full Access Plan
                </div>
                <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 4 }}>
                  $200/month — Pay per section
                </div>
              </div>
              <SettingsExternalLink
                href="/account"
                label="Manage on Account Settings →"
                description="Edit your name, email, profile photo, and login methods on your full account page."
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
              href="/account/security"
              label="Manage on Account Settings →"
              description="Password, two-factor authentication, and active sessions are managed on your full account page."
            />
          )}
          {tab === 'team' && (
            <SettingsExternalLink
              href="/account/team"
              label="Manage on Account Settings →"
              description="Invite teammates, manage roles, and configure billing seats from your full account page."
            />
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
