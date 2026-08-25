'use client';

/* ConciergeHistory — the Fable 5 ticket's feedback lines, newest first.
 *
 * Every stage post, `fable5 log` note, kickoff, compose, sync re-point and
 * the delivery note land in `settingsJson.concierge.history[]` on the server
 * (lib/vater/concierge.ts writeConcierge). Until 2026-08-25 nothing rendered
 * those lines — the editor card only used the last entry's timestamp for
 * "updated 14 min ago" — so the customer never saw what the director did.
 * This is the Project History surface for them; Script Review shows none of
 * it (that screen is intake + the money gate only). URLs inside a note (the
 * DGX scene-audit report, preview links) render as links.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { GlassCard, MicroLabel } from '../../cinema';
import {
  CONCIERGE_STAGE_CHIPS,
  relativeTimeLabel,
  type ConciergeStage,
  type ConciergeTicketView,
} from '@/lib/vater/concierge-client';

const STAGE_LABEL: Record<ConciergeStage, string> = Object.fromEntries(
  CONCIERGE_STAGE_CHIPS.map((c) => [c.stage, c.label]),
) as Record<ConciergeStage, string>;
STAGE_LABEL.needs_info = 'Needs your input';
STAGE_LABEL.cancelled = 'Cancelled';

function stageColor(stage: ConciergeStage): string {
  switch (stage) {
    case 'delivered':
      return JELLY_TOKENS.success;
    case 'needs_info':
      return JELLY_TOKENS.warning;
    case 'cancelled':
      return JELLY_TOKENS.error;
    case 'directing':
    case 'rendering':
    case 'qa':
      return JELLY_TOKENS.cyan;
    default:
      return JELLY_TOKENS.brand;
  }
}

/** Who wrote the line, in customer words. */
function byLabel(by: string | null | undefined): string {
  if (!by) return '';
  if (by === 'runner' || by === 'claude' || by === 'fable5' || by === 'dgx') return 'Fable 5';
  if (by === 'hq' || by === 'operator') return 'Studio';
  if (by === 'customer') return 'You';
  return by;
}

export interface ConciergeHistoryProps {
  ticket: ConciergeTicketView;
  style?: React.CSSProperties;
}

const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;

/** Notes carry plain URLs (the DGX scene-audit report, the preview link) —
 *  make them clickable, everything else stays text. */
function linkify(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const url = m[1].replace(/[.,;:]+$/, '');
    const trail = m[1].slice(url.length);
    out.push(
      <a
        key={`${idx}-${url}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: JELLY_TOKENS.brand, textDecoration: 'underline', overflowWrap: 'anywhere' }}
      >
        {url}
      </a>,
    );
    if (trail) out.push(trail);
    last = idx + m[1].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function ConciergeHistory({ ticket, style }: ConciergeHistoryProps): React.ReactElement | null {
  const { t } = useTheme();
  // Re-render once a minute so the relative times keep moving.
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const i = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(i);
  }, []);

  const lines = Array.isArray(ticket.history) ? [...ticket.history].reverse() : [];
  if (lines.length === 0) return null;

  return (
    <GlassCard variant="panel" padding={16} data-testid="concierge-history" style={style}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <MicroLabel tone="cyan" size={10.5} tracking="0.22em">
          Director&apos;s feedback · {ticket.code}
        </MicroLabel>
      </div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.map((h, i) => {
          const color = stageColor(h.stage);
          const who = byLabel(h.by);
          return (
            <li
              key={`${h.at}-${i}`}
              data-testid="concierge-history-line"
              style={{
                display: 'grid',
                gridTemplateColumns: '10px 1fr',
                gap: 10,
                alignItems: 'start',
                padding: '8px 10px',
                borderRadius: JELLY_TOKENS.radius.md,
                background: i === 0 ? t.hover : 'transparent',
                border: `1px solid ${i === 0 ? t.border : 'transparent'}`,
              }}
            >
              <span
                aria-hidden="true"
                style={{ width: 8, height: 8, marginTop: 5, borderRadius: 4, background: color, boxShadow: `0 0 8px ${color}` }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', fontSize: 11.5, color: t.textSecondary }}>
                  <span style={{ color, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 10.5 }}>
                    {STAGE_LABEL[h.stage] ?? h.stage}
                  </span>
                  {who && <span>{who}</span>}
                  <span title={new Date(h.at).toLocaleString()}>{relativeTimeLabel(h.at)}</span>
                </div>
                {h.note && (
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: t.text,
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      fontFamily: h.note.length > 140 ? JELLY_TOKENS.fontMono : undefined,
                    }}
                  >
                    {linkify(h.note)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </GlassCard>
  );
}
