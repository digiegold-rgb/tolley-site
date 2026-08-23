'use client';

/* InFlightStrip — every render currently in flight, on the Dashboard.
 *
 * Trey 2026-08-23: "there's a really cool bar that goes across and shows you
 * the line of where that situation is with the video, however once you click
 * away from that video I have no way to see it again."
 *
 * That view (RenderProgress) only ever existed inside Script Review, so a
 * render you started became unobservable the moment you navigated anywhere
 * else — including to the Dashboard, which is where you land. This puts it on
 * the first screen you see: one collapsed row per in-flight project, expanding
 * to the full phase ladder + rolling worker log.
 *
 * Reuses the SAME poll shape as the rest of the studio (GET /api/vater/youtube,
 * 5s) rather than adding an endpoint, and the same stage vocabulary as Script
 * Review so a render is described identically wherever you look at it.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VCard, VBtn } from '../../primitives';
import { MicroLabel } from '../../cinema';
import {
  IN_FLIGHT_STATUSES,
  type YouTubeProjectStatus,
} from '@/lib/vater/youtube-status';
import { RenderProgress } from './RenderProgress';
import { stageOf, type ReviewProject } from '../review/ScriptReviewScreen';

const POLL_MS = 5000;

const STAGE_TINT: Record<string, string> = {
  preparing: JELLY_TOKENS.accent,
  awaiting_approval: JELLY_TOKENS.warning,
  rendering: JELLY_TOKENS.brand,
  ready_to_publish: JELLY_TOKENS.success,
  published: JELLY_TOKENS.success,
  failed: JELLY_TOKENS.error,
};

/** Last worker line, e.g. "scenes: scene 8/11 done" — the one-glance answer. */
function currentStep(p: ReviewProject): string | null {
  const logs = (p.stepDetails as { logs?: string[] } | null)?.logs;
  if (!Array.isArray(logs) || logs.length === 0) return null;
  const raw = String(logs[logs.length - 1] ?? '').trim();
  return raw.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z?\s*/, '').replace(/^\d{2}:\d{2}:\d{2}\s*/, '');
}

export function InFlightStrip(): React.ReactElement | null {
  const { t } = useTheme();
  const { openProjectInEditor } = useRoute();
  const [projects, setProjects] = React.useState<ReviewProject[] | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/vater/youtube', { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json();
        if (cancelled) return;
        setProjects(Array.isArray(data?.projects) ? data.projects : []);
      } catch {
        /* the strip is a readout — a failed poll just keeps the last frame */
      }
    };
    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const live = React.useMemo(
    () =>
      (projects ?? []).filter((p) =>
        IN_FLIGHT_STATUSES.has(p.status as YouTubeProjectStatus),
      ),
    [projects],
  );

  // Nothing rendering → no empty box on the dashboard.
  if (live.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <MicroLabel tone="cyan" style={{ marginBottom: 8 }}>
        {live.length === 1 ? 'Rendering now' : `Rendering now · ${live.length}`}
      </MicroLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {live.map((p) => {
          const stage = stageOf(p);
          const tint = STAGE_TINT[stage] ?? JELLY_TOKENS.brand;
          const step = currentStep(p);
          const open = openId === p.id;
          const title = p.publishTitle || p.sourceTitle || 'Untitled';

          return (
            <VCard
              key={p.id}
              variant="flat"
              data-testid={`inflight-${p.id}`}
              style={{ display: 'flex', flexDirection: 'column', gap: 8, borderColor: `${tint}55` }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: tint,
                    boxShadow: `0 0 0 3px ${tint}22`,
                    flex: 'none',
                  }}
                />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: t.text,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: '1 1 200px',
                  }}
                >
                  {title}
                </span>
                <span style={{ fontSize: 12, color: tint, fontWeight: 600 }}>
                  {p.progress}%
                </span>
              </div>

              {/* The bar Trey is describing — position of the render at a glance. */}
              <div
                style={{
                  height: 6,
                  borderRadius: JELLY_TOKENS.radius.pill,
                  background: t.cardAlt,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, p.progress))}%`,
                    height: '100%',
                    background: tint,
                    transition: 'width 600ms ease',
                  }}
                />
              </div>

              {step && (
                <div
                  style={{
                    fontSize: 12,
                    color: t.textSecondary,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step}
                </div>
              )}

              {open && <RenderProgress project={p} />}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <VBtn size="sm" variant="text" onClick={() => setOpenId(open ? null : p.id)}>
                  {open ? 'Hide detail' : 'Show full progress'}
                </VBtn>
                <VBtn size="sm" variant="text" onClick={() => openProjectInEditor(p.id)}>
                  Open project →
                </VBtn>
              </div>
            </VCard>
          );
        })}
      </div>
    </div>
  );
}
