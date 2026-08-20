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
import {
  IN_FLIGHT_STATUSES,
  CONCIERGE_STATUSES,
} from '@/lib/vater/youtube-status';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

// The canonical in-flight set from youtube-status.ts, NOT a hand-copied
// list. The old copy here ('voicing', 'animating', 'composing') drifted from
// the real pipeline statuses ('generating_audio', 'aligning_captions',
// 'composing_video') — so an actively-rendering project showed a "Nothing
// rendering right now" queue. Beta finding, 2026-08-19.
const ACTIVE_STATUSES = new Set<string>([
  ...IN_FLIGHT_STATUSES,
  // Fable 5 Concierge tickets — owned by the operator, still "active" from
  // the customer's chair.
  ...CONCIERGE_STATUSES,
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
      const active = all.filter((p: AnyProject) => ACTIVE_STATUSES.has(p.status));
      setProjects(active);
      // The DB only advances when something polls the DGX bridge. If the user
      // parks on this tab (instead of the editor, which polls for itself),
      // kick /poll for a few in-flight rows so the queue actually moves.
      // Concierge rows are excluded — /poll must never run for them.
      active
        .filter(
          (p: AnyProject) =>
            IN_FLIGHT_STATUSES.has(p.status) && p.autopilotJobId,
        )
        .slice(0, 4)
        .forEach((p: AnyProject) => {
          void fetch(`/api/vater/youtube/${p.id}/poll`).catch(() => undefined);
        });
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
          <div style={{ color: t.textSecondary, fontSize: 14 }}>Nothing rendering right now. Hit “+ Create Video” and this screen will track it beat by beat.</div>
        </VCard>
      ) : (
        <div className="jelly-legacy">
          <YouTubeImportTracker projects={projects} onCreated={() => { void refresh(); }} />
        </div>
      )}
    </div>
  );
}
