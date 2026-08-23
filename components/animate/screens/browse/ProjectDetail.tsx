'use client';

/* ProjectDetail — Phase 2 parallel build.
 *
 * Composed of 7 status-branched subviews per the inventory mapping
 * (Section 2.6 + Section 7). Wraps the existing
 * `YouTubeProjectDetail` component so the canonical status routing
 * (draft / fetching / transcribed / in-flight / ready / failed) and
 * its child components (YouTubeContextForm, YouTubeCreationProgress,
 * YouTubeFinalPlayer) carry their entire behavior over.
 *
 * Promotes the **Verification report fabrications panel** (NEEDS NEW TAB)
 * to a first-class section beside the YouTubeFinalPlayer, instead of
 * the collapsible buried at the bottom of the player. The user
 * explicitly asked for this elevation.
 *
 * Risks honored:
 *  - autopilotJobId rotation on re-compose: parent (`ProjectHistoryScreen`)
 *    is responsible for refreshing project state and uses `cache: "no-store"`
 *    when re-fetching. We surface `onRecomposeStart` so it can flip status
 *    optimistically.
 *  - scenesJson per-idx merge: not handled here — handled by the poll route
 *    on the server. We never mutate scenesJson client-side from this view.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, VCard } from '../../primitives';
import { RenderReceiptTicket } from './RenderReceiptTicket';
import { YouTubeProjectDetail } from '@/components/vater/youtube-project-detail';
import {
  IN_FLIGHT_STATUSES,
  type YouTubeProjectStatus,
} from '@/lib/vater/youtube-status';
import { ProjectLiveDetail } from '../live/ProjectLiveDetail';
import type { ReviewProject } from '../review/ScriptReviewScreen';
import { formatCount, type YouTubeVideoStats } from '@/lib/vater/youtube-status';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

interface Props {
  project: AnyProject;
  onUpdate: (project: AnyProject) => void;
  onRecomposeStart?: (id: string) => void;
}

interface VerificationReport {
  ok?: boolean;
  fabrications?: string[];
  summary?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coverage?: any[];
}

export function ProjectDetail({
  project,
  onUpdate,
  onRecomposeStart,
}: Props): React.ReactElement {
  const { t } = useTheme();
  const { setRoute, setEditorStep, setSelectedProjectId } = useRoute();

  const [busy, setBusy] = React.useState<'remix' | 'cut' | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [cutJobId, setCutJobId] = React.useState<string | null>(null);
  // null = not tried / unavailable; the button disables itself with a tooltip
  // rather than pretending a feature exists.
  const [cutUnavailable, setCutUnavailable] = React.useState(false);
  const [stats, setStats] = React.useState<YouTubeVideoStats | null>(null);

  const projectId: string | null =
    typeof project?.id === 'string' ? project.id : null;

  /* Which projects get the new panel: anything the render pipeline has touched.
     Drafts and transcribe-mode intake still need the legacy form, which owns
     the context/goal inputs the new panel deliberately does not duplicate. */
  const status = typeof project?.status === 'string' ? project.status : '';
  const inFlightOrDone =
    IN_FLIGHT_STATUSES.has(status as YouTubeProjectStatus) ||
    ['ready', 'published', 'failed', 'awaiting_script_approval'].includes(status);
  const youtubeVideoId: string | null =
    typeof project?.youtubeVideoId === 'string' ? project.youtubeVideoId : null;

  /* Public counters for a published video. Informational: a missing YouTube
     connection or a fresh upload with no data yet just leaves this blank. */
  React.useEffect(() => {
    if (!youtubeVideoId) {
      setStats(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/vater/youtube/stats?ids=${encodeURIComponent(youtubeVideoId)}`,
          { cache: 'no-store' },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          stats?: Record<string, YouTubeVideoStats>;
        };
        if (cancelled) return;
        setStats(data.stats?.[youtubeVideoId] ?? null);
      } catch {
        /* leave blank — never break the detail view over a counter */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [youtubeVideoId]);

  const remix = React.useCallback(async () => {
    if (!projectId) return;
    setBusy('remix');
    setActionError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/remix`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !data.id) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      // Straight into the new draft at the Script step — the setup came
      // along, the words are what still need writing.
      setSelectedProjectId(data.id);
      setEditorStep(1);
      setRoute('editor');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not remix this project',
      );
    } finally {
      setBusy(null);
    }
  }, [projectId, setRoute, setEditorStep, setSelectedProjectId]);

  const makeVerticalCut = React.useCallback(async () => {
    if (!projectId) return;
    setBusy('cut');
    setActionError(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/aspect-cut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aspect: '9:16' }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        jobId?: string | null;
        error?: string;
        unavailable?: boolean;
      };
      if (res.status === 501 || data.unavailable) {
        setCutUnavailable(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCutJobId(data.jobId ?? 'queued');
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not start the vertical cut',
      );
    } finally {
      setBusy(null);
    }
  }, [projectId]);

  const verification = project?.verificationReport as VerificationReport | null;
  const fabs = Array.isArray(verification?.fabrications)
    ? (verification?.fabrications as string[])
    : [];
  const showFabPanel = project?.status === 'ready' && (fabs.length > 0 || verification?.ok === false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showFabPanel && (
        <VCard
          style={{
            borderColor: JELLY_TOKENS.warning,
            borderLeft: `3px solid ${JELLY_TOKENS.warning}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 20 }}>⚠</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
              Verification report — fabrications detected
            </span>
          </div>
          {verification?.summary && (
            <div style={{ fontSize: 13, color: t.textSecondary, marginBottom: 8 }}>
              {verification.summary}
            </div>
          )}
          {fabs.length > 0 && (
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 13,
                color: t.text,
                lineHeight: 1.6,
              }}
            >
              {fabs.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
          {fabs.length === 0 && verification?.ok === false && (
            <div style={{ fontSize: 13, color: t.text }}>
              The verifier flagged this script. Review the script before publishing.
            </div>
          )}
        </VCard>
      )}

      {/* Make-another / re-cut actions + the public counters, sitting above
          the canonical detail view so they're the first thing you see on a
          finished video. */}
      {projectId && (
        <VCard style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <span title="Opens a new draft with this project's style, voice, soundtrack and settings">
              <VBtn
                size="sm"
                variant="outlined"
                icon="sparkle"
                onClick={() => void remix()}
                disabled={busy !== null}
              >
                {busy === 'remix' ? 'Remixing…' : 'Remix this project'}
              </VBtn>
            </span>
            <span
              title={
                cutUnavailable
                  ? 'Vertical cuts are coming online — the render box does not serve them yet'
                  : project?.status !== 'ready' || !project?.finalVideoUrl
                    ? 'Finish the render first — the cut re-frames the finished video'
                    : 'Re-frames this video as 9:16, reusing the narration and captions'
              }
            >
              <VBtn
                size="sm"
                variant="outlined"
                onClick={() => void makeVerticalCut()}
                disabled={
                  busy !== null ||
                  cutUnavailable ||
                  project?.status !== 'ready' ||
                  !project?.finalVideoUrl
                }
              >
                {busy === 'cut' ? 'Starting…' : 'Make a 9:16 cut'}
              </VBtn>
            </span>
            {cutJobId && (
              <span style={{ fontSize: 12, color: JELLY_TOKENS.success }}>
                Vertical cut queued — it lands in the Library when it finishes.
              </span>
            )}
            {cutUnavailable && (
              <span style={{ fontSize: 12, color: t.textSecondary }}>
                Vertical cuts are coming online.
              </span>
            )}
          </div>

          {youtubeVideoId && (
            <div
              style={{
                display: 'flex',
                gap: 20,
                flexWrap: 'wrap',
                fontSize: 13,
                color: t.textSecondary,
                borderTop: `1px solid ${t.border}`,
                paddingTop: 12,
              }}
            >
              <span>
                Views:{' '}
                <strong style={{ color: t.text }}>
                  {formatCount(stats?.views)}
                </strong>
              </span>
              <span>
                Likes:{' '}
                <strong style={{ color: t.text }}>
                  {formatCount(stats?.likes)}
                </strong>
              </span>
              <span>
                Comments:{' '}
                <strong style={{ color: t.text }}>
                  {formatCount(stats?.comments)}
                </strong>
              </span>
              <a
                href={`https://youtu.be/${youtubeVideoId}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: JELLY_TOKENS.brand, textDecoration: 'none' }}
              >
                Watch on YouTube →
              </a>
            </div>
          )}

          {actionError && (
            <div style={{ fontSize: 13, color: JELLY_TOKENS.error }}>
              {actionError}
            </div>
          )}
        </VCard>
      )}

      {/* The stub for this render, beside the legacy detail. Same numbers the
          editor shows when the MP4 lands — the receipt endpoint is the single
          source, so the two surfaces cannot disagree. */}
      {projectId && project?.status === 'ready' && project?.finalVideoUrl && (
        <RenderReceiptTicket
          projectId={projectId}
          title={project?.publishTitle ?? project?.sourceTitle ?? null}
          duration={
            typeof project?.audioDuration === 'number' ? project.audioDuration : null
          }
          style={{ maxWidth: 460 }}
        />
      )}

      {/* ONE detail panel (2026-08-23). This used to render the legacy
          YouTubeProjectDetail, whose in-flight branch is the old green step
          bars — a second, worse view of exactly what Script Review already
          showed, and the one you hit by clicking a video in your own history.
          ProjectLiveDetail is now the single view: phase ladder, the step
          running now, the rolling worker log, and the publish panel when the
          render is done.

          The legacy component is still used by other (non-/animate) surfaces,
          so it stays on disk; it is simply no longer reachable from here. */}
      {inFlightOrDone ? (
        <ProjectLiveDetail project={project as ReviewProject} onChanged={() => onUpdate(project)} />
      ) : (
        <div className="jelly-legacy">
          <YouTubeProjectDetail
            project={project}
            onUpdate={onUpdate}
            onRecomposeStart={onRecomposeStart}
          />
        </div>
      )}
    </div>
  );
}
