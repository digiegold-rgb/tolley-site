'use client';

/* Shared bits for the Create step panels — small on purpose. */

import * as React from 'react';
import { JELLY_TOKENS } from '../../../tokens';
import { useTheme } from '../../../theme-context';
import { GlassCard } from '../../../cinema';
import { VBtn } from '../../../primitives';
import { TINT_BG } from '../../tint';

export function StepCard({
  children,
  testId,
  variant = 'glass',
  style,
}: {
  children: React.ReactNode;
  testId?: string;
  variant?: 'glass' | 'ticket' | 'panel';
  style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <GlassCard variant={variant} padding={22} data-testid={testId} style={{ display: 'flex', flexDirection: 'column', gap: 14, ...style }}>
      {children}
    </GlassCard>
  );
}

export function Lede({ children }: { children: React.ReactNode }): React.ReactElement {
  const { t } = useTheme();
  return <div style={{ fontSize: 15, lineHeight: 1.6, color: t.textSecondary, maxWidth: 640 }}>{children}</div>;
}

export function FieldLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {children}
      </span>
      {right && <span style={{ fontSize: 12, color: t.text, fontWeight: 600 }}>{right}</span>}
    </div>
  );
}

export function ErrorNote({ children, testId }: { children: React.ReactNode; testId?: string }): React.ReactElement {
  return (
    <div
      data-testid={testId ?? 'create-error'}
      role="alert"
      style={{
        padding: '10px 14px',
        borderRadius: JELLY_TOKENS.radius.md,
        border: `1px solid ${JELLY_TOKENS.error}`,
        ...TINT_BG.error,
        color: JELLY_TOKENS.error,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

export function InfoNote({ children, testId, tone = 'cyan' }: { children: React.ReactNode; testId?: string; tone?: 'cyan' | 'brand' }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      data-testid={testId}
      style={{
        padding: '10px 14px',
        borderRadius: JELLY_TOKENS.radius.md,
        ...(tone === 'cyan' ? TINT_BG.cyan : { background: JELLY_TOKENS.brandGhost, border: `1px solid ${JELLY_TOKENS.brandOutline}` }),
        fontSize: 13,
        color: t.text,
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  );
}

/** Bottom row of a panel: primary action on the right, helpers on the left. */
export function StepActions({ children, left }: { children: React.ReactNode; left?: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{left}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

/** Read-only summary of a finished step with one way forward. */
export function DoneSummary({
  children,
  onContinue,
  continueLabel,
  testId,
}: {
  children: React.ReactNode;
  onContinue: () => void;
  continueLabel: string;
  testId?: string;
}): React.ReactElement {
  const { t } = useTheme();
  return (
    <StepCard testId={testId}>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: t.text }}>{children}</div>
      <StepActions>
        <VBtn onClick={onContinue} data-testid="step-continue">{continueLabel}</VBtn>
      </StepActions>
    </StepCard>
  );
}

/** Soft cyan "working" card used by the two async steps. */
export function PulseCard({
  title,
  line,
  children,
  testId,
}: {
  title: string;
  line?: React.ReactNode;
  children?: React.ReactNode;
  testId?: string;
}): React.ReactElement {
  const { t } = useTheme();
  return (
    <GlassCard variant="ticket" padding={22} data-testid={testId} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          aria-hidden="true"
          className="jelly-pulse"
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: JELLY_TOKENS.cyan,
            flexShrink: 0,
          }}
        />
        <div style={{ fontSize: 18, fontWeight: 600, color: t.text, letterSpacing: '-0.01em' }}>{title}</div>
      </div>
      {line && <div data-testid="pulse-line" style={{ fontSize: 13.5, color: t.textSecondary }}>{line}</div>}
      {children}
    </GlassCard>
  );
}

export const inputStyle = (t: ReturnType<typeof useTheme>['t'], extra: React.CSSProperties = {}): React.CSSProperties => ({
  width: '100%',
  padding: '10px 12px',
  borderRadius: JELLY_TOKENS.radius.md,
  border: `1px solid ${t.border}`,
  background: t.card,
  color: t.text,
  fontSize: 14,
  fontFamily: JELLY_TOKENS.font,
  outline: 'none',
  boxSizing: 'border-box',
  ...extra,
});

export function wordsIn(s: string | null | undefined): number {
  return (s ?? '').trim().split(/\s+/).filter(Boolean).length;
}
