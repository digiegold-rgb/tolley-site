'use client';

/* ShortsLibrary — chop long-forms into short segments, keep them all
 * (2026-08-20, Jared: "a shorts scenario… separate library under Library").
 *
 * Top: the cutter — pick any finished video, a start time and a length, and
 * the DGX ffmpeg's a 9:16 vertical segment (blurred pillarbox, fade-out) at
 * zero GPU cost. Every cut is appended to the project's settingsJson.shorts
 * list, so one 10-minute video can become a week of shorts.
 *
 * Below: every short across every project — preview, caption, download,
 * copy link. Posting goes through the Publishing flow (Zernio/YouTube),
 * which now always asks "post now or schedule?".
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, RetryError, SectionHeader } from '../../primitives';
import { GlassCard, MicroLabel } from '../../cinema';
import { PermanentStill } from '../../media/PermanentStill';
import { permanentStillUrl } from '@/lib/vater/permanent-still';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProject = any;

interface ShortEntry {
  url: string;
  startSeconds?: number;
  maxSeconds?: number;
  createdAt?: string;
  description?: string;
}

function shortsOf(p: AnyProject): ShortEntry[] {
  const bag = p?.settingsJson;
  const list: ShortEntry[] =
    bag && typeof bag === 'object' && Array.isArray(bag.shorts) ? bag.shorts : [];
  // Legacy: a project cut before the library existed has only the column.
  if (list.length === 0 && p?.shortVideoUrl) {
    return [{ url: p.shortVideoUrl, description: p.shortDescription ?? undefined }];
  }
  return list.filter((s) => typeof s?.url === 'string' && s.url);
}

function fmtClock(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ShortsLibrary(): React.ReactElement {
  const { t } = useTheme();
  const [projects, setProjects] = React.useState<AnyProject[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Cutter state
  const [sourceId, setSourceId] = React.useState('');
  const [startMin, setStartMin] = React.useState(0);
  const [startSec, setStartSec] = React.useState(0);
  const [length, setLength] = React.useState(30);
  const [cutting, setCutting] = React.useState(false);
  const [cutError, setCutError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
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
    void load();
  }, [load]);

  const ready = React.useMemo(
    () =>
      projects.filter(
        (p) => (p?.status === 'ready' || p?.status === 'editing') && p?.finalVideoUrl,
      ),
    [projects],
  );
  React.useEffect(() => {
    if (!sourceId && ready.length > 0) setSourceId(ready[0].id);
  }, [ready, sourceId]);

  const withShorts = React.useMemo(
    () =>
      projects
        .map((p) => ({ project: p, shorts: shortsOf(p) }))
        .filter((x) => x.shorts.length > 0),
    [projects],
  );
  const totalShorts = withShorts.reduce((n, x) => n + x.shorts.length, 0);

  const source = ready.find((p) => p.id === sourceId) ?? null;
  const sourceDuration: number | null =
    typeof source?.audioDuration === 'number' && source.audioDuration > 0
      ? source.audioDuration
      : null;
  const startTotal = startMin * 60 + startSec;
  const startPastEnd = sourceDuration != null && startTotal >= Math.max(0, sourceDuration - 5);

  const cut = async () => {
    if (!sourceId || cutting) return;
    setCutting(true);
    setCutError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/vater/youtube/${sourceId}/short`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxSeconds: length,
          ...(startTotal > 0 ? { startSeconds: startTotal } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setNotice(
        `Short cut ✓ — ${length}s starting at ${fmtClock(startTotal)}. It's in the shelf below.`,
      );
      await load();
    } catch (err) {
      setCutError(err instanceof Error ? err.message : 'Cut failed');
    } finally {
      setCutting(false);
    }
  };

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(() => setCopied((c) => (c === url ? null : c)), 2000);
    } catch {
      window.prompt('Copy this MP4 link:', url);
    }
  };

  const numInput = (
    value: number,
    onChange: (n: number) => void,
    max: number,
  ) => (
    <input
      type="number"
      min={0}
      max={max}
      value={value}
      onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
      style={{
        width: 64,
        padding: '8px 10px',
        borderRadius: JELLY_TOKENS.radius.md,
        border: `1px solid ${t.borderStrong}`,
        background: t.cardAlt,
        color: t.text,
        fontSize: 13,
        fontFamily: JELLY_TOKENS.fontMono,
        outline: 'none',
      }}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── The cutter ── */}
      <VCard style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <SectionHeader
          icon="videoEditor"
          title="Cut a short"
          description="Pick a finished video, a start point, and a length. We cut a vertical 9:16 segment with a blurred backdrop — free, no GPU."
        />
        {ready.length === 0 && !loading ? (
          <div style={{ fontSize: 13, color: t.textSecondary }}>
            No finished videos yet — shorts are cut from videos in your Library.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ fontSize: 12, color: t.textSecondary, display: 'grid', gap: 4, flex: '1 1 260px' }}>
                Source video
                <select
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    borderRadius: JELLY_TOKENS.radius.md,
                    border: `1px solid ${t.borderStrong}`,
                    background: t.cardAlt,
                    color: t.text,
                    fontSize: 13,
                    fontFamily: JELLY_TOKENS.font,
                  }}
                >
                  {ready.map((p) => (
                    <option key={p.id} value={p.id}>
                      {(p.publishTitle || p.sourceTitle || p.topic || p.id).slice(0, 70)}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12, color: t.textSecondary, display: 'grid', gap: 4 }}>
                Start at (min : sec{sourceDuration != null ? ` · video is ${fmtClock(sourceDuration)}` : ''})
                <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {numInput(startMin, setStartMin, 179)}
                  <span style={{ color: t.textFaint }}>:</span>
                  {numInput(startSec, setStartSec, 59)}
                </span>
              </label>
              <label style={{ fontSize: 12, color: t.textSecondary, display: 'grid', gap: 4 }}>
                Length
                <select
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  style={{
                    padding: '9px 12px',
                    borderRadius: JELLY_TOKENS.radius.md,
                    border: `1px solid ${t.borderStrong}`,
                    background: t.cardAlt,
                    color: t.text,
                    fontSize: 13,
                    fontFamily: JELLY_TOKENS.font,
                  }}
                >
                  {[15, 30, 45, 60].map((n) => (
                    <option key={n} value={n}>{n}s</option>
                  ))}
                </select>
              </label>
              <VBtn
                icon="videoEditor"
                onClick={() => void cut()}
                disabled={!sourceId || cutting || startPastEnd}
                data-testid="shorts-cut"
              >
                {cutting ? 'Cutting… (about a minute)' : 'Cut short'}
              </VBtn>
            </div>
            <div style={{ fontSize: 12, color: startPastEnd ? JELLY_TOKENS.error : t.textFaint }}>
              {startPastEnd
                ? 'That start time is past the end of the video.'
                : 'Cut as many segments as you like — each lands in the shelf below with its own link.'}
            </div>
          </>
        )}
        {cutError && <RetryError message={cutError} />}
        {notice && <div style={{ fontSize: 13, color: JELLY_TOKENS.success }}>{notice}</div>}
      </VCard>

      {error && (
        <RetryError message={`Could not load projects — ${error}`} onRetry={() => void load()} />
      )}
      {loading && (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: t.textSecondary }}>
          Loading your shorts…
        </div>
      )}

      {/* ── The shelf ── */}
      {!loading && totalShorts === 0 && !error && (
        <VCard variant="flat" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>No shorts yet</div>
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 6, lineHeight: 1.6 }}>
            Cut your first one above — a 10-minute video is a week of shorts.
          </div>
        </VCard>
      )}

      {withShorts.map(({ project: p, shorts }) => (
        <GlassCard key={p.id} padding={16}>
          <MicroLabel tone="cyan" size={10.5} tracking="0.22em" style={{ marginBottom: 6 }}>
            {shorts.length} short{shorts.length === 1 ? '' : 's'}
          </MicroLabel>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 12 }}>
            {p.publishTitle || p.sourceTitle || p.topic || p.id}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {shorts.map((s, i) => (
              <div
                key={`${s.url}-${i}`}
                style={{
                  border: `1px solid ${t.border}`,
                  borderRadius: JELLY_TOKENS.radius.md,
                  overflow: 'hidden',
                  background: t.cardAlt,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16', background: '#000' }}>
                  <PermanentStill
                    src={permanentStillUrl('youtube', p.id)}
                    alt=""
                    style={{ position: 'absolute', inset: 0 }}
                  />
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={s.url}
                    controls
                    preload="none"
                    poster={permanentStillUrl('youtube', p.id)}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      background: 'transparent',
                      display: 'block',
                    }}
                  />
                </div>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11.5, color: t.textSecondary, fontFamily: JELLY_TOKENS.fontMono }}>
                    {typeof s.startSeconds === 'number' && s.startSeconds > 0
                      ? `from ${fmtClock(s.startSeconds)}`
                      : 'opening hook'}
                    {s.maxSeconds ? ` · ${s.maxSeconds}s` : ''}
                  </div>
                  {s.description && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: t.textSecondary,
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical' as const,
                        overflow: 'hidden',
                      }}
                    >
                      {s.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <a
                      href={s.url}
                      download
                      style={{
                        border: `1px solid ${t.border}`,
                        borderRadius: JELLY_TOKENS.radius.md,
                        padding: '4px 9px',
                        fontSize: 11,
                        color: t.textSecondary,
                        textDecoration: 'none',
                        fontFamily: JELLY_TOKENS.font,
                      }}
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => void copyLink(s.url)}
                      style={{
                        border: `1px solid ${t.border}`,
                        borderRadius: JELLY_TOKENS.radius.md,
                        padding: '4px 9px',
                        fontSize: 11,
                        color: t.textSecondary,
                        background: 'transparent',
                        cursor: 'pointer',
                        fontFamily: JELLY_TOKENS.font,
                      }}
                    >
                      {copied === s.url ? 'Copied ✓' : 'Copy link'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
