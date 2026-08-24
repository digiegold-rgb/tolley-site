'use client';

/* Queue tab — queued → in progress → done.
 *
 * Groups the live YouTubeProject list into the three customer stages
 * defined in lib/vater/youtube-status.ts (customerStage). Concierge
 * tickets use the same grouping: concierge_queued is queued,
 * concierge_in_progress is in progress, delivered is ready / done.
 *
 * The import tracker stays underneath so a pasted YouTube URL still
 * lines up here. /poll is kicked for in-flight DGX rows only.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, VCard, SectionHeader } from '../../primitives';
import { GlassCard, MicroLabel } from '../../cinema';
import { YouTubeImportTracker } from '@/components/vater/youtube-import-tracker';
import {
  IN_FLIGHT_STATUSES,
  CONCIERGE_STATUSES,
  customerStage,
  type CustomerStage,
  type YouTubeProjectStatus,
} from '@/lib/vater/youtube-status';
import { CustomerStageChip } from './CustomerStageChip';
import { CustomerStageRail } from './CustomerStageRail';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

const ACTIVE_STATUSES = new Set<string>([
  ...IN_FLIGHT_STATUSES,
  ...CONCIERGE_STATUSES,
]);

const RECENT_DONE_MAX = 6;

function titleOf(p: AnyProject): string {
  return p?.publishTitle || p?.sourceTitle || p?.topic || p?.sourceUrl || p?.id || 'Untitled';
}

export function Queue(): React.ReactElement {
  const { t } = useTheme();
  const { openProjectInEditor, requestNewVideo } = useRoute();
  const [projects, setProjects] = React.useState<AnyProject[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const r = await fetch('/api/vater/youtube', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      const all = Array.isArray(data?.projects) ? data.projects : [];
      setProjects(all);
      all
        .filter(
          (p: AnyProject) =>
            IN_FLIGHT_STATUSES.has(p.status as YouTubeProjectStatus) &&
            p.autopilotJobId,
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

  const queued = React.useMemo(
    () => projects.filter((p) => customerStage(p.status) === 'queued'),
    [projects],
  );
  const inProgress = React.useMemo(
    () =>
      projects.filter(
        (p) =>
          customerStage(p.status) === 'in_progress' ||
          p.status === 'concierge_needs_info',
      ),
    [projects],
  );
  const done = React.useMemo(() => {
    const ready = projects.filter((p) => customerStage(p.status) === 'done');
    ready.sort(
      (a: AnyProject, b: AnyProject) =>
        new Date(b.completedAt ?? b.updatedAt ?? b.createdAt ?? 0).getTime() -
        new Date(a.completedAt ?? a.updatedAt ?? a.createdAt ?? 0).getTime(),
    );
    return ready.slice(0, RECENT_DONE_MAX);
  }, [projects]);
  const doneCount = React.useMemo(
    () => projects.filter((p) => customerStage(p.status) === 'done').length,
    [projects],
  );
  const trackerProjects = React.useMemo(
    () => projects.filter((p) => ACTIVE_STATUSES.has(p.status)),
    [projects],
  );

  const empty = !loading && queued.length === 0 && inProgress.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="history"
        title="Active Queue"
        description="Queued → in progress → done. This list updates every 5 seconds."
      />

      <CustomerStageRail
        counts={{
          queued: queued.length,
          in_progress: inProgress.length,
          done: doneCount,
        }}
        current={
          inProgress.length > 0
            ? 'in_progress'
            : queued.length > 0
              ? 'queued'
              : doneCount > 0
                ? 'done'
                : null
        }
        caption="Waiting in line, being made, then ready to play in Library."
      />

      {loading ? (
        <VCard variant="flat">
          <div style={{ color: t.textSecondary, fontSize: 14 }}>Loading queue…</div>
        </VCard>
      ) : empty ? (
        <VCard variant="flat">
          <div style={{ color: t.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
            Nothing queued or in progress. Create a video and you&apos;ll watch it
            move queued → in progress → done on this screen.
          </div>
          <div style={{ marginTop: 12 }}>
            <VBtn size="sm" variant="primary" onClick={requestNewVideo}>
              Create a video
            </VBtn>
          </div>
        </VCard>
      ) : null}

      {!loading && (
        <>
          <QueueSection
            stage="queued"
            eyebrow="Waiting in line"
            empty="Nothing waiting — the next video you start lands here first."
            items={queued}
            onOpen={openProjectInEditor}
          />
          <QueueSection
            stage="in_progress"
            eyebrow="Being made"
            empty="Nothing in progress right now."
            items={inProgress}
            onOpen={openProjectInEditor}
          />
          <QueueSection
            stage="done"
            eyebrow="Recently done"
            empty="Nothing finished yet — done videos also live in Library."
            items={done}
            onOpen={openProjectInEditor}
          />
        </>
      )}

      <div className="jelly-legacy">
        <YouTubeImportTracker
          projects={trackerProjects}
          onCreated={() => {
            void refresh();
          }}
        />
      </div>
    </div>
  );
}

function QueueSection({
  stage,
  eyebrow,
  empty,
  items,
  onOpen,
}: {
  stage: CustomerStage;
  eyebrow: string;
  empty: string;
  items: AnyProject[];
  onOpen: (id: string) => void;
}): React.ReactElement {
  const { t } = useTheme();
  const tone = stage === 'done' ? 'violet' : stage === 'in_progress' ? 'cyan' : 'violet';

  return (
    <GlassCard data-testid={`queue-section-${stage}`} padding={16}>
      <MicroLabel tone={tone} size={10.5} tracking="0.22em" style={{ marginBottom: 10 }}>
        {eyebrow}
      </MicroLabel>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((p) => (
            <div
              key={p.id}
              data-testid={`queue-row-${p.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                padding: 10,
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
              }}
            >
              <CustomerStageChip status={p.status} />
              <span
                style={{
                  flex: '1 1 180px',
                  minWidth: 0,
                  fontSize: 13,
                  color: t.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {titleOf(p)}
              </span>
              {typeof p.progress === 'number' &&
                customerStage(p.status) === 'in_progress' && (
                  <span
                    style={{
                      fontSize: 12,
                      color: JELLY_TOKENS.cyan,
                      fontWeight: 600,
                      fontFamily: JELLY_TOKENS.fontMono,
                    }}
                  >
                    {p.progress}%
                  </span>
                )}
              <VBtn size="sm" variant="text" onClick={() => onOpen(p.id)}>
                Open project →
              </VBtn>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
