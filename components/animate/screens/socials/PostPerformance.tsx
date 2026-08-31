'use client';

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard } from '../../primitives';
import { SectionTitle, EmptyState } from '../live/AutopilotScreen';
import { PLATFORM_META } from '../live/ConnectionsPanel';

export interface PostPerfRow {
  postId: string;
  projectId: string;
  title: string | null;
  caption: string | null;
  status: string;
  platforms: unknown;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString();
}

export function PostPerformance({ posts }: { posts: PostPerfRow[] }): React.ReactElement {
  const { t } = useTheme();
  const sorted = [...posts].sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  return (
    <VCard style={{ marginBottom: 16 }}>
      <SectionTitle icon="history" title="Post performance" sub="Joined to the video title when we have one." />
      {sorted.length === 0 ? (
        <EmptyState message="No post snapshots yet. They land after the collector runs." />
      ) : (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {sorted.map((p) => {
            const plats = Array.isArray(p.platforms)
              ? (p.platforms as Array<{ platform?: string }>)
              : [];
            return (
              <div
                key={p.postId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  alignItems: 'center',
                  padding: 10,
                  background: t.cardAlt,
                  border: `1px solid ${t.border}`,
                  borderRadius: JELLY_TOKENS.radius.md,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: t.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.title || p.caption || '(untitled)'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {plats.map((pl, i) => {
                      const meta =
                        (PLATFORM_META as Record<string, { label: string; emoji: string }>)[pl.platform ?? ''] ??
                        { label: pl.platform ?? '•', emoji: '•' };
                      return (
                        <span key={i} style={{ fontSize: 11, color: t.textSecondary }}>
                          {meta.emoji} {meta.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: t.text }}>
                  <div>{fmt(p.views)} views</div>
                  <div style={{ color: t.textSecondary, fontSize: 11 }}>
                    {fmt(p.likes)} likes · {fmt(p.comments)} comments
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </VCard>
  );
}
