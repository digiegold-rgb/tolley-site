'use client';

/* EnginePicker — "who renders this?" Two cards, one choice:
 *
 *   Jelly Auto            renders now on the Jelly pipeline (10–30 min)
 *   Fable 5 Concierge     directed end-to-end by Fable 5 (headless runner on the DGX; 1–3 h, beta)
 *
 * Same price either way — the card says so, because that is the first
 * question everyone asks. Pure controlled input: the parent owns `value`
 * and decides which route the next click hits. Radio semantics for a11y.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';
import { useTheme } from '../theme-context';
import { Icon } from '../Icon';
import { CONCIERGE_ENGINE_COPY, type ConciergeEngine } from '@/lib/vater/concierge-client';
import { StepHint } from './StepHint';

export type { ConciergeEngine };

export interface EnginePickerProps {
  value: ConciergeEngine;
  onChange: (engine: ConciergeEngine) => void;
  /** Quote for the Auto card — "typically $X.XX". null → "typically —", undefined → hidden.
   *  This is the EXPECTED cost (planner numbers when the DGX answers, fractional minutes
   *  otherwise). The concierge ticket shows a different, higher number — the whole-minute
   *  credit RESERVE (`quickEstimateUsd`). Both used to read "est. $X" with nothing telling
   *  them apart, which read as a pricing bug (Jared 2026-08-29: three tickets all quoted
   *  $2.70 while the engine card said $1.xx). Keep the two words distinct. */
  estimateUsd?: number | null;
  /** True while the quote is loading → "typically …". */
  estimateLoading?: boolean;
  disabled?: boolean;
  /** Disable one card with a reason (e.g. Auto with >1 script). */
  autoDisabledReason?: string | null;
  fable5DisabledReason?: string | null;
  /** Tighter padding for inline bars. */
  compact?: boolean;
  style?: React.CSSProperties;
}

const AUTO_HINT =
  'Fully automatic: Jelly plans the scenes, renders the stills, records the voice and composes the MP4 on its own. Best when you want it now.';
const FABLE5_HINT =
  'Fable 5 runs your ticket end-to-end on our studio box: reads your script, writes a scene plan in your style, kicks the render, reviews every contact sheet and repairs weak scenes, then delivers. A person can step in if it flags something. Typically 1–3 hours.';

export function EnginePicker({
  value,
  onChange,
  estimateUsd,
  estimateLoading,
  disabled,
  autoDisabledReason,
  fable5DisabledReason,
  compact,
  style,
}: EnginePickerProps): React.ReactElement {
  const { t } = useTheme();

  const est =
    estimateUsd === undefined
      ? null
      : estimateLoading
        ? 'typically …'
        : estimateUsd === null
          ? 'typically —'
          : `typically $${estimateUsd.toFixed(2)}`;

  const cards: Array<{
    key: ConciergeEngine;
    name: string;
    badge?: string;
    blurb: string;
    meta: string | null;
    icon: 'sparkle' | 'videoEditor';
    hint: string;
    disabledReason?: string | null;
  }> = [
    {
      key: 'auto',
      name: CONCIERGE_ENGINE_COPY.auto.name,
      blurb: CONCIERGE_ENGINE_COPY.auto.blurb,
      meta: est,
      icon: 'videoEditor',
      hint: AUTO_HINT,
      disabledReason: autoDisabledReason,
    },
    {
      key: 'fable5',
      name: CONCIERGE_ENGINE_COPY.fable5.name,
      badge: CONCIERGE_ENGINE_COPY.fable5.badge,
      blurb: CONCIERGE_ENGINE_COPY.fable5.blurb,
      meta: est ? `${est} · same as Auto` : null,
      icon: 'sparkle',
      hint: FABLE5_HINT,
      disabledReason: fable5DisabledReason,
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Render engine"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: compact ? 8 : 12,
        fontFamily: JELLY_TOKENS.font,
        ...style,
      }}
    >
      {cards.map((c) => {
        const on = value === c.key;
        const off = !!disabled || !!c.disabledReason;
        const isF5 = c.key === 'fable5';
        return (
          <div
            key={c.key}
            role="radio"
            aria-checked={on}
            aria-disabled={off || undefined}
            tabIndex={off ? -1 : 0}
            data-testid={`engine-${c.key}`}
            title={c.disabledReason ?? undefined}
            onClick={() => {
              if (!off) onChange(c.key);
            }}
            onKeyDown={(e) => {
              if (off) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(c.key);
              }
            }}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: compact ? 4 : 6,
              padding: compact ? '10px 12px' : '14px 16px',
              borderRadius: JELLY_TOKENS.radius.lg,
              border: `1px solid ${on ? (isF5 ? JELLY_TOKENS.brand : JELLY_TOKENS.cyan) : t.border}`,
              background: on
                ? isF5
                  ? JELLY_TOKENS.gradTicket
                  : JELLY_TOKENS.cyanGhost
                : t.card,
              boxShadow: on && isF5 ? t.halo : undefined,
              cursor: off ? 'not-allowed' : 'pointer',
              opacity: off ? 0.55 : 1,
              transition: 'border-color .15s ease, background .15s ease',
              outline: 'none',
              color: t.text,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: `2px solid ${on ? (isF5 ? JELLY_TOKENS.brand : JELLY_TOKENS.cyan) : t.borderStrong}`,
                  background: on ? (isF5 ? JELLY_TOKENS.brand : JELLY_TOKENS.cyan) : 'transparent',
                  boxShadow: on ? `inset 0 0 0 3px ${t.panel}` : undefined,
                  flex: '0 0 auto',
                }}
              />
              <Icon name={c.icon} size={16} color={isF5 ? JELLY_TOKENS.brand : JELLY_TOKENS.cyan} />
              <span style={{ fontSize: compact ? 13.5 : 14.5, fontWeight: 700 }}>
                <StepHint text={c.hint} label={`About ${c.name}`} clickThrough>
                  {c.name}
                </StepHint>
              </span>
              {c.badge && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    padding: '2px 7px',
                    borderRadius: JELLY_TOKENS.radius.pill,
                    background: JELLY_TOKENS.brandGhost,
                    border: `1px solid ${JELLY_TOKENS.brandOutline}`,
                    color: JELLY_TOKENS.brand,
                  }}
                >
                  {c.badge}
                </span>
              )}
            </div>
            <div style={{ fontSize: compact ? 12 : 12.5, lineHeight: 1.45, color: t.textSecondary }}>
              {c.blurb}
            </div>
            {(c.meta || c.disabledReason) && (
              <div
                style={{
                  fontSize: 11.5,
                  color: c.disabledReason ? JELLY_TOKENS.warning : on ? t.text : t.textFaint,
                  fontFamily: c.disabledReason ? JELLY_TOKENS.font : JELLY_TOKENS.fontMono,
                  marginTop: 2,
                }}
              >
                {c.disabledReason ?? c.meta}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
