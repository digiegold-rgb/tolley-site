'use client';

/* LegacyV1Banner — sticky banner shown on the legacy YouTube page pointing
 * users at the new TubeGen-parity 3-click flow at /animate.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';

const STORAGE_KEY = 'jelly:legacyV1BannerDismissed';

export function LegacyV1Banner(): React.ReactElement | null {
  const [hidden, setHidden] = React.useState(true);

  // Mount-only: restore dismissed state from localStorage. Default hidden
  // to avoid flashing the banner during hydration if it was already
  // dismissed.
  React.useEffect(() => {
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      setHidden(v === '1');
    } catch {
      // localStorage unavailable (private mode, etc) — show the banner.
      setHidden(false);
    }
  }, []);

  const dismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore — banner will reappear next visit
    }
    setHidden(true);
  }, []);

  if (hidden) return null;

  return (
    <div
      role="alert"
      data-testid="legacy-v1-banner"
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
        Try the new flow at{' '}
        <a
          href="/animate"
          style={{
            color: '#fff',
            textDecoration: 'underline',
            fontWeight: 700,
          }}
        >
          tolley.io/animate
        </a>{' '}
        — TubeGen-style 3-click create.
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss legacy banner"
        style={{
          marginLeft: 8,
          background: 'rgba(255,255,255,0.18)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 6,
          padding: '4px 10px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
