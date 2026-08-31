'use client';

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, VBtn, ConfirmDialog } from '../../primitives';
import { SectionTitle, EmptyState, ErrorBar } from '../live/AutopilotScreen';
import { PLATFORM_META } from '../live/ConnectionsPanel';

interface QueuePost {
  id: string;
  caption?: string | null;
  status: string;
  scheduledFor?: string | null;
  platforms: Array<{ platform: string; status?: string }>;
}

export function UpcomingQueue({ onChanged }: { onChanged?: () => void }): React.ReactElement {
  const { t } = useTheme();
  const [posts, setPosts] = React.useState<QueuePost[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [askId, setAskId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/vater/socials/queue', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { posts?: QueuePost[] };
      setPosts(data.posts ?? []);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'queue failed');
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (id: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/vater/socials/queue/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAskId(null);
      await load();
      onChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'cancel failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <VCard style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionTitle icon="history" title="Upcoming" sub="Scheduled and publishing. Cancel asks first." />
        <VBtn variant="text" size="sm" onClick={() => void load()}>Refresh</VBtn>
      </div>
      {err && <ErrorBar message={err} />}
      {posts.length === 0 ? (
        <EmptyState message="Nothing scheduled. Use Schedule videos to drip a batch." />
      ) : (
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {posts.map((p) => (
            <div
              key={p.id}
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
                    color: t.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {p.caption || '(no caption)'}
                </div>
                <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 4 }}>
                  {p.scheduledFor ? new Date(p.scheduledFor).toLocaleString() : p.status}
                  {' · '}
                  {(p.platforms ?? []).map((pl) => {
                    const meta =
                      (PLATFORM_META as Record<string, { label: string; emoji: string }>)[pl.platform] ??
                      { label: pl.platform, emoji: '•' };
                    return `${meta.emoji} ${meta.label}`;
                  }).join(' · ')}
                </div>
              </div>
              <VBtn size="sm" variant="outlined" onClick={() => setAskId(p.id)} disabled={busy}>
                Cancel
              </VBtn>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!askId}
        title="Cancel this scheduled post?"
        body="It will not go out. Already-published copies on the platforms are not deleted."
        confirmLabel="Cancel post"
        danger
        onConfirm={() => askId && void cancel(askId)}
        onCancel={() => setAskId(null)}
      />
    </VCard>
  );
}
