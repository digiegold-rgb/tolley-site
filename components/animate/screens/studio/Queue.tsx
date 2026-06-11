'use client';

/* Queue tab — in-flight pipeline jobs.
 *
 * Wraps YouTubeImportTracker filtered to active statuses: queued, transcribing,
 * extracting_principles, scripting, voicing, generating_scenes, animating,
 * composing.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VCard, SectionHeader } from '../../primitives';
import { YouTubeImportTracker } from '@/components/vater/youtube-import-tracker';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

const ACTIVE_STATUSES = new Set([
  'queued', 'transcribing', 'extracting_principles', 'scripting',
  'voicing', 'generating_scenes', 'animating', 'composing',
]);

export function Queue(): React.ReactElement {
  const { t } = useTheme();
  const [projects, setProjects] = React.useState<AnyProject[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch('/api/vater/youtube', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      const all = Array.isArray(data?.projects) ? data.projects : [];
      setProjects(all.filter((p: AnyProject) => ACTIVE_STATUSES.has(p.status)));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [refresh]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="history"
        title="⏳ Active Queue"
        description="In-flight pipeline jobs. Updates every 5 seconds."
      />
      {loading ? (
        <VCard variant="flat"><div style={{ color: t.textSecondary, fontSize: 14 }}>Loading queue…</div></VCard>
      ) : projects.length === 0 ? (
        <VCard variant="flat">
          <div style={{ color: t.textSecondary, fontSize: 14 }}>No active jobs. Start one from Topic, Transcribe, or RSS.</div>
        </VCard>
      ) : (
        <YouTubeImportTracker projects={projects} onCreated={() => { void refresh(); }} />
      )}
    </div>
  );
}
