'use client';

import * as React from 'react';
import Link from 'next/link';
import { JELLY_TOKENS } from '../tokens';
import { useTheme } from '../theme-context';

/* Pill CTA. `gradient` = the primary violet→cyan pill with ink text and glow;
 * `ghost` = hairline pill; `outline` = violet outline. Renders a Next <Link>
 * for internal hrefs, <a> for hashes/external, <button> otherwise. */

export type PillVariant = 'gradient' | 'ghost' | 'outline' | 'subtle';
export type PillSize = 'sm' | 'md' | 'lg';

export interface PillButtonProps {
  children: React.ReactNode;
  variant?: PillVariant;
  size?: PillSize;
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: React.CSSProperties;
  target?: string;
  rel?: string;
  'aria-label'?: string;
  'data-testid'?: string;
  title?: string;
}

const SIZES: Record<PillSize, React.CSSProperties> = {
  sm: { padding: '8px 16px', fontSize: 13 },
  md: { padding: '10px 22px', fontSize: 14 },
  lg: { padding: '15px 32px', fontSize: 15.5 },
};

export function PillButton({ children, variant = 'gradient', size = 'md', href, onClick, disabled, type = 'button', style, target, rel, title, 'aria-label': ariaLabel, 'data-testid': testId }: PillButtonProps): React.ReactElement {
  const { t } = useTheme();
  const variants: Record<PillVariant, React.CSSProperties> = {
    gradient: { background: JELLY_TOKENS.gradPrimary, color: JELLY_TOKENS.onGradient, border: '1px solid transparent', fontWeight: 700, boxShadow: JELLY_TOKENS.brandGlow },
    ghost: { background: 'transparent', color: t.text, border: `1px solid ${t.borderStrong}`, fontWeight: 500 },
    outline: { background: JELLY_TOKENS.brandGhost, color: t.text, border: `1px solid ${JELLY_TOKENS.brandOutline}`, fontWeight: 500 },
    subtle: { background: t.hover, color: t.text, border: '1px solid transparent', fontWeight: 500 },
  };
  const s: React.CSSProperties = {
    ...variants[variant],
    ...SIZES[size],
    fontFamily: JELLY_TOKENS.font,
    borderRadius: JELLY_TOKENS.radius.pill,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    textDecoration: 'none',
    lineHeight: 1.2,
    ...style,
  };
  const cls = variant === 'gradient' ? 'jc-pill-gradient' : 'jc-pill-ghost';
  if (href && !disabled) {
    const external = /^(https?:)?\/\//.test(href) || href.startsWith('mailto:');
    if (href.startsWith('#') || external) {
      return <a href={href} target={target} rel={rel} title={title} aria-label={ariaLabel} data-testid={testId} className={cls} style={s} onClick={onClick}>{children}</a>;
    }
    return <Link href={href} title={title} aria-label={ariaLabel} data-testid={testId} className={cls} style={s} onClick={onClick}>{children}</Link>;
  }
  return (
    <button type={type} disabled={disabled} title={title} aria-label={ariaLabel} data-testid={testId} className={cls} style={s} onClick={onClick}>
      {children}
    </button>
  );
}
