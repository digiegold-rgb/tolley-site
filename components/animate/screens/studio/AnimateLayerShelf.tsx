'use client';

/* Library shelf: one row per finished cut, quote the opening motion layer
 * from the same planner the API uses, then open the priced confirm modal. */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { GlassCard, MicroLabel } from '../../cinema';
import { VBtn } from '../../primitives';
import { AnimateLayerModal } from './AnimateLayerModal';
import {
  ANIMATE_LAYER_DEFAULT_QUALITY,
  formatAnimateLayerCoverage,
  planAnimateLayer,
  quoteAnimateLayer,
} from '@/lib/vater/animate-layer';
import { formatPrice } from '@/lib/vater/pricing';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

function titleOf(p: AnyProject): string {
  return p.publishTitle || p.sourceTitle || p.topic || p.id;
}

export function AnimateLayerShelf({
  projects,
  onStarted,
}: {
  projects: AnyProject[];
  onStarted?: (id: string) => void;
}): React.ReactElement {
  const { t } = useTheme();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const openProject = projects.find((p) => p.id === openId) ?? null;

  return (
    <GlassCard style={{ marginTop: 24 }} padding={16} data-testid="animate-layer-shelf">
      <MicroLabel tone="violet" size={10.5} tracking="0.22em" style={{ marginBottom: 6 }}>
        Motion layer
      </MicroLabel>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
        Give a finished cut an opening motion pass
      </div>
      <div
        style={{
          fontSize: 12,
          color: t.textSecondary,
          margin: '4px 0 12px',
          lineHeight: 1.6,
        }}
      >
        Wan image-to-video on the scenes that begin in the first 30 seconds.
        Priced per clip before anything starts. Whole scenes — not a sliced
        30-second file.
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {projects.map((p) => {
          const plan = planAnimateLayer(p.scenesJson, {
            audioDuration: p.audioDuration,
          });
          const quote = quoteAnimateLayer(plan, ANIMATE_LAYER_DEFAULT_QUALITY);
          const empty = quote.sceneIdxs.length === 0;
          return (
            <div
              key={p.id}
              data-testid={`animate-layer-row-${p.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: 10,
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
              }}
            >
              <div
                style={{
                  flex: '1 1 220px',
                  minWidth: 0,
                  fontSize: 13,
                  color: t.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {titleOf(p)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: t.textSecondary,
                  whiteSpace: 'nowrap',
                }}
              >
                {empty
                  ? plan.skippedAnimatedIdxs.length
                    ? 'Opening already in motion'
                    : 'No opening scenes'
                  : `${formatAnimateLayerCoverage(plan)} · ${formatPrice(quote.estimateCents)}`}
              </div>
              <VBtn
                size="sm"
                variant={empty ? 'ghost' : 'outlined'}
                onClick={() => setOpenId(p.id)}
                data-testid={`animate-layer-open-${p.id}`}
              >
                {empty ? 'Review layer' : 'Animate opening'}
              </VBtn>
            </div>
          );
        })}
      </div>

      {openProject && (
        <AnimateLayerModal
          projectId={openProject.id}
          projectTitle={titleOf(openProject)}
          open
          onClose={() => setOpenId(null)}
          onStarted={() => onStarted?.(openProject.id)}
        />
      )}
    </GlassCard>
  );
}
