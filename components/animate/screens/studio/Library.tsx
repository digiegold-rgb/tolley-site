'use client';

/* Library tab — wraps the existing YouTubeLibrary lightbox grid.
 *
 * Source: components/vater/youtube-library.tsx.
 * Contract: feature-inventory.md §2.2.
 *
 * Self-loads GET /api/vater/youtube. The playable grid is still
 * ready/editing, but the page now shows the three customer stages
 * (queued → in progress → done) via CustomerStageRail + a live
 * pipeline strip. Owns optimistic delete + recompose-start handlers.
 *
 * Inline styles only. The wrapped YouTubeLibrary keeps its own Tailwind
 * styling — that's intentional, we are NOT re-skinning it here.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { RetryError, VBtn, VCard } from '../../primitives';
import { GlassCard, MicroLabel } from '../../cinema';
import { LatestUpdateStrip } from '../../LatestUpdate';
import { YouTubeLibrary } from '@/components/vater/youtube-library';
import {
  customerStage,
  IN_FLIGHT_STATUSES,
  type CustomerStage,
  type YouTubeProjectStatus,
} from '@/lib/vater/youtube-status';
import { isPostedToYoutube } from '@/lib/vater/youtube-posted';
import { CustomerStageChip } from './CustomerStageChip';
import { CustomerStageRail } from './CustomerStageRail';
import { AnimateLayerShelf } from './AnimateLayerShelf';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

function titleOf(p: AnyProject): string {
  return p?.publishTitle || p?.sourceTitle || p?.topic || p?.sourceUrl || p?.id || 'Untitled';
}

function bucketProjects(projects: AnyProject[]): Record<CustomerStage, AnyProject[]> {
  const queued: AnyProject[] = [];
  const in_progress: AnyProject[] = [];
  const done: AnyProject[] = [];
  for (const p of projects) {
    if (!p) continue;
    const stage = customerStage(p);
    if (stage === 'queued') queued.push(p);
    else if (stage === 'in_progress') in_progress.push(p);
    else if (stage === 'done') done.push(p);
    // customerStage() returns null for a project it cannot place — most often
    // `editing` that is neither live nor has a final video, which is exactly
    // what a batch-animate leaves behind when the browser never finalized it.
    // A null used to be dropped on the floor here, so the project appeared in
    // NO bucket and vanished from the studio entirely (video #51, 2026-08-27:
    // "#51 vanished and nobody got a ping"). Nothing a customer owns may be
    // invisible: an unplaceable project is shown as in-progress, which is the
    // honest reading — something was started and did not finish.
    else in_progress.push(p);
  }
  return { queued, in_progress, done };
}

export function Library(): React.ReactElement {
  const { t } = useTheme();
  const { requestNewVideo, setRoute } = useRoute();
  const [projects, setProjects] = React.useState<AnyProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchProjects = React.useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/vater/youtube');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const buckets = React.useMemo(() => bucketProjects(projects), [projects]);
  const needsInfo = React.useMemo(
    () => projects.filter((p) => p?.status === 'concierge_needs_info'),
    [projects],
  );
  const pipeline = React.useMemo(
    () => [...buckets.queued, ...buckets.in_progress, ...needsInfo],
    [buckets, needsInfo],
  );
  // Playable grid = the done bucket. A LIVE re-compose (`editing` with a
  // job and a recent write) sits in the Moving-now strip only; a stale
  // `editing` row with a final is Done and shows here — never both (#3/#6
  // used to render twice, 2026-08-25).
  const ready = buckets.done;
  /* Everything the customer owns, in-flight first. The shelves below stay on
     `ready` — you cannot add a thumbnail to, or schedule, a video that does
     not exist yet. */
  const gridProjects = React.useMemo(() => [...pipeline, ...ready], [pipeline, ready]);
  const livePipeline = pipeline.length > 0;

  React.useEffect(() => {
    if (!livePipeline) return;
    const i = setInterval(() => {
      void fetchProjects();
      buckets.in_progress
        .filter(
          (p) =>
            IN_FLIGHT_STATUSES.has(p.status as YouTubeProjectStatus) &&
            p.autopilotJobId,
        )
        .slice(0, 4)
        .forEach((p) => {
          void fetch(`/api/vater/youtube/${p.id}/poll`).catch(() => undefined);
        });
    }, 5000);
    return () => clearInterval(i);
  }, [livePipeline, fetchProjects, buckets.in_progress]);

  /* Delete failures surface as an inline banner (same RetryError pattern as
   * the load error above) — never a native alert(). */
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const handleDelete = React.useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/vater/youtube/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setDeleteError(`Delete failed: HTTP ${res.status}`);
        return;
      }
    } catch (err) {
      setDeleteError(`Delete failed: ${err instanceof Error ? err.message : 'network error'}`);
      return;
    }
    setDeleteError(null);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const handleRecomposeStart = React.useCallback((id: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'editing' } : p)),
    );
  }, []);

  const handlePostedChange = React.useCallback((id: string, project: AnyProject) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...project } : p)));
  }, []);

  return (
    <div>
      <LatestUpdateStrip />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
        }}
      >
        <div style={{ minWidth: 0, flex: '1 1 280px' }}>
          <CustomerStageRail
            counts={{
              queued: buckets.queued.length,
              in_progress: buckets.in_progress.length,
              done: buckets.done.length,
            }}
            caption="Every video moves queued → in progress → done. Finished ones play below — add an opening motion layer anytime."
          />
        </div>
        <button
          type="button"
          onClick={fetchProjects}
          style={{
            background: 'transparent',
            border: `1px solid ${t.border}`,
            borderRadius: JELLY_TOKENS.radius.md,
            padding: '6px 12px',
            fontSize: 12,
            color: t.textSecondary,
            cursor: 'pointer',
            fontFamily: JELLY_TOKENS.font,
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <RetryError
            message={`Could not load projects — ${error}`}
            onRetry={() => {
              setLoading(true);
              void fetchProjects();
            }}
          />
        </div>
      )}

      {deleteError && (
        <div style={{ marginBottom: 16 }}>
          <RetryError message={deleteError} />
        </div>
      )}

      {!loading && pipeline.length > 0 && (
        <LibraryPipeline
          items={pipeline}
          onOpenQueue={() => setRoute('progress')}
        />
      )}

      {loading ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            fontSize: 13,
            color: t.textSecondary,
          }}
        >
          Loading library…
        </div>
      ) : ready.length === 0 && pipeline.length === 0 && !error ? (
        <VCard
          variant="flat"
          style={{
            padding: 32,
            textAlign: 'center',
            border: `1px dashed ${t.borderStrong}`,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>
            Nothing here yet
          </div>
          <div
            style={{
              fontSize: 13,
              color: t.textSecondary,
              marginTop: 6,
              lineHeight: 1.6,
            }}
          >
            Finished videos land here when they hit done. Anything still queued
            or in progress shows on this page and on Queue.
          </div>
          <button
            type="button"
            onClick={requestNewVideo}
            style={{
              marginTop: 16,
              background: JELLY_TOKENS.gradPrimary,
              border: 'none',
              borderRadius: JELLY_TOKENS.radius.md,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              color: JELLY_TOKENS.onGradient,
              cursor: 'pointer',
              fontFamily: JELLY_TOKENS.font,
            }}
          >
            Create your first video
          </button>
        </VCard>
      ) : ready.length === 0 && pipeline.length === 0 ? null : (
        <>
          {/* The grid shows work IN FLIGHT as well as finished work. It used
              to render `ready` only, so a video being animated dropped out of
              the grid the moment it left `ready` and lived only in the
              Moving-now strip — which reads as "my video disappeared", because
              the place you look for your videos stopped listing it. Jared
              2026-08-27: "Library grid must show in-progress / queued jobs
              (Moving Now is not enough)." In-flight first: it is the thing
              you came back to check on. */}
          <div className="jelly-legacy">
            <YouTubeLibrary
              projects={gridProjects}
              onDelete={handleDelete}
              onRecomposeStart={handleRecomposeStart}
              onAnimateLayerStart={handleRecomposeStart}
              onPostedChange={handlePostedChange}
            />
          </div>
          <AnimateLayerShelf
            projects={ready}
            onStarted={handleRecomposeStart}
          />
          <ThumbnailShelf projects={ready} />
          <SendToScheduler projects={ready} />
        </>
      )}
    </div>
  );
}

function LibraryPipeline({
  items,
  onOpenQueue,
}: {
  items: AnyProject[];
  onOpenQueue: () => void;
}): React.ReactElement {
  const { t } = useTheme();
  const { openProjectInEditor } = useRoute();

  return (
    <GlassCard
      data-testid="library-pipeline"
      style={{ marginBottom: 20 }}
      padding={16}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}
      >
        <MicroLabel tone="cyan" size={10.5} tracking="0.22em">
          Moving now
        </MicroLabel>
        <VBtn size="sm" variant="text" onClick={onOpenQueue}>
          Open Queue →
        </VBtn>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((p) => (
          <div
            key={p.id}
            data-testid={`library-pipeline-${p.id}`}
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
            <CustomerStageChip status={p.status} project={p} />
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
            <VBtn
              size="sm"
              variant="text"
              onClick={() => openProjectInEditor(p.id)}
            >
              Open project →
            </VBtn>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/**
 * Thumbnail shelf (2026-08-20) — every generated thumbnail in one place, so
 * a YouTube upload never means hunting through projects for the artwork.
 * Only projects that actually have a thumbnail appear.
 */
function ThumbnailShelf({ projects }: { projects: AnyProject[] }): React.ReactElement | null {
  const { t } = useTheme();
  const [copied, setCopied] = React.useState<string | null>(null);
  const withThumbs = projects.filter((p) => !!p?.thumbnailUrl);

  const copyLink = React.useCallback(async (id: string) => {
    const url = `${window.location.origin}/api/vater/youtube/${id}/thumbnail`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      window.prompt('Copy this thumbnail link:', url);
    }
  }, []);

  if (withThumbs.length === 0) {
    return (
      <GlassCard style={{ marginTop: 24 }} padding={16}>
        <MicroLabel tone="violet" size={10.5} tracking="0.22em" style={{ marginBottom: 6 }}>
          Thumbnails
        </MicroLabel>
        <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.6 }}>
          No thumbnails yet — generate one in a project&apos;s Thumbnail step and it
          shows up here, ready for your YouTube upload.
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={{ marginTop: 24 }} padding={16}>
      <MicroLabel tone="violet" size={10.5} tracking="0.22em" style={{ marginBottom: 6 }}>
        Thumbnails
      </MicroLabel>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
        Every generated thumbnail, ready for YouTube
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
          marginTop: 12,
        }}
      >
        {withThumbs.map((p) => (
          <div
            key={p.id}
            style={{
              border: `1px solid ${t.border}`,
              borderRadius: JELLY_TOKENS.radius.md,
              overflow: 'hidden',
              background: t.cardAlt,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/vater/youtube/${p.id}/thumbnail`}
              alt={p.publishTitle || p.sourceTitle || 'thumbnail'}
              loading="lazy"
              style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ padding: 8 }}>
              <div
                style={{
                  fontSize: 12,
                  color: t.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 6,
                }}
              >
                {p.publishTitle || p.sourceTitle || p.topic || p.id}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <a
                  href={`/api/vater/youtube/${p.id}/thumbnail`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...linkBtn(t.border, t.textSecondary), textDecoration: 'none' }}
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => void copyLink(p.id)}
                  style={linkBtn(t.border, t.textSecondary)}
                >
                  {copied === p.id ? 'Copied ✓' : 'Copy link'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/**
 * Send to scheduler.
 *
 * YouTube is the only platform Jelly uploads to itself (per-user OAuth, see the
 * Publishing tab). For TikTok / IG / Facebook / Pinterest / X / LinkedIn the
 * honest answer is "take the MP4 to the scheduler you already use", so give
 * people the three things that makes possible — a direct link they can paste,
 * a download, and a way into YouTube Studio — instead of a Connect button that
 * would never work.
 */
function SendToScheduler({
  projects,
}: {
  projects: AnyProject[];
}): React.ReactElement {
  const { t } = useTheme();
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyLink = React.useCallback(async (id: string) => {
    const url = `${window.location.origin}/api/vater/youtube/${id}/video`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      // Clipboard is permission-gated in some browsers — show the URL so the
      // user can copy it by hand rather than failing silently.
      window.prompt('Copy this MP4 link:', url);
    }
  }, []);

  return (
    <GlassCard style={{ marginTop: 24 }} padding={16}>
      <MicroLabel tone="cyan" size={10.5} tracking="0.22em" style={{ marginBottom: 6 }}>
        Distribution
      </MicroLabel>
      <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
        Send to scheduler
      </div>
      <div
        style={{
          fontSize: 12,
          color: t.textSecondary,
          margin: '4px 0 12px',
          lineHeight: 1.6,
        }}
      >
        Jelly uploads to YouTube directly from the Publishing tab. For TikTok,
        Instagram, Facebook, Pinterest, X, and LinkedIn, take the MP4 to
        whichever scheduler you already use — Repurpose, Postiz, and Blotato all
        accept an MP4 plus a caption.
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {projects.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              padding: 10,
              background: t.cardAlt,
              border: `1px solid ${t.border}`,
              borderRadius: JELLY_TOKENS.radius.md,
            }}
          >
            <div
              style={{
                flex: '1 1 220px',
                minWidth: 0,
                fontSize: 13,
                color: t.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {p.publishTitle || p.sourceTitle || p.topic || p.id}
            </div>
            {isPostedToYoutube(p) && (
              <span
                title="Posted to YouTube"
                style={{
                  flexShrink: 0,
                  background: JELLY_TOKENS.success,
                  color: JELLY_TOKENS.onGradient,
                  borderRadius: JELLY_TOKENS.radius.xs,
                  padding: '3px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: JELLY_TOKENS.font,
                }}
              >
                Posted to YouTube
              </span>
            )}
            <button
              type="button"
              onClick={() => void copyLink(p.id)}
              style={linkBtn(t.border, t.textSecondary)}
            >
              {copied === p.id ? 'Copied ✓' : 'Copy MP4 link'}
            </button>
            <a
              href={`/api/vater/youtube/${p.id}/video?download=1`}
              download={`${p.sourceTitle ?? p.id}.mp4`}
              style={{ ...linkBtn(t.border, t.textSecondary), textDecoration: 'none' }}
            >
              Download
            </a>
            <a
              href={
                p.youtubeVideoId
                  ? `https://studio.youtube.com/video/${p.youtubeVideoId}/edit`
                  : 'https://studio.youtube.com/'
              }
              target="_blank"
              rel="noreferrer"
              style={{ ...linkBtn(t.border, t.textSecondary), textDecoration: 'none' }}
            >
              Open in YouTube Studio
            </a>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function linkBtn(border: string, color: string): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${border}`,
    borderRadius: JELLY_TOKENS.radius.md,
    padding: '5px 10px',
    fontSize: 11,
    color,
    cursor: 'pointer',
    fontFamily: JELLY_TOKENS.font,
    whiteSpace: 'nowrap',
  };
}
