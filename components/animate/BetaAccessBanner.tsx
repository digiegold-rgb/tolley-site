'use client';

/**
 * BetaAccessBanner — the invite-only public beta banner (2026-08-15).
 *
 * Announces the one thing every user needs to know on sight: what a video
 * costs and that nothing recurs. The numbers here must match the landing
 * page, lib/vater/help-content.ts and the Pricing screen — compute at cost
 * plus $0.35 per finished minute, prepaid credit, no subscription.
 *
 * It is dismissible (persisted in localStorage) so it doesn't nag forever.
 * DISMISS_KEY carries a version suffix: when the message materially changes,
 * bump it so people who dismissed the previous banner see the new one once.
 *
 * Note: rendered both inside the v2 Shell (RouteContext available) and on
 * the v1 /vater/youtube page (no RouteContext) — so it deliberately avoids
 * useRoute() and stays purely informational.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';

const DISMISS_KEY = 'vater-beta-banner-dismissed-v1.3';

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
        <strong>Public beta · invite only</strong> — pay only for what you
        render. No subscription, no commitment, no watermark. Failed renders are
        never charged.
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
