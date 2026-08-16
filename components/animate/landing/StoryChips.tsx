'use client';

/**
 * StoryChips — Act I of the cinema landing. Eight single-select chips; the
 * selection drives the <TitleCard/> beneath them.
 *
 * WHY THE PRICES ARE PROPS: chip 0 is a real finished render and carries its
 * reconciled all-in cost (lib/vater/demo-videos.ts). Chips 1–7 are hypothetical
 * pictures, and their figures are computed on the SERVER by
 * localEstimate({ minutes, opsRatePerMinute: getOpsRate() }) — stills only —
 * so the ops rate never has to be guessed at in the browser and the estimate a
 * visitor reads here is the same math the API quotes. This component invents
 * no number; it only picks which one to show.
 */

import * as React from 'react';

import { JELLY_TOKENS } from '../tokens';
import { TitleCard } from '../cinema';

export interface StoryChip {
  /** Chip face, e.g. "My money story". */
  label: string;
  /** Title-card line for this story. */
  line: string;
  /** All-in dollars: reconciled for the real demo, estimated for the rest. */
  priceUsd: number;
  /** True only for the chip backed by a finished render on this page. */
  real?: boolean;
}

const t = JELLY_TOKENS.dark;

export function StoryChips({ chips }: { chips: readonly StoryChip[] }): React.ReactElement {
  const [sel, setSel] = React.useState(0);
  const active = chips[sel] ?? chips[0];
  if (!active) return <></>;

  const price = (
    <span style={{ color: JELLY_TOKENS.cyan, fontWeight: 600 }}>
      ${active.priceUsd.toFixed(2)}
    </span>
  );

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Pick a story"
        data-testid="story-chips"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          maxWidth: 860,
          margin: '0 auto 36px',
        }}
      >
        {chips.map((c, i) => {
          const on = i === sel;
          return (
            <button
              key={c.label}
              type="button"
              role="radio"
              aria-checked={on}
              className="jc-chip"
              onClick={() => setSel(i)}
              style={{
                background: on ? JELLY_TOKENS.gradChipOn : t.card,
                border: `1px solid ${on ? 'rgba(143,125,255,0.7)' : 'rgba(240,238,248,0.14)'}`,
                color: on ? t.text : t.textSecondary,
                padding: '12px 22px',
                borderRadius: JELLY_TOKENS.radius.pill,
                fontSize: 14.5,
                fontFamily: JELLY_TOKENS.font,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backdropFilter: t.glassBlur,
                WebkitBackdropFilter: t.glassBlur,
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <TitleCard
        quote={active.line}
        meta={
          active.real ? (
            <>
              narrated in your cloned voice · a generated scene for every line ·
              this one cost {price} all in · a real render
            </>
          ) : (
            <>
              narrated in your cloned voice · a generated scene for every line ·
              typically ≈ {price} all in (estimate, stills)
            </>
          )
        }
      />
    </>
  );
}

export default StoryChips;
