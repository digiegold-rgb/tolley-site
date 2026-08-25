'use client';

/* CustomerStageChip — one pill that maps a YouTubeProject.status onto the
 * three customer stages (queued → in progress → done).
 *
 * Stage grouping comes from customerStage() in youtube-status.ts. The
 * words on the chip come from CUSTOMER_STAGE_LABELS + STATUS_LABELS —
 * no parallel status dictionary.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import {
  CUSTOMER_STAGE_LABELS,
  STATUS_LABELS,
  customerStage,
  customerStageDetail,
  type CustomerStage,
  type CustomerStageInput,
  type YouTubeProjectStatus,
} from '@/lib/vater/youtube-status';

export interface CustomerStageChipProps {
  status: string | null | undefined;
  /** The row itself when in hand — lets an `editing` row be judged live vs
   *  stale (youtube-status.ts customerStage). */
  project?: CustomerStageInput | null;
  /** Hide the STATUS_LABELS phrase when the stage word is enough. */
  compact?: boolean;
  style?: React.CSSProperties;
}

const STAGE_TINT: Record<CustomerStage, string> = {
  queued: JELLY_TOKENS.brand,
  in_progress: JELLY_TOKENS.cyan,
  done: JELLY_TOKENS.success,
};

function chipTint(status: string | null | undefined, stage: CustomerStage | null): string {
  if (status === 'failed') return JELLY_TOKENS.error;
  if (status === 'concierge_needs_info') return JELLY_TOKENS.warning;
  if (stage) return STAGE_TINT[stage];
  return JELLY_TOKENS.dark.textFaint;
}

export function CustomerStageChip({
  status,
  project,
  compact = false,
  style,
}: CustomerStageChipProps): React.ReactElement {
  const { t } = useTheme();
  const input: CustomerStageInput | string | null | undefined = project
    ? { ...project, status: project.status ?? status }
    : status;
  const stage = customerStage(input);
  const tint = chipTint(status, stage);
  const stageWord = stage ? CUSTOMER_STAGE_LABELS[stage] : null;
  const detail = customerStageDetail(input);
  const pulsing = stage === 'queued' || stage === 'in_progress';

  // Prefer the stage word so the three steps stay unmistakable. When
  // STATUS_LABELS adds a more specific phrase (phase / Fable 5 copy),
  // keep it as a suffix unless compact or it just restates the stage.
  const restatesStage =
    !detail ||
    !stageWord ||
    detail.toLowerCase().replace(/\.+$/, '') === stageWord.toLowerCase() ||
    // Done = ready. STATUS_LABELS.ready is "Ready" — don't print both.
    (stage === 'done' && status === 'ready');
  const showDetail = !compact && !!detail && !restatesStage;

  const label = stageWord ?? detail ?? STATUS_LABELS[status as YouTubeProjectStatus] ?? status ?? '—';

  return (
    <span
      data-testid="customer-stage-chip"
      data-stage={stage ?? status ?? 'unknown'}
      data-status={status ?? ''}
      title={detail ?? label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: compact ? '2px 8px' : '3px 10px',
        borderRadius: JELLY_TOKENS.radius.pill,
        border: `1px solid ${tint}66`,
        background: `${tint}18`,
        color: tint,
        fontSize: compact ? 10 : 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        fontFamily: JELLY_TOKENS.font,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: tint,
          boxShadow: pulsing ? `0 0 0 3px ${tint}22` : undefined,
          animation: pulsing ? JELLY_TOKENS.motion.blink : undefined,
          flex: 'none',
        }}
      />
      <span>{label}</span>
      {showDetail && (
        <span
          style={{
            color: t.textSecondary,
            fontWeight: 500,
            letterSpacing: 0,
            textTransform: 'none',
            fontSize: compact ? 10 : 11,
          }}
        >
          {detail}
        </span>
      )}
    </span>
  );
}
