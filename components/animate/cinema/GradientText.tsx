import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';

/* Gradient-clipped text. `serif` switches to Instrument Serif italic — the
 * cinematic accent, reserved for emotional moments (hero phrase, title cards,
 * "Directed by you."). Server-safe. */

export interface GradientTextProps {
  children: React.ReactNode;
  serif?: boolean;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'div';
  style?: React.CSSProperties;
  className?: string;
}

export function GradientText({ children, serif = false, as = 'span', style, className }: GradientTextProps): React.ReactElement {
  const Tag = as;
  return (
    <Tag
      className={className}
      style={{
        background: JELLY_TOKENS.gradText,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        ...(serif ? { fontFamily: JELLY_TOKENS.fontSerif, fontStyle: 'italic', fontWeight: 400 } : {}),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
