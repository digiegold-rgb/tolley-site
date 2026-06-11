'use client';

/**
 * BetaAccessBanner — launch banner for pay-per-video billing (2026-06-11).
 *
 * The private-beta gate is gone: card-on-file Stripe billing is live. This
 * now announces the launch and points users at the Pricing screen. It is
 * dismissible (persisted in localStorage) so it doesn't nag forever.
 *
 * Note: rendered both inside the v2 Shell (RouteContext available) and on
 * the v1 /vater/youtube page (no RouteContext) — so it deliberately avoids
 * useRoute() and stays purely informational.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';

const DISMISS_KEY = 'vater-ppv-launch-banner-dismissed';

export function BetaAccessBanner(): React.ReactElement | null {
  // Start hidden, reveal after the localStorage check — avoids a hydration
  // mismatch between server (no localStorage) and a dismissed client.
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISS_KEY) !== '1');
    } catch {
      // localStorage unavailable (private mode etc.) — show the banner.
      setVisible(true);
    }
  }, []);

  const dismiss = React.useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Best-effort persistence only — the banner is already hidden for this
      // session, so a storage failure costs nothing.
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="status"
      data-testid="vater-launch-banner"
      style={{
        background: JELLY_TOKENS.gradCreate,
        color: '#fff',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'center',
        fontSize: 14,
        fontWeight: 500,
        borderBottom: `1px solid ${JELLY_TOKENS.brandDark}`,
        textAlign: 'center',
        flexWrap: 'wrap',
      }}
    >
      <span>
        <strong>Pay-per-video is live</strong> — add a card in Pricing and
        render without limits. No subscription, ~$25/video.
      </span>
      <button
        onClick={dismiss}
        aria-label="Dismiss banner"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          fontSize: 16,
          lineHeight: 1,
          cursor: 'pointer',
          padding: '2px 6px',
          fontWeight: 700,
        }}
      >
        ×
      </button>
    </div>
  );
}
