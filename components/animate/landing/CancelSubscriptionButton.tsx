'use client';

/**
 * The decorative "Cancel my subscription" button in Act III.
 *
 * There is no subscription to cancel — that is the whole joke, and the whole
 * product claim. One-way state: the button fades to dim and strikes through,
 * and a cyan line explains that nothing happened. It calls no API, because
 * there is no API to call.
 */

import * as React from 'react';

import { JELLY_TOKENS } from '../tokens';

const t = JELLY_TOKENS.dark;

export function CancelSubscriptionButton(): React.ReactElement {
  const [cancelled, setCancelled] = React.useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
      <button
        type="button"
        data-testid="cancel-subscription"
        aria-pressed={cancelled}
        onClick={() => setCancelled(true)}
        style={{
          background: 'none',
          border: `1.5px solid ${cancelled ? 'rgba(240,238,248,0.15)' : 'rgba(143,125,255,0.6)'}`,
          color: cancelled ? t.textDisabled : t.text,
          fontSize: 15,
          padding: '14px 32px',
          borderRadius: JELLY_TOKENS.radius.md,
          cursor: cancelled ? 'default' : 'pointer',
          fontFamily: JELLY_TOKENS.font,
          fontWeight: 600,
          textDecoration: cancelled ? 'line-through' : 'none',
          transition: 'all 0.25s ease',
        }}
      >
        Cancel my subscription
      </button>
      <div role="status" style={{ fontSize: 13, color: JELLY_TOKENS.cyan, minHeight: 20 }}>
        {cancelled ? 'Nothing happened. There was never anything to cancel. Roll on.' : ''}
      </div>
    </div>
  );
}

export default CancelSubscriptionButton;
