import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';

/* Film-strip frame: 20px sprocket rails top + bottom around a 16:9 media
 * area. The child MUST fill via position:absolute; inset:0 (an intrinsic
 * aspect-ratio would blow the grid track — the handoff's sizing lesson).
 * Server-safe. */

export interface FilmFrameProps {
  children: React.ReactNode;
  /** Media height in px, or omit and size the wrapper yourself. */
  height?: number | string;
  radius?: number;
  glow?: boolean;
  style?: React.CSSProperties;
  className?: string;
  overlay?: React.ReactNode;
}

const RAIL: React.CSSProperties = {
  backgroundImage: `radial-gradient(circle at 13px 50%, ${JELLY_TOKENS.dark.nebula} 5px, transparent 6px)`,
  backgroundSize: '30px 100%',
  backgroundColor: JELLY_TOKENS.dark.cardAlt,
};

export function FilmFrame({ children, height, radius = 14, glow = false, style, className, overlay }: FilmFrameProps): React.ReactElement {
  return (
    <div
      className={className}
      style={{
        display: 'grid', gridTemplateRows: '20px 1fr 20px', height,
        borderRadius: radius, overflow: 'hidden', background: JELLY_TOKENS.dark.cardAlt,
        border: `1px solid ${glow ? 'rgba(179,166,255,0.4)' : 'rgba(240,238,248,0.12)'}`,
        boxShadow: glow ? `0 50px 100px rgba(0,0,0,0.65), ${JELLY_TOKENS.dark.halo}` : JELLY_TOKENS.dark.cardShadow,
        ...style,
      }}
    >
      <div style={RAIL} />
      <div style={{ position: 'relative', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        {children}
        {overlay}
      </div>
      <div style={RAIL} />
    </div>
  );
}

/** Style for media inside a FilmFrame (or any float card). */
export const FILM_MEDIA_STYLE: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
