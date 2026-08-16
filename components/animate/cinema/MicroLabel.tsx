import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';

/* "ACT I — THE STORY", "— TITLE CARD —", "ADMIT ONE — LIVE METER".
 * 11.5px / 0.26em uppercase. Server-safe (no hooks). */

export type MicroTone = 'cyan' | 'violet' | 'faint' | 'secondary' | 'text';

export interface MicroLabelProps {
  children: React.ReactNode;
  tone?: MicroTone;
  size?: number;
  tracking?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'span' | 'p';
  /** Optional explicit colour (used when a theme slice colour is needed). */
  color?: string;
}

const TONES: Record<MicroTone, string> = {
  cyan: JELLY_TOKENS.cyan,
  violet: JELLY_TOKENS.brandLight,
  faint: JELLY_TOKENS.dark.textFaint,
  secondary: JELLY_TOKENS.dark.textSecondary,
  text: JELLY_TOKENS.dark.text,
};

export function MicroLabel({ children, tone = 'cyan', size, tracking, style, as = 'div', color }: MicroLabelProps): React.ReactElement {
  const Tag = as;
  return (
    <Tag
      style={{
        fontFamily: JELLY_TOKENS.font,
        fontSize: size ?? JELLY_TOKENS.micro.size,
        letterSpacing: tracking ?? JELLY_TOKENS.micro.tracking,
        textTransform: 'uppercase',
        fontWeight: 500,
        color: color ?? TONES[tone],
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
