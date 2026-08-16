'use client';

/**
 * BetaGate — two full-screen interrupts that sit ABOVE the studio Shell.
 *
 * 1. Access gate: the studio is invite-only. Owner + studio accounts are
 *    grandfathered (Trey); everyone else must have redeemed a BetaInvite
 *    (User.betaInviteId). Accounts that registered without an invite (the
 *    /signup path without callbackUrl) land here instead of an empty studio.
 * 2. Click-wrap: any signed-in account whose User.termsVersion !== TOS_VERSION
 *    must accept the current Terms / Privacy / Beta Addendum once. This is how
 *    accounts that pre-date 2026-08-15 (Trey) get their acceptance recorded.
 *
 * Both are driven by GET /api/vater/me → beta.{accessAllowed, termsAccepted}.
 * Optimistic defaults in tier-context mean a failed /me never locks anyone
 * out — the gate only shows on an explicit false.
 */

import React from 'react';
import { signOut } from 'next-auth/react';
import { useTier } from './tier-context';
import { useTheme } from './theme-context';
import { MicroLabel } from './cinema';
import { JELLY_TOKENS } from './tokens';

const SUPPORT_MAILTO =
  'mailto:support@tolley.io?subject=Jelly%20Studio%20beta%20invite';

/** Full-bleed scrim — the ink base, opaque enough to stop the studio bleeding
 *  through a gate the user has to act on. Not a palette hue. */
const SCRIM = 'rgba(8,7,15,0.92)';

export function BetaGate(): React.ReactElement | null {
  const { t } = useTheme();
  const { loading, beta, tier, markTermsAccepted } = useTier();

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    background: SCRIM,
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    fontFamily: JELLY_TOKENS.font,
  };

  const card: React.CSSProperties = {
    width: '100%',
    maxWidth: 520,
    background: t.panel,
    color: t.text,
    border: `1px solid ${t.border}`,
    borderRadius: JELLY_TOKENS.radius.xxl,
    padding: '28px 26px',
    boxShadow: `${JELLY_TOKENS.shadow24}, ${t.halo}`,
  };

  const linkStyle: React.CSSProperties = {
    color: t.link,
    textDecoration: 'underline',
    textUnderlineOffset: 3,
  };

  const primaryBtn: React.CSSProperties = {
    background: JELLY_TOKENS.gradPrimary,
    color: JELLY_TOKENS.onGradient,
    border: '1px solid transparent',
    borderRadius: JELLY_TOKENS.radius.pill,
    boxShadow: JELLY_TOKENS.brandGlow,
    padding: '13px 18px',
    fontFamily: JELLY_TOKENS.font,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  };
  const [checked, setChecked] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (loading) return null;

  if (!beta.accessAllowed) {
    return (
      <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div style={card}>
          <MicroLabel tone="violet" style={{ marginBottom: 10 }}>
            Jelly Studio · public beta
          </MicroLabel>
          <h2
            id="gate-title"
            style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: t.text }}
          >
            This beta is invite-only.
          </h2>
          <p style={{ margin: '0 0 18px', lineHeight: 1.6, fontSize: 14.5, color: t.textSecondary }}>
            Your account is signed in, but it hasn&apos;t redeemed an invite code.
            Ask us for one and we&apos;ll send a link — new invitees get a $10
            starter credit once a card is on file.
          </p>
          <a href={SUPPORT_MAILTO} style={{ ...primaryBtn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Request an invite
          </a>
          <p style={{ margin: '16px 0 0', fontSize: 13, lineHeight: 1.6, color: t.textFaint }}>
            Already have a code? Sign out and open your invite link
            (tolley.io/signup?…&amp;invite=CODE) with a new email, or reply to
            your invite email and we&apos;ll attach the code to this account.{' '}
            <button type="button" onClick={() => signOut({ callbackUrl: '/animate' })} style={{ ...linkStyle, background: 'none', border: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}>Sign out</button>
          </p>
        </div>
      </div>
    );
  }

  if (!beta.termsAccepted) {
    const accept = async () => {
      setBusy(true);
      setError(null);
      try {
        const r = await fetch('/api/vater/me', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ acceptTerms: true }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        markTermsAccepted();
      } catch {
        setError('Could not record your acceptance — try again in a moment.');
      } finally {
        setBusy(false);
      }
    };
    return (
      <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="terms-title">
        <div style={card}>
          <MicroLabel tone="cyan" style={{ marginBottom: 10 }}>
            {tier === 'owner' ? 'Owner · one-time confirmation' : 'One-time · takes 10 seconds'}
          </MicroLabel>
          <h2
            id="terms-title"
            style={{ margin: '0 0 10px', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: t.text }}
          >
            Updated Terms for the public beta
          </h2>
          <p style={{ margin: '0 0 14px', lineHeight: 1.6, fontSize: 14.5, color: t.textSecondary }}>
            Jelly Studio now has its own Terms, Privacy Policy and Beta Addendum
            (version {beta.tosVersion ?? '2026-08-15'}). Please read and accept
            once to keep using the studio.
          </p>
          <ul style={{ margin: '0 0 16px 18px', lineHeight: 1.7, fontSize: 14, color: t.textSecondary }}>
            <li><a href="/animate/terms" target="_blank" rel="noreferrer" style={linkStyle}>Terms of Service</a></li>
            <li><a href="/animate/privacy" target="_blank" rel="noreferrer" style={linkStyle}>Privacy Policy</a></li>
            <li><a href="/animate/beta" target="_blank" rel="noreferrer" style={linkStyle}>Beta Addendum</a> — plain-English summary</li>
          </ul>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.6, marginBottom: 18, cursor: 'pointer', color: t.textSecondary }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              style={{ marginTop: 3 }}
              data-testid="terms-accept-checkbox"
            />
            <span>
              I have read and agree to the Jelly Studio Terms, Privacy Policy and
              Beta Addendum, including the beta showcase license (which I can opt
              out of in Settings).
            </span>
          </label>
          {error && <p style={{ color: JELLY_TOKENS.error, fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
          <button
            type="button"
            onClick={accept}
            disabled={!checked || busy}
            style={{ ...primaryBtn, opacity: !checked || busy ? 0.5 : 1, cursor: !checked || busy ? 'not-allowed' : 'pointer' }}
            data-testid="terms-accept-button"
          >
            {busy ? 'Saving…' : 'I agree — continue to the studio'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
