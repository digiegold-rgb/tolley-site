'use client';

/* HelpFAB — floating help button, bottom-right.
 *
 * Ported from vater-core.jsx lines 382-393, which had no click handler at
 * all. It now opens the HelpDrawer via the Shell.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { Icon } from './Icon';

export interface HelpFABProps {
  onClick: () => void;
}

export function HelpFAB({ onClick }: HelpFABProps): React.ReactElement {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Help"
      data-testid="help-fab"
      className="jc-pill-gradient"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 48,
        height: 48,
        borderRadius: JELLY_TOKENS.radius.full,
        background: JELLY_TOKENS.gradPrimary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: `${JELLY_TOKENS.shadow4}, ${JELLY_TOKENS.brandGlow}`,
        zIndex: 80,
      }}
    >
      <Icon name="help" size={24} color={JELLY_TOKENS.onGradient} />
    </div>
  );
}
