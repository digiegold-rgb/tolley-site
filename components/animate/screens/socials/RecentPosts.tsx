'use client';

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, VBtn } from '../../primitives';
import { SectionTitle, EmptyState, ErrorBar } from '../live/AutopilotScreen';
import { PLATFORM_META } from '../live/ConnectionsPanel';

interface SocialPost {
  id: string;
  caption?: string | null;
  status: string;
  platforms: Array<{ platform: string; status?: string; publishedUrl?: string }>;
  publishedAt?: string | null;
  createdAt: string;
}

export function RecentPosts(): React.ReactElement {
  const { t } = useTheme();
  const [posts, setPosts] = React.useState<SocialPost[]>([]);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/vater/social-posts?limit=30', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { posts?: SocialPost[] };
      setPosts(data.posts ?? []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'posts failed');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <VCard style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle icon="history" title="Recent posts" sub="From GET /api/vater/social-posts." />
        <VBtn variant="text" size="sm" onClick={() => void load()}>Refresh</VBtn>
      </div>
      {err && <ErrorBar message={err} />}
      {posts.length === 0 ? (
        <EmptyState message="No posts yet." />
      ) : (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {posts.map((p) => (
            <div
              key={p.id}
              style={{
                padding: 10,
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
              }}
            >
              <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
                {p.caption || '(no caption)'}
              </div>
              <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4 }}>
                {p.status}
                {' · '}
                {new Date(p.publishedAt ?? p.createdAt).toLocaleString()}
                {' · '}
                {(p.platforms ?? []).map((pl) => {
                  const meta =
                    (PLATFORM_META as Record<string, { label: string; emoji: string }>)[pl.platform] ??
                    { label: pl.platform, emoji: '•' };
                  return `${meta.emoji} ${meta.label}`;
                }).join(' · ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </VCard>
  );
}
