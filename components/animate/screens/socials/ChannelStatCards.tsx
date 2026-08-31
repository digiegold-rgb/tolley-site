'use client';

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard } from '../../primitives';
import { SectionTitle } from '../live/AutopilotScreen';
import { PLATFORM_META } from '../live/ConnectionsPanel';

export type StatsWindow = 7 | 28 | 90;

export interface ChannelCard {
  platform: string;
  displayName?: string | null;
  username?: string | null;
  followers: number | null;
  views: number | null;
  likes?: number | null;
  deltas: { followers: number | null; views: number | null };
  pulledAt?: string | null;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
}

function Delta({ n }: { n: number | null }): React.ReactElement {
  if (n === null) return <span style={{ color: 'inherit' }}>—</span>;
  const color = n > 0 ? JELLY_TOKENS.success : n < 0 ? JELLY_TOKENS.error : undefined;
  const arrow = n > 0 ? '▲' : n < 0 ? '▼' : '—';
  return (
    <span style={{ color, fontWeight: 700 }}>
      {arrow} {Math.abs(n).toLocaleString()}
    </span>
  );
}

export function ChannelStatCards({
  channels,
  windowDays,
  onWindow,
}: {
  channels: ChannelCard[];
  windowDays: StatsWindow;
  onWindow: (w: StatsWindow) => void;
}): React.ReactElement {
  const { t } = useTheme();
  return (
    <VCard style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <SectionTitle icon="niche" title="Channels" sub={`${windowDays}-day window · deltas vs the prior window`} />
        <div style={{ display: 'inline-flex', gap: 4 }}>
          {([7, 28, 90] as StatsWindow[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => onWindow(w)}
              style={{
                padding: '6px 12px',
                borderRadius: JELLY_TOKENS.radius.pill,
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                background: windowDays === w ? JELLY_TOKENS.gradPrimary : 'transparent',
                color: windowDays === w ? JELLY_TOKENS.onGradient : t.textSecondary,
                fontFamily: JELLY_TOKENS.font,
              }}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>
      {channels.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 12 }}>
          No snapshots yet.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          {channels.map((c) => {
            const meta =
              (PLATFORM_META as Record<string, { label: string; emoji: string }>)[c.platform] ??
              { label: c.platform, emoji: '•' };
            return (
              <div
                key={c.platform}
                style={{
                  background: t.cardAlt,
                  border: `1px solid ${t.border}`,
                  borderRadius: JELLY_TOKENS.radius.md,
                  padding: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{meta.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{meta.label}</span>
                </div>
                <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 8 }}>
                  {c.username ? `@${c.username.replace(/^@/, '')}` : c.displayName ?? ''}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: t.text, fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(c.followers)}
                </div>
                <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>followers</div>
                <div style={{ fontSize: 12, marginTop: 8, color: t.textSecondary }}>
                  <Delta n={c.deltas.followers} /> this window
                </div>
                <div style={{ fontSize: 12, marginTop: 6, color: t.text }}>
                  {fmt(c.views)} views <span style={{ color: t.textSecondary }}>(<Delta n={c.deltas.views} />)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </VCard>
  );
}
