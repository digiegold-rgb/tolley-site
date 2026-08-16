'use client';

/* <AdmitOneTicket/> — THE billing surface of Jelly Studio. Every receipt,
 * balance, estimate and blocked-wall is a box-office ticket: micro-label
 * header, blinking state, big tabular fare, dashed dividers, itemised rows,
 * fine-print footer.
 *
 *   • static  — an itemised receipt / balance (default)
 *   • live    — the meter: fare ticks +2¢ per tick up to the total, rows light
 *               up as the running total crosses their cumulative thresholds
 *               (▸ active cyan, ✓ done secondary, · pending dim), holds ~2 s,
 *               loops. State label flips to the `doneState` at the top.
 *
 * Reduced motion → renders the final state, no interval. Rows are whatever
 * the receipt actually contains — never invented. */

import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';
import { useTheme } from '../theme-context';
import { useReducedMotion } from '@/components/client/three/useReducedMotion';
import { MicroLabel } from './MicroLabel';

export interface TicketRow {
  key: string;
  label: string;
  usd: number;
  /** Optional right-hand override (e.g. "3.4 min × $0.35"). */
  detail?: string;
}

export interface TicketNote {
  label: string;
  value: string;
  tone?: 'default' | 'cyan' | 'faint' | 'error';
}

export interface AdmitOneTicketProps {
  label?: string;
  /** Top-right state text ("NOW FILMING"). Blinks in live mode. */
  state?: string;
  /** State text once the live meter has completed. */
  doneState?: string;
  totalUsd: number;
  /** Optional big-number prefix/suffix (defaults to `$`). */
  currency?: string;
  rows?: TicketRow[];
  notes?: TicketNote[];
  footer?: React.ReactNode;
  live?: boolean;
  /** ms per tick in live mode (default 70) and cents per tick (default 2). */
  tickMs?: number;
  centsPerTick?: number;
  size?: 'hero' | 'card' | 'chip';
  style?: React.CSSProperties;
  'data-testid'?: string;
  /** Slot rendered under the fare (e.g. a Buy credits button). */
  action?: React.ReactNode;
}

const money = (usd: number) => `$${usd.toFixed(2)}`;

export function AdmitOneTicket({
  label = 'ADMIT ONE',
  state,
  doneState,
  totalUsd,
  currency = '$',
  rows = [],
  notes = [],
  footer,
  live = false,
  tickMs = 70,
  centsPerTick = 2,
  size = 'card',
  style,
  action,
  'data-testid': testId,
}: AdmitOneTicketProps): React.ReactElement {
  const { t } = useTheme();
  const reduced = useReducedMotion();
  const totalCents = Math.max(0, Math.round(totalUsd * 100));
  const animate = live && !reduced && totalCents > 0;
  const [cents, setCents] = React.useState<number>(animate ? 0 : totalCents);

  React.useEffect(() => {
    if (!animate) {
      setCents(totalCents);
      return;
    }
    let hold = 0;
    setCents(0);
    const id = window.setInterval(() => {
      setCents((c) => {
        if (c >= totalCents) {
          if (hold < Math.round(2000 / tickMs)) {
            hold += 1;
            return c;
          }
          hold = 0;
          return 0;
        }
        return Math.min(totalCents, c + centsPerTick);
      });
    }, tickMs);
    return () => window.clearInterval(id);
  }, [animate, totalCents, tickMs, centsPerTick]);

  const done = cents >= totalCents;
  // cumulative thresholds
  let acc = 0;
  const shaped = rows.map((r) => {
    const start = acc;
    const end = acc + Math.round(r.usd * 100);
    acc = end;
    const fin = cents >= end;
    const act = cents > start && !fin;
    const shown = live ? (Math.min(cents, end) - Math.min(cents, start)) / 100 : r.usd;
    return { ...r, fin, act, shown };
  });

  const fareSize = size === 'hero' ? 64 : size === 'card' ? 44 : 20;
  const pad = size === 'hero' ? 30 : size === 'card' ? 22 : '8px 12px';
  const stateText = done && live && doneState ? doneState : state;

  return (
    <div
      data-testid={testId}
      style={{
        background: JELLY_TOKENS.gradTicket,
        border: `1px solid ${JELLY_TOKENS.brandOutline}`,
        borderRadius: size === 'chip' ? JELLY_TOKENS.radius.md : JELLY_TOKENS.radius.xxl,
        padding: pad,
        backdropFilter: t.glassBlur,
        WebkitBackdropFilter: t.glassBlur,
        boxShadow: size === 'chip' ? 'none' : '0 30px 70px rgba(0,0,0,0.45)',
        fontFamily: JELLY_TOKENS.font,
        color: t.text,
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: size === 'chip' ? 2 : 6 }}>
        <MicroLabel tone="violet" size={size === 'chip' ? 9.5 : 11} tracking="0.24em">{label}</MicroLabel>
        {stateText && (
          <div className={live && !done ? 'jc-blink' : undefined} style={{ fontSize: size === 'chip' ? 9.5 : 11, color: JELLY_TOKENS.cyan, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
            ● {stateText}
          </div>
        )}
      </div>
      <div className="jc-tabular" style={{ fontWeight: 700, fontSize: fareSize, letterSpacing: '-0.02em', color: t.text, lineHeight: 1.1 }}>
        {currency}{(cents / 100).toFixed(2)}
      </div>
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
      {(shaped.length > 0 || notes.length > 0) && size !== 'chip' && (
        <>
          <div style={{ borderTop: `1px dashed ${t.borderStrong}`, margin: '18px 0' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {shaped.map((r) => {
              const color = live ? (r.fin ? t.textSecondary : r.act ? JELLY_TOKENS.cyan : t.textDisabled) : t.textSecondary;
              const mark = live ? (r.fin ? '✓' : r.act ? '▸' : '·') : '✓';
              return (
                <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, color }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {mark} {r.label}{r.detail ? <span style={{ color: t.textFaint }}> · {r.detail}</span> : null}
                  </span>
                  <span className="jc-tabular" style={{ whiteSpace: 'nowrap' }}>{money(r.shown)}</span>
                </div>
              );
            })}
            {notes.map((n) => (
              <div key={n.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, color: n.tone === 'cyan' ? JELLY_TOKENS.cyan : n.tone === 'error' ? JELLY_TOKENS.error : n.tone === 'faint' ? t.textFaint : t.textSecondary }}>
                <span>{n.label}</span>
                <span className="jc-tabular" style={{ whiteSpace: 'nowrap' }}>{n.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {footer && size !== 'chip' && (
        <>
          <div style={{ borderTop: `1px dashed ${t.borderStrong}`, margin: '18px 0 12px' }} />
          <div style={{ fontSize: 11.5, color: t.textFaint, lineHeight: 1.5 }}>{footer}</div>
        </>
      )}
    </div>
  );
}
