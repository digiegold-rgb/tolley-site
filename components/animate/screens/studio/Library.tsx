'use client';

/* Library tab — wraps the existing YouTubeLibrary lightbox grid.
 *
 * Source: components/vater/youtube-library.tsx (399 lines).
 * Contract: feature-inventory.md §2.2.
 *
 * Self-loads the project list via GET /api/vater/youtube and filters to
 * status==='ready'. Owns optimistic delete + recompose-start handlers so
 * cards leave the grid immediately when the user acts on them.
 *
 * Inline styles only. The wrapped YouTubeLibrary keeps its own Tailwind
 * styling — that's intentional, we are NOT re-skinning it here.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { RetryError, VCard } from '../../primitives';
import { GlassCard, MicroLabel } from '../../cinema';
import { LatestUpdateStrip } from '../../LatestUpdate';
import { YouTubeLibrary } from '@/components/vater/youtube-library';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

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

  const unfinishedCount = React.useMemo(
    () =>
      projects.filter(
        (p) => p?.status && p.status !== 'ready' && p.status !== 'editing',
      ).length,
    [projects],
  );
  const ready = React.useMemo(
    // Show 'ready' AND 'editing' so a re-animate / re-compose in progress
    // never hides the project from Library (the underlying scenesJson + audio
    // are intact even when editedAt > completedAt). Without this filter
    // expansion, status=='editing' projects vanished after Re-Animate clicks
    // and looked deleted to users.
    () => projects.filter((p) => p?.status === 'ready' || p?.status === 'editing'),
    [projects],
  );

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

  return (
    <div>
      <LatestUpdateStrip />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13, color: t.textSecondary }}>
          {ready.length} finished {ready.length === 1 ? 'video' : 'videos'} —
          play, download, share, or delete. Unfinished projects live in{' '}
          <button
            type="button"
            onClick={() => setRoute('project-history')}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: JELLY_TOKENS.brand,
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Project History
          </button>
          {unfinishedCount > 0 ? ` (${unfinishedCount} in progress there)` : ''}.
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
      ) : ready.length === 0 && !error ? (
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
            Finished videos land here, ready to download or publish. Projects
            still rendering live on the Queue screen.
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
      ) : (
        <>
          <div className="jelly-legacy">
            <YouTubeLibrary
              projects={ready}
              onDelete={handleDelete}
              onRecomposeStart={handleRecomposeStart}
            />
          </div>
          <ThumbnailShelf projects={ready} />
          <SendToScheduler projects={ready} />
        </>
      )}
    </div>
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
