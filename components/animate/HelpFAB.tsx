'use client';

/* HelpFAB — ported verbatim from vater-core.jsx lines 382-393. */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { Icon } from './Icon';

export function HelpFAB(): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: JELLY_TOKENS.brand,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: JELLY_TOKENS.shadow4,
        zIndex: 80,
      }}
    >
      <Icon name="help" size={24} color="#fff" />
    </div>
  );
}
