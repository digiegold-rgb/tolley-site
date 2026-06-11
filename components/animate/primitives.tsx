'use client';

/* Primitive UI components: VBtn, VCard, VInput, PillStepper, SectionHeader.
 * Ported from vater-core.jsx lines 116-200 and 423-447.
 *
 * Inline styles match the prototype exactly. No Tailwind, no CSS modules.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';
import { Icon, type IconName } from './Icon';

/* ─── VBtn ─── */

export type VBtnVariant =
  | 'primary'
  | 'accent'
  | 'outlined'
  | 'text'
  | 'white'
  | 'ghost'
  | 'danger';

export type VBtnSize = 'sm' | 'md' | 'lg';

export interface VBtnProps {
  children?: React.ReactNode;
  variant?: VBtnVariant;
  size?: VBtnSize;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
  disabled?: boolean;
  icon?: IconName | string;
}

export function VBtn({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  style,
  disabled,
  icon,
}: VBtnProps): React.ReactElement {
  const { t } = useTheme();
  const sizes: Record<VBtnSize, { padding: string; fontSize: number }> = {
    sm: { padding: '6px 14px', fontSize: 13 },
    md: { padding: '8px 22px', fontSize: 14 },
    lg: { padding: '12px 32px', fontSize: 15 },
  };
  const variants: Record<VBtnVariant, React.CSSProperties> = {
    primary: { background: JELLY_TOKENS.brand, color: '#fff', border: 'none' },
    accent: { background: JELLY_TOKENS.accent, color: '#000', border: 'none' },
    outlined: {
      background: 'transparent',
      color: JELLY_TOKENS.brand,
      border: `1px solid ${JELLY_TOKENS.brandOutline}`,
    },
    text: { background: 'transparent', color: JELLY_TOKENS.brand, border: 'none' },
    white: { background: 'rgba(255,255,255,0.95)', color: JELLY_TOKENS.brand, border: 'none' },
    ghost: { background: t.hover, color: t.text, border: 'none' },
    danger: { background: JELLY_TOKENS.error, color: '#fff', border: 'none' },
  };
  const v = variants[variant] ?? variants.primary;
  const s = sizes[size] ?? sizes.md;
  const [hovered, setHovered] = React.useState(false);
  const iconColor =
    typeof v.color === 'string' ? v.color : (JELLY_TOKENS.brand as string);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...v,
        ...s,
        fontFamily: JELLY_TOKENS.font,
        fontWeight: 500,
        borderRadius: JELLY_TOKENS.radius.md,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all .15s ease',
        opacity: disabled ? 0.5 : hovered ? 0.9 : 1,
        boxShadow: hovered && variant === 'primary' ? JELLY_TOKENS.brandGlow : 'none',
        textTransform: 'none',
        letterSpacing: 0,
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={s.fontSize + 2} color={iconColor} />}
      {children}
    </button>
  );
}

/* ─── VCard ─── */

export type VCardVariant = 'elevated' | 'flat' | 'hero';

export interface VCardProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
  variant?: VCardVariant;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function VCard({
  children,
  style,
  variant = 'elevated',
  onClick,
}: VCardProps): React.ReactElement {
  const { t, dark } = useTheme();
  const base: React.CSSProperties = {
    background: t.card,
    borderRadius: JELLY_TOKENS.radius.md,
    padding: 24,
    fontFamily: JELLY_TOKENS.font,
  };
  if (variant === 'elevated') {
    base.boxShadow = dark ? '0 2px 8px rgba(0,0,0,0.3)' : JELLY_TOKENS.shadow1;
  }
  if (variant === 'flat') {
    base.border = `1px solid ${t.border}`;
    base.boxShadow = 'none';
  }
  if (variant === 'hero') {
    base.borderRadius = JELLY_TOKENS.radius.xl;
    base.boxShadow = dark ? '0 4px 16px rgba(0,0,0,0.4)' : JELLY_TOKENS.shadow1;
  }
  if (onClick) base.cursor = 'pointer';
  return (
    <div onClick={onClick} style={{ ...base, ...style }}>
      {children}
    </div>
  );
}

/* ─── VInput ─── */

export interface VInputProps {
  value?: string;
  onChange?: (next: string) => void;
  placeholder?: string;
  maxLength?: number;
  style?: React.CSSProperties;
  label?: string;
  helper?: string;
}

export function VInput({
  value,
  onChange,
  placeholder,
  maxLength,
  style,
  label,
  helper,
}: VInputProps): React.ReactElement {
  const { t } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <div style={style}>
      {label && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: t.textSecondary,
            marginBottom: 6,
          }}
        >
          {label}
        </div>
      )}
      <input
        value={value ?? ''}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          fontSize: 16,
          fontFamily: JELLY_TOKENS.font,
          border: `${focused ? 2 : 1}px solid ${focused ? JELLY_TOKENS.brand : t.border}`,
          borderRadius: JELLY_TOKENS.radius.md,
          background: t.card,
          color: t.text,
          outline: 'none',
          boxSizing: 'border-box',
          padding: focused ? '13px' : '14px',
        }}
      />
      {helper && (
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>{helper}</div>
      )}
    </div>
  );
}

/* ─── PillStepper ─── */

export interface PillStepperProps {
  steps: ReadonlyArray<string>;
  active: number;
  onSelect: (index: number) => void;
}

export function PillStepper({
  steps,
  active,
  onSelect,
}: PillStepperProps): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 4,
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: JELLY_TOKENS.radius.pill,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      {steps.map((s, i) => (
        <div
          key={i}
          onClick={() => onSelect(i)}
          style={{
            padding: '10px 20px',
            borderRadius: JELLY_TOKENS.radius.pill,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: i === active ? 600 : 500,
            fontFamily: JELLY_TOKENS.font,
            background: i === active ? JELLY_TOKENS.brand : 'transparent',
            color: i === active ? '#fff' : t.textSecondary,
            transition: 'all .2s ease',
            whiteSpace: 'nowrap',
          }}
        >
          {s}
        </div>
      ))}
    </div>
  );
}

/* ─── RetryError ─── */

export interface RetryErrorProps {
  message: string;
  onRetry?: () => void;
  variant?: 'inline' | 'banner';
  style?: React.CSSProperties;
}

/**
 * Inline error block with optional Retry button.
 * Used by every v2 screen that fetches data — replaces silent "HTTP 401" /
 * "Could not load" text with a recoverable banner.
 */
export function RetryError({
  message,
  onRetry,
  variant = 'inline',
  style,
}: RetryErrorProps): React.ReactElement {
  const { t } = useTheme();
  const isBanner = variant === 'banner';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: isBanner ? '12px 16px' : '10px 14px',
        borderRadius: JELLY_TOKENS.radius.md,
        border: `1px solid ${JELLY_TOKENS.error}`,
        background: 'rgba(220,38,38,0.08)',
        color: JELLY_TOKENS.error,
        fontSize: 13,
        ...style,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '4px 12px',
            borderRadius: JELLY_TOKENS.radius.sm,
            border: `1px solid ${JELLY_TOKENS.error}`,
            background: 'transparent',
            color: JELLY_TOKENS.error,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: JELLY_TOKENS.font,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

/* ─── SectionHeader ─── */

export interface SectionHeaderProps {
  icon: IconName | string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  creditCost?: string;
}

export function SectionHeader({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  creditCost,
}: SectionHeaderProps): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: JELLY_TOKENS.radius.md,
            background: JELLY_TOKENS.brandGhost,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={20} color={JELLY_TOKENS.brand} />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>{title}</div>
          {description && (
            <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 2 }}>
              {description}
            </div>
          )}
        </div>
      </div>
      {actionLabel && (
        <VBtn onClick={onAction} icon="sparkle">
          {actionLabel}
          {creditCost && (
            <span style={{ fontSize: 11, opacity: 0.8, marginLeft: 4 }}>({creditCost})</span>
          )}
        </VBtn>
      )}
    </div>
  );
}
