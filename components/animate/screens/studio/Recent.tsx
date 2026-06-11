'use client';

/* Recent tab — recently-completed projects.
 *
 * Wraps YouTubeImportTracker filtered to status==='ready' (and 'failed' for
 * visibility). Most recent first.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, SectionHeader } from '../../primitives';
import { YouTubeImportTracker } from '@/components/vater/youtube-import-tracker';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

// Include 'editing' so a re-animate in progress doesn't hide the project from
// Recent. Editing means the final mp4 is stale relative to scene edits, but
// the assets + scenes are all still on disk.
const RECENT_STATUSES = new Set(['ready', 'failed', 'cancelled', 'editing']);

export function Recent(): React.ReactElement {
  const { t } = useTheme();
  const [projects, setProjects] = React.useState<AnyProject[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/youtube', { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        const all = Array.isArray(data?.projects) ? data.projects : [];
        const filtered = all.filter((p: AnyProject) => RECENT_STATUSES.has(p.status));
        filtered.sort((a: AnyProject, b: AnyProject) =>
          new Date(b.completedAt ?? b.updatedAt ?? 0).getTime() -
          new Date(a.completedAt ?? a.updatedAt ?? 0).getTime()
        );
        setProjects(filtered);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="history"
        title="⚡ Recent Videos"
        description="Recently completed projects with cross-platform publish indicators and view counts."
      />
      {loading ? (
        <VCard variant="flat"><div style={{ color: t.textSecondary, fontSize: 14 }}>Loading recent…</div></VCard>
      ) : projects.length === 0 ? (
        <VCard variant="flat">
          <div style={{ color: t.textSecondary, fontSize: 14 }}>No completed videos yet. Start your first project from Topic or Transcribe.</div>
        </VCard>
      ) : (
        <YouTubeImportTracker projects={projects} onCreated={() => { /* no-op */ }} />
      )}
    </div>
  );
}
