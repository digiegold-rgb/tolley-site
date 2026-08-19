'use client';

/* HowItWorksStrip — the four-beat explainer that replaces the old
 * "Follow the steps below…" paragraph at the top of the editor:
 *
 *   Source → Script → Engine → Deliver
 *
 * Each chip carries a StepHint so a first-time customer can find out what
 * happens next without leaving the page. Pure presentation; no fetches.
 */

import * as React from 'react';
import { JELLY_TOKENS, glass } from '../tokens';
import { useTheme } from '../theme-context';
import { StepHint } from './StepHint';

export interface HowItWorksBeat {
  label: string;
  hint: React.ReactNode;
}

export const HOW_IT_WORKS_BEATS: readonly HowItWorksBeat[] = [
  {
    label: 'Source',
    hint: 'Start from a title and a goal, a YouTube link, or a script you already wrote. A style sets the look, the characters and the voice.',
  },
  {
    label: 'Script',
    hint: 'Jelly writes the script in your voice (or uses yours verbatim). You read it and approve it before anything is rendered — nothing is charged until then.',
  },
  {
    label: 'Engine',
    hint: 'Jelly Auto renders now, usually 10–30 minutes. Fable 5 Concierge is hand-directed by Fable 5 in the studio and comes back in a few hours — same price, billed only when it lands.',
  },
  {
    label: 'Deliver',
    hint: 'The finished MP4 lands in your Library with an itemised receipt. Edit scenes, swap voices, add motion, or publish straight to your channels.',
  },
] as const;

export interface HowItWorksStripProps {
  /** Highlight one beat (0-based). */
  active?: number | null;
  style?: React.CSSProperties;
}

export function HowItWorksStrip({ active = null, style }: HowItWorksStripProps): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      aria-label="How it works"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 6,
        padding: '6px 10px',
        ...glass(t),
        borderRadius: JELLY_TOKENS.radius.pill,
        fontFamily: JELLY_TOKENS.font,
        fontSize: 12.5,
        color: t.textSecondary,
        ...style,
      }}
    >
      {HOW_IT_WORKS_BEATS.map((b, i) => {
        const on = active === i;
        return (
          <React.Fragment key={b.label}>
            {i > 0 && (
              <span aria-hidden="true" style={{ color: t.textFaint, fontSize: 12 }}>
                →
              </span>
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: JELLY_TOKENS.radius.pill,
                background: on ? JELLY_TOKENS.gradChipOn : 'transparent',
                border: `1px solid ${on ? JELLY_TOKENS.brandOutline : 'transparent'}`,
                color: on ? t.text : t.textSecondary,
                fontWeight: on ? 600 : 500,
                whiteSpace: 'nowrap',
              }}
            >
              {b.label}
              <StepHint text={b.hint} label={`About ${b.label}`} />
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
}
