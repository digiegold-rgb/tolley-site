'use client';

/* RenderTerminal — the "last 4 terminal lines" box, back for every render.
 *
 * Jared 2026-08-28: "where did the terminal line last 4 lines log go? …
 * make that box back now and feed it all steps — I want to see those
 * terminal lines for every render, always, in Progress."
 *
 * Unlike RenderProgress (which reads `project.stepDetails.logs` and so only
 * moves while some client polls `[id]/poll`), this box fetches its own tail
 * from GET /api/vater/youtube/<id>/log — a read-only DGX job read that works
 * on every lane, including Fable 5 / concierge rows the site never polls.
 *
 *   compact  → last 4 lines (Progress rows)      default
 *   full     → last 8 lines (create-flow steps)
 *
 * Polls every 5s while `active`; once on mount otherwise (final lines);
 * pauses while the tab is hidden. Latest line is the brightest.
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme } from './theme-context';

export interface RenderTerminalProps {
  projectId: string;
  /** Keep polling every 5s. When false, fetch once for the final tail. */
  active: boolean;
  /** 4 lines (rows) instead of 8 (steps). */
  compact?: boolean;
  /** Lines already on the project row — shown until the first poll lands. */
  initialLines?: string[] | null;
  style?: React.CSSProperties;
}

interface LogPayload {
  jobId: string | null;
  status: string | null;
  phase: string | null;
  progress: number | null;
  updatedAt: string | null;
  lines: string[];
}

const POLL_MS = 5000;

/* ─── data ─────────────────────────────────────────────────────────────── */

function useRenderLog(projectId: string, active: boolean, initialLines?: string[] | null) {
  const [data, setData] = React.useState<LogPayload | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const inFlight = React.useRef(false);

  const fetchOnce = React.useCallback(async (): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/vater/youtube/${encodeURIComponent(projectId)}/log`, { cache: 'no-store' });
      if (!res.ok) return;
      const body = (await res.json()) as Partial<LogPayload>;
      setData({
        jobId: body.jobId ?? null,
        status: body.status ?? null,
        phase: body.phase ?? null,
        progress: typeof body.progress === 'number' ? body.progress : null,
        updatedAt: body.updatedAt ?? null,
        lines: Array.isArray(body.lines) ? body.lines.filter((l): l is string => typeof l === 'string' && !!l) : [],
      });
    } catch {
      /* transient — the next tick retries */
    } finally {
      inFlight.current = false;
      setLoaded(true);
    }
  }, [projectId]);

  // Reset when the row changes under us.
  React.useEffect(() => {
    setData(null);
    setLoaded(false);
  }, [projectId]);

  React.useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const tick = (): void => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchOnce();
    };

    // Once on mount either way — the final lines for a finished row, the first
    // tail for a live one. Then keep going only while active.
    tick();
    if (active) timer = window.setInterval(tick, POLL_MS);

    const onVisible = (): void => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // `active` flipping false re-runs this: one last fetch grabs the closing lines.
  }, [active, fetchOnce]);

  const lines = data ? data.lines : (initialLines ?? []).filter(Boolean);
  return { data, loaded, lines };
}

/* ─── line parsing ─────────────────────────────────────────────────────── */

/** Worker lines look like "21:18:48 scenes: scene 8/11 done". */
function parseLine(raw: string): { time: string | null; tag: string | null; text: string } {
  const m = /^(\d{2}:\d{2}:\d{2})\s+(?:([a-z0-9_-]+):\s*)?(.*)$/i.exec(raw.trim());
  if (!m) return { time: null, tag: null, text: raw.trim() };
  return { time: m[1], tag: m[2] ?? null, text: m[3] };
}

function phaseLabel(phase: string | null, status: string | null): string {
  if (phase) return phase.replace(/_/g, ' ');
  if (status === 'queued') return 'queued';
  if (status === 'done') return 'done';
  if (status === 'failed') return 'failed';
  return 'working';
}

/* ─── the box ──────────────────────────────────────────────────────────── */

// A terminal is dark in both themes — that is the point of the box.
const TERM_BG = '#08070F';
const TERM_BORDER = 'rgba(240,238,248,0.10)';
const TERM_HEAD = 'rgba(240,238,248,0.04)';
const TERM_TEXT = '#F0EEF8';
const TERM_DIM = '#6B6584';

export function RenderTerminal({ projectId, active, compact = true, initialLines, style }: RenderTerminalProps): React.ReactElement {
  const { data, loaded, lines } = useRenderLog(projectId, active, initialLines);
  const max = compact ? 4 : 8;
  const tail = lines.slice(-max);
  const lineH = compact ? 18 : 20;

  // Pin to the newest line as the tail grows.
  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  const newest = tail.length ? tail[tail.length - 1] : null;
  React.useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [newest, tail.length]);

  const phase = phaseLabel(data?.phase ?? null, data?.status ?? null);
  const pct = typeof data?.progress === 'number' ? Math.max(0, Math.min(100, Math.round(data.progress))) : null;
  const terminal = data?.status === 'done' || data?.status === 'failed';
  const live = active && !terminal;

  return (
    <div
      data-testid="render-terminal"
      data-active={live ? '1' : '0'}
      data-phase={data?.phase ?? ''}
      data-count={tail.length}
      data-job={data?.jobId ?? ''}
      style={{
        background: TERM_BG,
        border: `1px solid ${TERM_BORDER}`,
        borderRadius: JELLY_TOKENS.radius.md,
        overflow: 'hidden',
        fontFamily: JELLY_TOKENS.fontMono,
        fontSize: compact ? 11 : 12,
        color: TERM_TEXT,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: compact ? '4px 10px' : '6px 12px',
          background: TERM_HEAD,
          borderBottom: `1px solid ${TERM_BORDER}`,
          fontSize: compact ? 10.5 : 11,
          letterSpacing: '0.04em',
          color: TERM_DIM,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <span
          aria-hidden="true"
          className={live ? 'jelly-pulse' : undefined}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            flexShrink: 0,
            background: live ? JELLY_TOKENS.cyan : data?.status === 'failed' ? JELLY_TOKENS.error : terminal ? JELLY_TOKENS.success : TERM_DIM,
          }}
        />
        <span data-testid="render-terminal-phase" style={{ color: TERM_TEXT, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {phase}
          {pct !== null ? ` · ${pct}%` : ''}
        </span>
        <span style={{ marginLeft: 'auto', flexShrink: 0 }}>{live ? 'live' : terminal ? data?.status : loaded ? 'idle' : '…'}</span>
      </div>
      <div
        ref={bodyRef}
        style={{
          padding: compact ? '6px 10px' : '8px 12px',
          minHeight: lineH * (compact ? 2 : 3),
          maxHeight: lineH * max + 16,
          overflowY: 'auto',
          lineHeight: `${lineH}px`,
        }}
      >
        {tail.length === 0 ? (
          <div data-testid="render-terminal-empty" style={{ color: TERM_DIM, fontStyle: 'italic' }}>
            {live || !loaded ? 'Waiting for the first worker line…' : 'No worker log for this render'}
          </div>
        ) : (
          tail.map((line, i) => {
            const { time, tag, text } = parseLine(line);
            const isNewest = i === tail.length - 1;
            // Oldest → dimmest, newest → brightest.
            const opacity = isNewest ? 1 : 0.45 + (0.4 * i) / Math.max(1, tail.length - 1);
            return (
              <div
                key={`${i}-${line}`}
                data-testid="render-terminal-line"
                data-newest={isNewest ? '1' : undefined}
                style={{
                  display: 'flex',
                  gap: 8,
                  opacity,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span style={{ color: TERM_DIM, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{time ?? '--:--:--'}</span>
                {tag && <span style={{ color: JELLY_TOKENS.cyan, flexShrink: 0, fontWeight: 600 }}>{tag}</span>}
                <span style={{ color: TERM_TEXT, overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─── collapsed variant ────────────────────────────────────────────────── */

/** A small "Log" toggle that reveals the terminal — for rows not in flight. */
export function RenderTerminalToggle({
  projectId,
  active = false,
  compact = true,
  initialLines,
  label = 'Log',
}: RenderTerminalProps & { label?: string }): React.ReactElement {
  const { t } = useTheme();
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
      <button
        type="button"
        aria-expanded={open}
        data-testid="render-terminal-toggle"
        onClick={() => setOpen((v) => !v)}
        style={{
          alignSelf: 'flex-start',
          background: 'transparent',
          border: `1px solid ${t.border}`,
          borderRadius: JELLY_TOKENS.radius.pill,
          color: t.textSecondary,
          cursor: 'pointer',
          padding: '2px 9px',
          fontSize: 11,
          fontFamily: JELLY_TOKENS.fontMono,
          letterSpacing: '0.04em',
        }}
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && <RenderTerminal projectId={projectId} active={active} compact={compact} initialLines={initialLines} />}
    </div>
  );
}
