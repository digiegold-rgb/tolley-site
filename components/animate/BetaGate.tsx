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
import { useTier } from './tier-context';
import { JELLY_TOKENS } from './tokens';

const SUPPORT_MAILTO =
  'mailto:support@tolley.io?subject=Jelly%20Studio%20beta%20invite';

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  background: 'rgba(8, 6, 16, 0.92)',
  backdropFilter: 'blur(6px)',
  fontFamily: JELLY_TOKENS.font,
};

const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  background: '#15121F',
  color: '#F1F0F5',
  border: `1px solid ${JELLY_TOKENS.brandDark}`,
  borderRadius: 16,
  padding: '28px 26px',
  boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
};

const linkStyle: React.CSSProperties = { color: '#C4B5FD', textDecoration: 'underline' };

const primaryBtn: React.CSSProperties = {
  background: JELLY_TOKENS.brand,
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '12px 18px',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
};

export function BetaGate(): React.ReactElement | null {
  const { loading, beta, tier, markTermsAccepted } = useTier();
  const [checked, setChecked] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (loading) return null;

  if (!beta.accessAllowed) {
    return (
      <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div style={card}>
          <div style={{ fontSize: 12, letterSpacing: '0.12em', opacity: 0.7, marginBottom: 8 }}>
            JELLY STUDIO · PUBLIC BETA
          </div>
          <h2 id="gate-title" style={{ margin: '0 0 10px', fontSize: 22 }}>
            This beta is invite-only.
          </h2>
          <p style={{ margin: '0 0 16px', lineHeight: 1.5, opacity: 0.9 }}>
            Your account is signed in, but it hasn&apos;t redeemed an invite code.
            Ask us for one and we&apos;ll send a link — new invitees get a $10
            starter credit once a card is on file.
          </p>
          <a href={SUPPORT_MAILTO} style={{ ...primaryBtn, display: 'block', textAlign: 'center', textDecoration: 'none' }}>
            Request an invite
          </a>
          <p style={{ margin: '14px 0 0', fontSize: 13, opacity: 0.75 }}>
            Already have a code? Sign out and open your invite link
            (tolley.io/signup?…&amp;invite=CODE) with a new email, or reply to
            your invite email and we&apos;ll attach the code to this account.{' '}
            <a href="/logout" style={linkStyle}>Sign out</a>
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
          <div style={{ fontSize: 12, letterSpacing: '0.12em', opacity: 0.7, marginBottom: 8 }}>
            {tier === 'owner' ? 'OWNER · ONE-TIME CONFIRMATION' : 'ONE-TIME · TAKES 10 SECONDS'}
          </div>
          <h2 id="terms-title" style={{ margin: '0 0 10px', fontSize: 22 }}>
            Updated Terms for the public beta
          </h2>
          <p style={{ margin: '0 0 14px', lineHeight: 1.5, opacity: 0.9 }}>
            Jelly Studio now has its own Terms, Privacy Policy and Beta Addendum
            (version {beta.tosVersion ?? '2026-08-15'}). Please read and accept
            once to keep using the studio.
          </p>
          <ul style={{ margin: '0 0 16px 18px', lineHeight: 1.7, fontSize: 14 }}>
            <li><a href="/animate/terms" target="_blank" rel="noreferrer" style={linkStyle}>Terms of Service</a></li>
            <li><a href="/animate/privacy" target="_blank" rel="noreferrer" style={linkStyle}>Privacy Policy</a></li>
            <li><a href="/animate/beta" target="_blank" rel="noreferrer" style={linkStyle}>Beta Addendum</a> — plain-English summary</li>
          </ul>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, lineHeight: 1.5, marginBottom: 16, cursor: 'pointer' }}>
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
          {error && <p style={{ color: '#FCA5A5', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
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
