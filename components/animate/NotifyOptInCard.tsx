'use client';

/* NotifyOptInCard — "tell me when it's done" (2026-08-28).
 *
 * Lives on the Writing step (4) and the Progress tab. Four states:
 *   prompt      → the ask, with one button
 *   enabled     → subscribed on this browser (quiet confirmation)
 *   denied      → the browser blocked it; explain where to flip it
 *   unsupported → no push here (Safari without PWA install, http, etc.)
 *
 * Dismissal is per browser in localStorage `jelly.push-dismissed`. Email
 * still goes out on the same transitions whether or not push is on.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';
import { VBtn } from './primitives';
import { Icon } from './Icon';
import {
  currentPushSubscription,
  isPushSupported,
  pushPermission,
  subscribePush,
  type PushPermission,
} from '@/lib/vater/push-client';

const DISMISS_KEY = 'jelly.push-dismissed';

type CardState = 'loading' | 'prompt' | 'enabled' | 'denied' | 'unsupported';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* private mode */
  }
}

function fromPermission(p: PushPermission, subscribed: boolean): CardState {
  if (p === 'unsupported') return 'unsupported';
  if (p === 'denied') return 'denied';
  if (p === 'granted' && subscribed) return 'enabled';
  return 'prompt';
}

export interface NotifyOptInCardProps {
  /** Tighter card for list headers. */
  compact?: boolean;
  /** Hide the "not now" control (the Progress header always shows it). */
  dismissable?: boolean;
  style?: React.CSSProperties;
}

export function NotifyOptInCard({
  compact = false,
  dismissable = true,
  style,
}: NotifyOptInCardProps): React.ReactElement | null {
  const { t } = useTheme();
  const [state, setState] = React.useState<CardState>('loading');
  const [dismissed, setDismissed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setDismissed(readDismissed());
    if (!isPushSupported()) {
      setState('unsupported');
      return;
    }
    void (async () => {
      const sub = await currentPushSubscription();
      if (!alive) return;
      setState(fromPermission(pushPermission(), !!sub));
    })();
    return () => {
      alive = false;
    };
  }, []);

  const enable = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const r = await subscribePush();
      if (r.ok) setState('enabled');
      else {
        setState(fromPermission(r.permission, false));
        if (r.error) setError(r.error);
      }
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') return null;
  if (dismissed && state !== 'enabled' && dismissable) return null;
  // An unsupported browser gets nothing on the compact placement — a dead
  // explainer in a list header is noise.
  if (state === 'unsupported' && compact) return null;

  const copy: Record<Exclude<CardState, 'loading'>, { title: string; body: string }> = {
    prompt: {
      title: 'Get a nudge when it needs you',
      body: 'A browser notification when your script is ready to review, when it is time to pick an engine, and when the video lands. Email goes out too.',
    },
    enabled: {
      title: 'Notifications are on',
      body: 'This browser will get a nudge at every step that needs you. Email goes out too.',
    },
    denied: {
      title: 'Notifications are blocked',
      body: 'Your browser blocked them for tolley.io. Allow notifications in the site settings (the lock icon in the address bar) and reload — email still goes out either way.',
    },
    unsupported: {
      title: 'No browser notifications here',
      body: 'This browser cannot show push notifications. You will still get an email at every step that needs you, and the Progress tab lights up.',
    },
  };
  const c = copy[state];

  return (
    <div
      data-testid="notify-opt-in"
      data-state={state}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: compact ? '10px 12px' : '14px 16px',
        borderRadius: JELLY_TOKENS.radius.lg,
        border: `1px solid ${state === 'enabled' ? JELLY_TOKENS.brandOutline : t.border}`,
        background: state === 'enabled' ? JELLY_TOKENS.brandGhost : t.cardAlt,
        fontFamily: JELLY_TOKENS.font,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          width: 30,
          height: 30,
          borderRadius: '50%',
          alignItems: 'center',
          justifyContent: 'center',
          background: state === 'enabled' ? JELLY_TOKENS.gradChipOn : t.hover,
          flexShrink: 0,
        }}
      >
        <Icon name="bell" size={16} color={state === 'enabled' ? JELLY_TOKENS.brandLight : t.textSecondary} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 13 : 14, fontWeight: 600, color: t.text }}>{c.title}</div>
        {!compact && (
          <div style={{ fontSize: 12.5, color: t.textSecondary, lineHeight: 1.55, marginTop: 3 }}>
            {c.body}
          </div>
        )}
        {error && (
          <div style={{ fontSize: 12, color: JELLY_TOKENS.error, marginTop: 6 }}>{error}</div>
        )}
        {state === 'prompt' && (
          <div style={{ display: 'flex', gap: 8, marginTop: compact ? 8 : 10, flexWrap: 'wrap' }}>
            <VBtn size="sm" onClick={() => void enable()} disabled={busy} data-testid="notify-enable">
              {busy ? 'Turning on…' : 'Turn on notifications'}
            </VBtn>
            {dismissable && (
              <VBtn
                size="sm"
                variant="text"
                data-testid="notify-dismiss"
                onClick={() => {
                  writeDismissed();
                  setDismissed(true);
                }}
              >
                Not now
              </VBtn>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
