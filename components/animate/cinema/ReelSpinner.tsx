import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';

/* 34px film reel: violet ring, five hole dots, spins 360° / 14 s. Server-safe. */
export function ReelSpinner({ size = 34, spin = true, style }: { size?: number; spin?: boolean; style?: React.CSSProperties }): React.ReactElement {
  const hole = JELLY_TOKENS.dark.nebula;
  const hub = JELLY_TOKENS.dark.body;
  return (
    <div
      aria-hidden="true"
      className={spin ? 'jc-reel' : undefined}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        border: `2px solid rgba(143,125,255,0.6)`,
        background: `radial-gradient(circle at 50% 50%, ${hub} 3px, transparent 4px), radial-gradient(circle at 50% 18%, ${hole} 3.5px, transparent 4.5px), radial-gradient(circle at 82% 50%, ${hole} 3.5px, transparent 4.5px), radial-gradient(circle at 50% 82%, ${hole} 3.5px, transparent 4.5px), radial-gradient(circle at 18% 50%, ${hole} 3.5px, transparent 4.5px), rgba(143,125,255,0.12)`,
        ...style,
      }}
    />
  );
}
