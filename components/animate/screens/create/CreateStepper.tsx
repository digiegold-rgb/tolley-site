'use client';

/* CreateStepper — the 8-step rail of the Create flow (2026-08-28).
 *
 * PillStepper's visuals (primitives.tsx) turned vertical: glass track, one
 * pill per step, the viewed step wears the violet→cyan chip tint. Each row
 * carries a state that the machine, not the click, decides:
 *
 *   pending   not reached yet                       faint
 *   active    the customer is filling this in       chip tint
 *   pulsing   the machine is working here           cyan + jelly-pulse ring
 *   needs-you waiting on a free/paid decision        violet "Needs you" tag
 *   expired   the gate sat 7 days                   faint "Expired" tag
 *   failed    it died here                          red tag
 *   done      behind the machine                    check mark
 *
 * Rows at or before the derived step are clickable (Back through history);
 * rows ahead of the data are not — you cannot jump past what exists.
 */

import * as React from 'react';
import { JELLY_TOKENS, glass } from '../../tokens';
import { useTheme } from '../../theme-context';
import { CREATE_STEPS, type CreateStepDef, type DerivedCreateStep } from '@/lib/vater/create-steps';

export type StepVisualState =
  | 'pending'
  | 'active'
  | 'pulsing'
  | 'needs-you'
  | 'expired'
  | 'failed'
  | 'done';

export function stepVisualState(n: number, derived: DerivedCreateStep | null, maxStep: number): StepVisualState {
  if (!derived) return n < maxStep ? 'done' : n === maxStep ? 'active' : 'pending';
  if (n < derived.step) return 'done';
  if (n > derived.step) return 'pending';
  switch (derived.kind) {
    case 'async':
      return 'pulsing';
    case 'approval':
    case 'money':
      return 'needs-you';
    case 'expired':
      return 'expired';
    case 'failed':
      return 'failed';
    case 'terminal':
      return 'done';
    default:
      return 'active';
  }
}

const TAG: Partial<Record<StepVisualState, string>> = {
  'needs-you': 'Needs you',
  expired: 'Expired',
  failed: 'Failed',
  pulsing: 'Working…',
};

export interface CreateStepperProps {
  /** The step the panel shows. */
  current: number;
  derived: DerivedCreateStep | null;
  /** Highest step the customer may view (derived step, or 1–2 before a project). */
  maxStep: number;
  onSelect?: (step: number) => void;
  orientation?: 'vertical' | 'horizontal';
  /** Progress-tab rows: numbers only, no hints. */
  compact?: boolean;
  style?: React.CSSProperties;
}

export function CreateStepper({
  current,
  derived,
  maxStep,
  onSelect,
  orientation = 'vertical',
  compact = false,
  style,
}: CreateStepperProps): React.ReactElement {
  const { t } = useTheme();
  const vertical = orientation === 'vertical';

  return (
    <div
      role="list"
      aria-label="Create video steps"
      data-testid="create-stepper"
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        flexWrap: vertical ? 'nowrap' : 'wrap',
        gap: compact ? 4 : 6,
        padding: compact ? 4 : 6,
        ...glass(t),
        borderRadius: compact ? JELLY_TOKENS.radius.pill : JELLY_TOKENS.radius.xl,
        fontFamily: JELLY_TOKENS.font,
        ...style,
      }}
    >
      {CREATE_STEPS.map((def) => (
        <StepRow
          key={def.n}
          def={def}
          state={stepVisualState(def.n, derived, maxStep)}
          viewed={def.n === current}
          clickable={!!onSelect && def.n <= maxStep}
          compact={compact}
          vertical={vertical}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function StepRow({
  def,
  state,
  viewed,
  clickable,
  compact,
  vertical,
  onSelect,
}: {
  def: CreateStepDef;
  state: StepVisualState;
  viewed: boolean;
  clickable: boolean;
  compact: boolean;
  vertical: boolean;
  onSelect?: (step: number) => void;
}): React.ReactElement {
  const { t } = useTheme();
  const tint =
    state === 'pulsing'
      ? JELLY_TOKENS.cyan
      : state === 'needs-you'
        ? JELLY_TOKENS.brandLight
        : state === 'failed'
          ? JELLY_TOKENS.error
          : state === 'done'
            ? JELLY_TOKENS.success
            : state === 'expired'
              ? t.textFaint
              : viewed
                ? JELLY_TOKENS.brandLight
                : t.textFaint;
  const dim = state === 'pending' && !viewed;
  const go = (): void => {
    if (clickable) onSelect?.(def.n);
  };
  const tag = TAG[state];

  return (
    <div
      role="listitem"
      aria-current={viewed ? 'step' : undefined}
      aria-disabled={!clickable || undefined}
      data-testid={`create-step-${def.n}`}
      data-state={state}
      data-viewed={viewed ? '1' : undefined}
      tabIndex={clickable ? 0 : -1}
      title={compact ? `${def.n}. ${def.label}` : undefined}
      onClick={go}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          go();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 0 : 12,
        padding: compact ? 3 : vertical ? '9px 12px' : '8px 14px',
        borderRadius: JELLY_TOKENS.radius.pill,
        cursor: clickable ? 'pointer' : 'default',
        background: viewed ? JELLY_TOKENS.gradChipOn : 'transparent',
        border: `1px solid ${viewed ? 'rgba(143,125,255,0.7)' : 'transparent'}`,
        color: viewed ? t.text : t.textSecondary,
        opacity: dim ? 0.55 : 1,
        transition: 'all .2s ease',
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        className={state === 'pulsing' ? 'jelly-pulse' : undefined}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: compact ? 22 : 28,
          height: compact ? 22 : 28,
          borderRadius: '50%',
          flexShrink: 0,
          fontSize: compact ? 11 : 12.5,
          fontWeight: 700,
          fontFamily: JELLY_TOKENS.fontMono,
          color: state === 'done' ? '#0A0A14' : tint,
          background: state === 'done' ? JELLY_TOKENS.success : 'transparent',
          border: `1.5px solid ${tint}`,
          boxShadow: state === 'pulsing' ? `0 0 0 3px ${JELLY_TOKENS.cyanGhost}` : undefined,
        }}
      >
        {state === 'done' ? '✓' : def.n}
      </span>
      {!compact && (
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13.5,
              fontWeight: viewed || state === 'needs-you' || state === 'pulsing' ? 600 : 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{def.label}</span>
            {tag && (
              <span
                data-testid={`create-step-${def.n}-tag`}
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  padding: '2px 7px',
                  borderRadius: JELLY_TOKENS.radius.pill,
                  color: state === 'expired' ? t.textSecondary : '#0A0A14',
                  background: state === 'expired' ? t.hover : tint,
                  whiteSpace: 'nowrap',
                }}
              >
                {tag}
              </span>
            )}
          </span>
          {vertical && (
            <span style={{ fontSize: 11.5, color: t.textFaint, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {def.hint}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
