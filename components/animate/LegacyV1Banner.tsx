'use client';

/* LegacyV1Banner — sticky banner shown on the legacy YouTube page pointing
 * users at the new TubeGen-parity 3-click flow at /animate.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';
import { MicroLabel } from './cinema';

const STORAGE_KEY = 'jelly:legacyV1BannerDismissed';

export function LegacyV1Banner(): React.ReactElement | null {
  // Rendered on the legacy /vater/youtube page, outside any ThemeProvider —
  // useTheme()'s dark default is exactly the palette that page wants.
  const { t } = useTheme();
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
        background: JELLY_TOKENS.gradTicket,
        backdropFilter: t.glassBlur,
        WebkitBackdropFilter: t.glassBlur,
        color: t.textSecondary,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'center',
        fontSize: 13.5,
        fontWeight: 500,
        fontFamily: JELLY_TOKENS.font,
        borderBottom: `1px solid ${JELLY_TOKENS.brandOutline}`,
        textAlign: 'center',
        flexWrap: 'wrap',
      }}
    >
      <MicroLabel tone="violet" as="span" size={10.5} tracking="0.26em">
        Now showing
      </MicroLabel>
      <span>
        Try the new flow at{' '}
        <a
          href="/animate"
          style={{
            color: JELLY_TOKENS.cyan,
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            fontWeight: 600,
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
          background: 'transparent',
          color: t.textFaint,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: JELLY_TOKENS.radius.pill,
          padding: '4px 12px',
          cursor: 'pointer',
          fontFamily: JELLY_TOKENS.font,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
