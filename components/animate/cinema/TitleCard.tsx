'use client';

import * as React from 'react';
import { JELLY_TOKENS, glass } from '../tokens';
import { useTheme } from '../theme-context';
import { MicroLabel } from './MicroLabel';

/* Glass "— TITLE CARD —": serif italic quote (26px / 1.4, reserves 2 lines) + meta. */
export function TitleCard({ quote, meta, label = '— TITLE CARD —', style }: { quote: React.ReactNode; meta?: React.ReactNode; label?: string; style?: React.CSSProperties }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div style={{ ...glass(t), display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center', borderRadius: 16, padding: '26px 40px', maxWidth: 560, margin: '0 auto', ...style }}>
      <MicroLabel tone="faint" size={10.5} tracking="0.3em" color={t.textFaint}>{label}</MicroLabel>
      <div style={{ fontFamily: JELLY_TOKENS.fontSerif, fontStyle: 'italic', fontSize: 26, lineHeight: 1.4, minHeight: '2.9em', display: 'flex', alignItems: 'center', color: t.text }}>
        “{quote}”
      </div>
      {meta && <div style={{ fontSize: 13, lineHeight: 1.6, color: t.textSecondary }}>{meta}</div>}
    </div>
  );
}
