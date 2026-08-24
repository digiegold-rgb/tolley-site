'use client';

/* CustomerStageRail — the three-step journey, always visible.
 *
 *   Queued → In progress → Done
 *
 * Counts are optional. When a `current` stage is passed, that step is
 * marked current; otherwise every step with a count > 0 is live.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import {
  CUSTOMER_STAGE_LABELS,
  CUSTOMER_STAGE_ORDER,
  type CustomerStage,
} from '@/lib/vater/youtube-status';

export type CustomerStageCounts = Record<CustomerStage, number>;

export interface CustomerStageRailProps {
  counts?: Partial<CustomerStageCounts>;
  current?: CustomerStage | null;
  /** Caption under the rail. */
  caption?: string;
}

const STAGE_TINT: Record<CustomerStage, string> = {
  queued: JELLY_TOKENS.brand,
  in_progress: JELLY_TOKENS.cyan,
  done: JELLY_TOKENS.success,
};

export function CustomerStageRail({
  counts,
  current,
  caption,
}: CustomerStageRailProps): React.ReactElement {
  const { t } = useTheme();

  return (
    <div data-testid="customer-stage-rail">
      <div
        role="list"
        aria-label="Queued, in progress, done"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {CUSTOMER_STAGE_ORDER.map((stage, i) => {
          const n = counts?.[stage] ?? 0;
          const tint = STAGE_TINT[stage];
          const active = current ? current === stage : n > 0;
          return (
            <React.Fragment key={stage}>
              {i > 0 && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 1,
                    background: t.borderStrong,
                    flex: 'none',
                  }}
                />
              )}
              <span
                role="listitem"
                aria-current={current === stage ? 'step' : undefined}
                data-stage={stage}
                data-count={n}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 12px',
                  borderRadius: JELLY_TOKENS.radius.pill,
                  border: `1px solid ${active ? `${tint}99` : t.border}`,
                  background: active ? `${tint}18` : t.card,
                  color: active ? t.text : t.textSecondary,
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  fontFamily: JELLY_TOKENS.font,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: active ? tint : t.textFaint,
                    boxShadow: active ? `0 0 0 3px ${tint}22` : undefined,
                  }}
                />
                {CUSTOMER_STAGE_LABELS[stage]}
                {counts && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: active ? tint : t.textFaint,
                      fontFamily: JELLY_TOKENS.fontMono,
                    }}
                  >
                    {n}
                  </span>
                )}
              </span>
            </React.Fragment>
          );
        })}
      </div>
      {caption && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: t.textSecondary,
            lineHeight: 1.5,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
