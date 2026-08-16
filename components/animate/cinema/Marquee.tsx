'use client';

import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';
import { useTheme } from '../theme-context';

/* Hairline-bounded marquee strip. Items are ✦-separated and duplicated so the
 * translateX(-50%) loop is seamless. Reduced motion stops it (animate.css). */

export function Marquee({ items, speedSec = 30 }: { items: readonly string[]; speedSec?: number }): React.ReactElement {
  const { t } = useTheme();
  const seq = [...items, ...items];
  return (
    <div
      aria-label={items.join(' · ')}
      style={{ overflow: 'hidden', borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}`, padding: '14px 0', background: t.headerBg, backdropFilter: 'blur(6px)' }}
    >
      <div className="jc-marquee-track" style={{ display: 'flex', gap: 44, whiteSpace: 'nowrap', fontSize: 12.5, letterSpacing: '0.22em', color: t.textSecondary, width: 'max-content', animationDuration: `${speedSec}s`, fontFamily: JELLY_TOKENS.font }}>
        {seq.map((s, i) => (
          <React.Fragment key={i}>
            <span>{s}</span>
            <span aria-hidden="true">✦</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
