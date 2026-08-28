'use client';

/* Primitive UI components: VBtn, VCard, VInput, PillStepper, SectionHeader.
 * Cinema language (2026-08-16): gradient pill CTAs, glass cards with
 * hairlines, violet focus rings. API unchanged — every consumer of the
 * pre-cinema primitives keeps compiling; only the look moved.
 *
 * Inline styles only. No Tailwind, no CSS modules.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { JELLY_TOKENS, glass } from './tokens';
import { MicroLabel } from './cinema/MicroLabel';
import { useTheme } from './theme-context';
import { Icon, type IconName } from './Icon';
import { StepHint } from './engine/StepHint';

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
  /** Passthrough hooks for accessibility + the audit harness. */
  'aria-label'?: string;
  'data-testid'?: string;
  /** Escape hatch for behaviour inline styles cannot express — an animation
   *  that has to honour prefers-reduced-motion needs a media query, and a
   *  media query needs a stylesheet rule. Kept narrow on purpose: styling
   *  still belongs in `style`. */
  className?: string;
}

export function VBtn({
  children,
  variant = 'primary',
  size = 'md',
  'aria-label': ariaLabel,
  'data-testid': testId,
  onClick,
  style,
  disabled,
  icon,
  className,
}: VBtnProps): React.ReactElement {
  const { t } = useTheme();
  const sizes: Record<VBtnSize, { padding: string; fontSize: number }> = {
    sm: { padding: '7px 14px', fontSize: 13 },
    md: { padding: '9px 22px', fontSize: 14 },
    lg: { padding: '14px 32px', fontSize: 15.5 },
  };
  const variants: Record<VBtnVariant, React.CSSProperties> = {
    primary: { background: JELLY_TOKENS.gradPrimary, color: JELLY_TOKENS.onGradient, border: '1px solid transparent', fontWeight: 700 },
    accent: { background: JELLY_TOKENS.cyan, color: JELLY_TOKENS.onGradient, border: '1px solid transparent', fontWeight: 700 },
    outlined: {
      background: JELLY_TOKENS.brandGhost,
      color: t.text,
      border: `1px solid ${JELLY_TOKENS.brandOutline}`,
    },
    text: { background: 'transparent', color: t.link, border: '1px solid transparent' },
    white: { background: t.panel, color: JELLY_TOKENS.brand, border: `1px solid ${t.border}` },
    ghost: { background: t.hover, color: t.text, border: `1px solid ${t.border}` },
    danger: { background: 'rgba(240,96,122,0.14)', color: JELLY_TOKENS.error, border: '1px solid rgba(240,96,122,0.4)' },
  };
  const v = variants[variant] ?? variants.primary;
  const s = sizes[size] ?? sizes.md;
  const [hovered, setHovered] = React.useState(false);
  const iconColor =
    typeof v.color === 'string' ? v.color : (JELLY_TOKENS.brand as string);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      data-testid={testId}
      className={className}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...v,
        ...s,
        fontFamily: JELLY_TOKENS.font,
        fontWeight: v.fontWeight ?? 500,
        borderRadius: JELLY_TOKENS.radius.pill,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        lineHeight: 1.2,
        transition: 'all .2s ease',
        opacity: disabled ? 0.5 : 1,
        transform: hovered && !disabled && variant === 'primary' ? 'translateY(-1px)' : 'none',
        filter: hovered && !disabled && variant !== 'primary' ? 'brightness(1.08)' : 'none',
        boxShadow: variant === 'primary' ? (hovered ? '0 16px 50px rgba(143,125,255,0.45)' : JELLY_TOKENS.brandGlow) : 'none',
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
  /** Passthrough hook for the audit harness. */
  'data-testid'?: string;
}

export function VCard({
  children,
  style,
  variant = 'elevated',
  onClick,
  'data-testid': testId,
}: VCardProps): React.ReactElement {
  const { t } = useTheme();
  const base: React.CSSProperties = {
    ...glass(t),
    borderRadius: JELLY_TOKENS.radius.lg,
    padding: 24,
    fontFamily: JELLY_TOKENS.font,
    color: t.text,
  };
  if (variant === 'elevated') {
    base.boxShadow = JELLY_TOKENS.shadow1;
  }
  if (variant === 'flat') {
    base.boxShadow = 'none';
  }
  if (variant === 'hero') {
    base.borderRadius = JELLY_TOKENS.radius.xxl;
    base.boxShadow = `${t.cardShadow}, ${t.halo}`;
    base.border = `1px solid ${JELLY_TOKENS.brandOutline}`;
  }
  if (onClick) base.cursor = 'pointer';
  return (
    <div data-testid={testId} onClick={onClick} style={{ ...base, ...style }}>
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
          border: `1px solid ${focused ? JELLY_TOKENS.brand : t.borderStrong}`,
          borderRadius: JELLY_TOKENS.radius.md,
          background: t.card,
          color: t.text,
          outline: 'none',
          boxSizing: 'border-box',
          padding: '13px 14px',
          boxShadow: focused ? '0 0 0 3px rgba(143,125,255,0.2)' : 'none',
          transition: 'border-color .15s ease, box-shadow .15s ease',
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
  /**
   * Optional per-step tooltip copy (same index as `steps`). When a hint is
   * present a small "?" sits inside the pill; hover / tap / focus shows it.
   * Pass EDITOR_STEP_HINTS for the Create Video editor. Undefined → the
   * pre-existing pill, byte for byte.
   */
  hints?: ReadonlyArray<React.ReactNode | null | undefined>;
}

/** Tooltip copy for the seven Create Video steps (EDITOR_STEPS order). */
export const EDITOR_STEP_HINTS: readonly string[] = [
  'Name the video and set the goal. The title is the brief every later step reads — commit it first.',
  'Jelly writes the script in your voice, or paste your own. You approve it before anything is rendered — and pick the engine: Jelly Auto (now) or Fable 5 Concierge (hand-directed, a few hours).',
  'Narration from your style’s voice — your own ElevenLabs voice, a cloned voice, or a studio voice. Re-record single lines later without re-rendering the video.',
  'One still per beat in your art style, then optional motion. Review every scene, regenerate the ones you don’t love, add animation where it earns its keep.',
  'Background music under the narration. Included — pick a track and a level, or leave it off.',
  'A thumbnail in the same art style as the video, from concepts you choose.',
  'Title, description, tags and chapters for YouTube and the socials — generated from the finished script.',
] as const;

export function PillStepper({
  steps,
  active,
  onSelect,
  hints,
}: PillStepperProps): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        ...glass(t),
        borderRadius: JELLY_TOKENS.radius.pill,
        flexWrap: 'wrap',
        justifyContent: 'center',
      }}
    >
      {steps.map((s, i) => (
        <div
          key={i}
          role="button"
          tabIndex={0}
          aria-label={String(s)}
          aria-current={i === active ? 'step' : undefined}
          data-testid={`step-${i}`}
          onClick={() => onSelect(i)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelect(i);
            }
          }}
          style={{
            padding: '10px 20px',
            borderRadius: JELLY_TOKENS.radius.pill,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: i === active ? 600 : 500,
            fontFamily: JELLY_TOKENS.font,
            background: i === active ? JELLY_TOKENS.gradChipOn : 'transparent',
            border: `1px solid ${i === active ? 'rgba(143,125,255,0.7)' : 'transparent'}`,
            color: i === active ? t.text : t.textSecondary,
            transition: 'all .2s ease',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {hints?.[i] ? (
            <StepHint text={hints[i]} label={`About the ${String(s)} step`} clickThrough>
              {s}
            </StepHint>
          ) : (
            s
          )}
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
        border: `1px solid rgba(240,96,122,0.4)`,
        background: 'rgba(240,96,122,0.08)',
        color: JELLY_TOKENS.error,
        fontSize: 13,
        backdropFilter: 'blur(8px)',
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

/* ─── ConfirmDialog ───
 * Shared confirmation modal replacing native window.confirm() across the
 * studio. Portalled to <body>: fixed overlays rendered inside <main> stack
 * BELOW the studio header/sidebar (2026-08-19 beta finding).
 */

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel: string;
  /** Danger = error-red confirm button; default = brand gradient. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement | null {
  const { t } = useTheme();
  if (!open) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          /* Opaque panel, not glass: `t.card` is translucent in the cinema
           * language, and a see-through modal is unreadable over the studio. */
          background: t.panel,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: JELLY_TOKENS.radius.xxl,
          boxShadow: JELLY_TOKENS.shadow24,
          padding: 20,
          fontFamily: JELLY_TOKENS.font,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{title}</div>
        {body && (
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 8, lineHeight: 1.6 }}>
            {body}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <VBtn size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </VBtn>
          <VBtn
            size="sm"
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            style={danger ? undefined : { background: JELLY_TOKENS.gradPrimary }}
          >
            {confirmLabel}
          </VBtn>
        </div>
      </div>
    </div>,
    document.body,
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
  /** Cinema micro-label above the title, e.g. "REEL 02 — VOICE". */
  eyebrow?: string;
}

export function SectionHeader({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  creditCost,
  eyebrow,
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
            border: `1px solid ${JELLY_TOKENS.brandOutline}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={20} color={JELLY_TOKENS.brandLight} />
        </div>
        <div>
          {eyebrow && <MicroLabel tone="cyan" style={{ marginBottom: 4 }}>{eyebrow}</MicroLabel>}
          <div style={{ fontSize: 17, fontWeight: 600, color: t.text, letterSpacing: '-0.01em' }}>{title}</div>
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

/* ─── Toast ───
 * Minimal transient notice, bottom-center. There was no toast primitive in
 * the v2 shell, so post-redirect feedback (Stripe card-on-file return) had
 * nowhere to land and the user saw a silent screen change.
 */

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  kind?: ToastKind;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. 0 disables. */
  duration?: number;
}

export function Toast({
  message,
  kind = 'info',
  onDismiss,
  duration = 6000,
}: ToastProps): React.ReactElement {
  const { t } = useTheme();

  React.useEffect(() => {
    if (!duration) return;
    const id = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(id);
  }, [duration, onDismiss]);

  const accent =
    kind === 'success'
      ? JELLY_TOKENS.success
      : kind === 'error'
        ? JELLY_TOKENS.error
        : JELLY_TOKENS.brand;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="toast"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'min(560px, calc(100vw - 32px))',
        padding: '12px 16px',
        borderRadius: JELLY_TOKENS.radius.lg,
        background: t.panel,
        color: t.text,
        border: `1px solid ${t.borderStrong}`,
        borderLeft: `3px solid ${accent}`,
        boxShadow: JELLY_TOKENS.shadow4,
        backdropFilter: t.glassBlur,
        fontSize: 14,
        fontFamily: JELLY_TOKENS.font,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          display: 'flex',
          color: t.textSecondary,
        }}
      >
        <Icon name="close" size={16} color={t.textSecondary} />
      </button>
    </div>
  );
}
