'use client';

import * as React from 'react';
import { JELLY_TOKENS, glass } from '../tokens';
import { useTheme } from '../theme-context';

/* Glass panel: translucent fill + hairline + blur. `ticket` = the violet/cyan
 * tinted box-office variant; `halo` adds the violet glow; `hover` gets the
 * violet border/tint on pointer. */

export interface GlassCardProps {
  children?: React.ReactNode;
  variant?: 'glass' | 'ticket' | 'panel';
  radius?: number;
  padding?: number | string;
  halo?: boolean;
  hover?: boolean;
  shadow?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  'data-testid'?: string;
  id?: string;
}

export function GlassCard({
  children, variant = 'glass', radius = JELLY_TOKENS.radius.xl, padding = 24, halo, hover, shadow, style, className, onClick, id,
  'data-testid': testId,
}: GlassCardProps): React.ReactElement {
  const { t } = useTheme();
  const base: React.CSSProperties = { ...glass(t), borderRadius: radius, padding, fontFamily: JELLY_TOKENS.font, color: t.text, position: 'relative' };
  if (variant === 'ticket') {
    base.background = JELLY_TOKENS.gradTicket;
    base.border = `1px solid ${JELLY_TOKENS.brandOutline}`;
  }
  if (variant === 'panel') {
    base.background = t.panel;
    base.backdropFilter = undefined;
    base.WebkitBackdropFilter = undefined;
  }
  const shadows: string[] = [];
  if (shadow) shadows.push(t.cardShadow);
  if (halo) shadows.push(t.halo);
  if (shadows.length) base.boxShadow = shadows.join(', ');
  if (onClick) base.cursor = 'pointer';
  return (
    <div id={id} data-testid={testId} onClick={onClick} className={[hover ? 'jc-glass-hover' : '', className ?? ''].join(' ').trim() || undefined} style={{ ...base, ...style }}>
      {children}
    </div>
  );
}
