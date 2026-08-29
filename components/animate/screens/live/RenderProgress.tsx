'use client';

/* RenderProgress — the ONE live view of a render in flight.
 *
 * Lifted out of ScriptReviewScreen 2026-08-23. It was the good progress view
 * (phase ladder, the step running NOW, the step before it, a rolling tail of
 * worker lines) but it lived inside Script Review, so the only way to watch a
 * render was to stay on that screen — click away and there was no route back.
 * Meanwhile Project History rendered a SECOND, worse progress component
 * (components/vater/youtube-creation-progress.tsx) over the same data.
 *
 * One component, three homes now: the Dashboard in-flight strip, the Project
 * History detail panel, and Script Review itself.
 *
 * Data is `project.stepDetails`, refreshed by whatever poll the host screen
 * already runs; this fetches nothing of its own.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { CREATION_PHASES, queueLabel } from '@/lib/vater/youtube-status';
import type { ReviewProject } from '../review/ScriptReviewScreen';

/* ─── Live render progress ───────────────────────────────────────────────
 * Trey 2026-08-10: one line with a green dot gave no feel for what a render
 * was doing — a 111-scene job looked identical at scene 3 and scene 90. This
 * shows the phase ladder, the step running NOW, the step before it, and a
 * rolling tail of worker lines. Data is `stepDetails`, refreshed by the same
 * 5s poll that already drives the status pill; nothing new is fetched.
 */

/** Worker lines look like "21:18:48 scenes: scene 8/11 done". */
function parseLogLine(raw: string): {
  time: string | null;
  tag: string | null;
  text: string;
} {
  const m = /^(\d{2}:\d{2}:\d{2})\s+(?:([a-z0-9_-]+):\s*)?(.*)$/i.exec(raw.trim());
  if (!m) return { time: null, tag: null, text: raw.trim() };
  return { time: m[1], tag: m[2] ?? null, text: m[3] };
}

/** "48s" / "3m 07s" / "1h 12m" — compact enough for an inline stat. */
function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Ticking clock so elapsed advances between the 5s project polls. */
function useNowMs(active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active) return;
    const h = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(h);
  }, [active]);
  return now;
}

export function RenderProgress({
  project,
  hideLog = false,
}: {
  project: ReviewProject;
  /** The host renders `RenderTerminal` in place of the rolling tail
   *  (2026-08-28) — keep the ladder + timings, drop the second log box. */
  hideLog?: boolean;
}): React.ReactElement {
  const { t } = useTheme();
  const details = project.stepDetails ?? null;
  const logs = React.useMemo(
    () => (Array.isArray(details?.logs) ? details!.logs!.filter(Boolean) : []),
    [details],
  );

  // Newest last, so the current step is the tail.
  const current = logs.length ? logs[logs.length - 1] : null;
  const prior = logs.length > 1 ? logs[logs.length - 2] : null;

  // Keep the rolling log pinned to the newest line as it grows.
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  const phase = details?.phase ?? null;
  const pct = Math.max(0, Math.min(100, project.progress ?? 0));

  // Elapsed + per-stage durations. `startedAt` is stamped on the first poll of
  // the job and `phaseTimings` accumulates across polls, so both survive a
  // page reload — this is the row's own history, not a client-side timer.
  const nowMs = useNowMs(true);
  const startedMs = details?.startedAt ? Date.parse(details.startedAt) : NaN;
  const elapsed = Number.isFinite(startedMs) ? formatDuration(nowMs - startedMs) : null;
  const stageRows = React.useMemo(() => {
    const timings = details?.phaseTimings;
    if (!timings) return [];
    return Object.entries(timings)
      .map(([name, timing]) => {
        const from = Date.parse(timing.startedAt);
        const to = timing.endedAt ? Date.parse(timing.endedAt) : null;
        return {
          name,
          from,
          running: to === null,
          ms: (to ?? nowMs) - from,
        };
      })
      .filter((row) => Number.isFinite(row.from))
      .sort((a, b) => a.from - b.from);
  }, [details?.phaseTimings, nowMs]);

  // Where we are on the ladder. `status` is the authority; phase is a label.
  const ladder = CREATION_PHASES.filter((p) => !p.transcribeOnly);
  const activeIdx = ladder.findIndex((p) => p.status === project.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Progress bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: t.textSecondary,
          }}
        >
          <span style={{ fontWeight: 600, color: t.text }}>
            {/* A queued job is behind the per-tenant cap, not stalled — say
                so explicitly instead of rendering the raw DGX phase text. */}
            {queueLabel(phase) ??
              (phase ? phase.replace(/_/g, ' ') : 'working')}
          </span>
          <span data-testid="render-elapsed">
            {elapsed ? `${elapsed} elapsed · ` : ''}
            {pct}%
          </span>
        </div>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: t.cardAlt,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: JELLY_TOKENS.brand,
              transition: 'width 400ms ease',
            }}
          />
        </div>
      </div>

      {/* Phase ladder */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {ladder.map((p, i) => {
          const done = activeIdx >= 0 && i < activeIdx;
          const active = i === activeIdx;
          return (
            <span
              key={p.status}
              title={p.description}
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: JELLY_TOKENS.radius.pill,
                color: active ? JELLY_TOKENS.onGradient : done ? t.textSecondary : t.textDisabled,
                background: active
                  ? JELLY_TOKENS.brand
                  : done
                    ? t.cardAlt
                    : 'transparent',
                border: `1px solid ${active ? 'transparent' : t.border}`,
              }}
            >
              {p.label}
            </span>
          );
        })}
      </div>

      {/* Per-stage durations — how long each phase actually took, so a slow
          render can be blamed on the stage that ate the time. */}
      {stageRows.length > 0 && (
        <div
          data-testid="stage-timings"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
        >
          {stageRows.map((row) => (
            <span
              key={row.name}
              title={
                row.running
                  ? `${row.name.replace(/_/g, ' ')} — running for ${formatDuration(row.ms)}`
                  : `${row.name.replace(/_/g, ' ')} took ${formatDuration(row.ms)}`
              }
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: JELLY_TOKENS.radius.pill,
                border: `1px solid ${t.border}`,
                color: row.running ? t.text : t.textSecondary,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {row.name.replace(/_/g, ' ')}{' '}
              <span style={{ fontWeight: 700 }}>{formatDuration(row.ms)}</span>
              {row.running ? '…' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Now / previous */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <StepLine label="Now" raw={current} emphasis />
        <StepLine label="Before" raw={prior} />
      </div>

      {/* Rolling log */}
      {!hideLog && <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: t.textSecondary,
            marginBottom: 4,
          }}
        >
          Worker log
        </div>
        <div
          ref={scrollRef}
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            background: t.cardAlt,
            borderRadius: JELLY_TOKENS.radius.md,
            padding: 10,
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 11,
            lineHeight: 1.7,
            color: t.textSecondary,
          }}
        >
          {logs.length === 0 ? (
            <span style={{ opacity: 0.7 }}>
              No worker lines yet — the first one lands within a few seconds of
              the render starting.
            </span>
          ) : (
            logs.map((line, i) => {
              const { time, tag, text } = parseLogLine(line);
              return (
                <div key={`${i}-${line}`} style={{ display: 'flex', gap: 8 }}>
                  {time && (
                    <span style={{ opacity: 0.55, flexShrink: 0 }}>{time}</span>
                  )}
                  {tag && (
                    <span
                      style={{
                        color: JELLY_TOKENS.brand,
                        flexShrink: 0,
                        fontWeight: 600,
                      }}
                    >
                      {tag}
                    </span>
                  )}
                  <span style={{ color: t.text }}>{text}</span>
                </div>
              );
            })
          )}
        </div>
      </div>}
    </div>
  );
}

function StepLine({
  label,
  raw,
  emphasis = false,
}: {
  label: string;
  raw: string | null;
  emphasis?: boolean;
}): React.ReactElement {
  const { t } = useTheme();
  const { time, tag, text } = raw
    ? parseLogLine(raw)
    : { time: null, tag: null, text: '—' };
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: t.textDisabled,
          width: 46,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: emphasis ? 13 : 12,
          fontWeight: emphasis ? 600 : 400,
          color: emphasis ? t.text : t.textSecondary,
        }}
      >
        {tag && (
          <span style={{ color: JELLY_TOKENS.brand }}>{tag}: </span>
        )}
        {text}
      </span>
      {time && (
        <span style={{ fontSize: 10, color: t.textDisabled, marginLeft: 'auto' }}>
          {time}
        </span>
      )}
    </div>
  );
}

