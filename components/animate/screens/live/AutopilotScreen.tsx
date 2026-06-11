'use client';

/* AutopilotScreen — LIVE.
 *
 * Phase 2 wiring for the Autopilot tab:
 *   - DGX VRAM + ComfyUI queues via the existing PipelineLiveStatus widget
 *     (wrapped, not reimplemented).
 *   - Intake source cards (folder watch / Google Drive / Telegram) — read-only
 *     status because there is no /api/vater/intake/sources endpoint yet, so
 *     these reflect the autopilot daemon presence (probed via pipeline-status)
 *     and the cron-driven RSS feed health pulled from /api/vater/rss.
 *   - Posting stagger config (slot defaults from /api/content/campaigns when
 *     present; falls back to a sane default).
 *   - LIVE pipeline log feed: prefers SSE via /api/vater/observer/stream when
 *     available (gated to admin sessions; falls back to 5s polling on
 *     /api/vater/pipeline-status if SSE 401s or the EventSource errors).
 *   - Wraps youtube-creation-progress.tsx for the per-job display when a
 *     project id is selected (none initially — a follow-up phase will hook
 *     this up to project-history selection).
 *
 * APIs called (verbatim):
 *   GET /api/vater/pipeline-status            (no-store, polled via wrapped PipelineLiveStatus)
 *   GET /api/vater/observer/stream?jobId=all  (SSE)
 *   GET /api/vater/observer/notes?jobId=all&limit=40  (backfill)
 *   GET /api/vater/rss                        (no-store)
 *   GET /api/content/campaigns                (no-store; expects x-sync-secret if upstream gated)
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { Icon, type IconName } from '../../Icon';
import { VCard, VBtn } from '../../primitives';
import { PipelineLiveStatus } from '@/components/vater/pipeline-live-status';
import { YouTubeCreationProgress } from '@/components/vater/youtube-creation-progress';

interface ObserverNote {
  id: string;
  text: string;
  jobId?: string | null;
  createdAt: string;
}

interface ObserverProposalEvent {
  id: string;
  actionType: string;
  reasoning?: string;
  status: string;
  createdAt: string;
  jobId?: string | null;
}

type LogItem =
  | { kind: 'note'; id: string; ts: string; text: string; jobId?: string | null }
  | { kind: 'proposal'; id: string; ts: string; actionType: string; status: string; jobId?: string | null; reasoning?: string };

interface IntakeSource {
  id: string;
  label: string;
  description: string;
  icon: IconName;
  status: 'configured' | 'pending' | 'unknown';
  detail: string;
}

const DEFAULT_STAGGER = [
  { platform: 'TikTok', slot: '08:00 CT' },
  { platform: 'Instagram', slot: '11:00 CT' },
  { platform: 'YouTube', slot: '14:00 CT' },
  { platform: 'Facebook', slot: '17:00 CT' },
  { platform: 'Pinterest', slot: '20:00 CT' },
];

export function AutopilotScreen(): React.ReactElement {
  const { t } = useTheme();
  const [logs, setLogs] = React.useState<LogItem[]>([]);
  const [logSource, setLogSource] = React.useState<'sse' | 'poll' | 'idle'>('idle');
  const [logErr, setLogErr] = React.useState<string | null>(null);
  const [intake, setIntake] = React.useState<IntakeSource[]>([]);
  const [intakeLoading, setIntakeLoading] = React.useState(true);
  const [intakeErr, setIntakeErr] = React.useState<string | null>(null);
  const [activeProject, setActiveProject] = React.useState<{
    id: string;
    status: string;
    progress: number;
    mode: string | null;
    errorMessage: string | null;
    updatedAt: string;
    stepDetails: unknown;
  } | null>(null);

  // ── intake sources backfill (RSS + reasonable static rows) ──
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/vater/rss', { cache: 'no-store' });
        if (!res.ok) throw new Error(`rss ${res.status}`);
        const data = (await res.json()) as { feeds?: Array<{ id: string; title?: string; url?: string; autoPipeline?: boolean; lastPolledAt?: string | null; lastError?: string | null }> };
        if (cancelled) return;
        const feeds = data.feeds ?? [];
        const auto = feeds.filter((f) => f.autoPipeline);
        const rows: IntakeSource[] = [
          {
            id: 'rss',
            label: 'RSS feeds',
            description: `${feeds.length} feed${feeds.length === 1 ? '' : 's'} · ${auto.length} on auto-pipeline`,
            icon: 'web',
            status: feeds.length > 0 ? 'configured' : 'pending',
            detail:
              auto.length > 0
                ? `Cron polls every 15min. Newest auto: ${auto[0].title ?? auto[0].url ?? '(unnamed)'}`
                : 'No auto-pipeline feeds. Add one in Studio › Feeds.',
          },
          {
            id: 'folder',
            label: 'Folder watch',
            description: 'NAS dropbox → Studio › Transcribe',
            icon: 'folder',
            status: 'unknown',
            detail: 'Source watcher not yet exposed via API. Configure on the DGX.',
          },
          {
            id: 'gdrive',
            label: 'Google Drive',
            description: 'Drive folder → autopilot intake',
            icon: 'archive',
            status: 'unknown',
            detail: 'Google Drive intake is a Q3 roadmap item.',
          },
          {
            id: 'telegram',
            label: 'Telegram',
            description: 'OpenClaw bot → autopilot',
            icon: 'mic',
            status: 'unknown',
            detail: 'Telegram intake currently flows via OpenClaw, not the Jelly UI.',
          },
        ];
        setIntake(rows);
        setIntakeErr(null);
      } catch (err) {
        if (cancelled) return;
        setIntakeErr(err instanceof Error ? err.message : 'unknown');
      } finally {
        if (!cancelled) setIntakeLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── live pipeline log feed (SSE preferred, polling fallback) ──
  React.useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let es: EventSource | null = null;

    const startPolling = () => {
      setLogSource('poll');
      const tick = async () => {
        try {
          const res = await fetch('/api/vater/pipeline-status', { cache: 'no-store' });
          if (!res.ok) throw new Error(`pipeline-status ${res.status}`);
          const data = (await res.json()) as {
            activeJobs?: Array<{ jobId: string; kind: string; phase: string; lastLog?: string | null; updatedAt?: string }>;
          };
          if (cancelled) return;
          const next: LogItem[] = (data.activeJobs ?? [])
            .filter((j) => Boolean(j.lastLog))
            .map((j) => ({
              kind: 'note',
              id: `${j.jobId}:${j.updatedAt ?? Date.now()}`,
              ts: j.updatedAt ?? new Date().toISOString(),
              text: `[${j.kind} · ${j.phase}] ${j.lastLog}`,
              jobId: j.jobId,
            }));
          setLogs((prev) => mergeLogs(prev, next));
          setLogErr(null);
        } catch (err) {
          if (cancelled) return;
          setLogErr(err instanceof Error ? err.message : 'unknown');
        }
      };
      void tick();
      pollTimer = setInterval(() => void tick(), 5000);
    };

    const tryBackfill = async () => {
      try {
        const res = await fetch('/api/vater/observer/notes?jobId=all&limit=40', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { notes?: ObserverNote[] };
        if (cancelled) return;
        const items: LogItem[] = (data.notes ?? []).map((n) => ({
          kind: 'note',
          id: n.id,
          ts: n.createdAt,
          text: n.text,
          jobId: n.jobId,
        }));
        setLogs((prev) => mergeLogs(prev, items));
      } catch {
        /* observer endpoints are admin-only; silent */
      }
    };

    const startSse = () => {
      try {
        es = new EventSource('/api/vater/observer/stream?jobId=all');
      } catch {
        startPolling();
        return;
      }
      let opened = false;
      es.addEventListener('open', () => {
        opened = true;
        setLogSource('sse');
        setLogErr(null);
      });
      es.addEventListener('hello', () => {
        opened = true;
        setLogSource('sse');
      });
      es.addEventListener('note', (ev: MessageEvent) => {
        try {
          const n = JSON.parse(ev.data) as ObserverNote;
          setLogs((prev) =>
            mergeLogs(prev, [{ kind: 'note', id: n.id, ts: n.createdAt, text: n.text, jobId: n.jobId }]),
          );
        } catch {
          /* ignore malformed event */
        }
      });
      es.addEventListener('proposal', (ev: MessageEvent) => {
        try {
          const p = JSON.parse(ev.data) as ObserverProposalEvent;
          setLogs((prev) =>
            mergeLogs(prev, [
              {
                kind: 'proposal',
                id: p.id,
                ts: p.createdAt,
                actionType: p.actionType,
                status: p.status,
                jobId: p.jobId,
                reasoning: p.reasoning,
              },
            ]),
          );
        } catch {
          /* ignore malformed event */
        }
      });
      es.addEventListener('bye', () => {
        es?.close();
        // Scope expired; restart fresh.
        if (!cancelled) {
          es = null;
          setTimeout(() => {
            if (!cancelled) startSse();
          }, 750);
        }
      });
      es.addEventListener('error', () => {
        // SSE failed (likely 401 = not admin). Fall back to polling.
        es?.close();
        es = null;
        if (!opened && !cancelled) {
          startPolling();
        }
      });
    };

    void tryBackfill();
    startSse();

    return () => {
      cancelled = true;
      if (es) es.close();
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 28, fontWeight: 700, color: t.text, margin: 0 }}>Autopilot</h2>
        <p style={{ fontSize: 14, color: t.textSecondary, margin: '4px 0 0' }}>
          Live DGX pipeline status, intake sources, posting cadence, and the Claude observer feed.
        </p>
      </div>

      {/* DGX live probe — wrap, don't reimplement */}
      <VCard style={{ marginBottom: 16 }}>
        <SectionTitle icon="sparkle" title="Pipeline status" sub="DGX VRAM + ComfyUI queues, polled every 3s." />
        <div style={{ marginTop: 12 }}>
          <PipelineLiveStatus />
        </div>
      </VCard>

      {/* Intake sources */}
      <VCard style={{ marginBottom: 16 }}>
        <SectionTitle
          icon="folder"
          title="Intake sources"
          sub="Where new projects originate. Cron-watched RSS is auto-poll; folder/drive/telegram are status-only."
        />
        {intakeLoading ? (
          <SkeletonRows rows={4} />
        ) : intakeErr ? (
          <ErrorBar message={`Could not load RSS feeds: ${intakeErr}`} />
        ) : intake.length === 0 ? (
          <EmptyState message="No intake sources reported. Add an RSS feed in Studio › Feeds to wake autopilot up." />
        ) : (
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {intake.map((src) => (
              <IntakeRow key={src.id} src={src} />
            ))}
          </div>
        )}
      </VCard>

      {/* Posting stagger */}
      <VCard style={{ marginBottom: 16 }}>
        <SectionTitle
          icon="upload"
          title="Posting stagger"
          sub="Default daily slots used by the cross-platform autopilot publisher."
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12,
            marginTop: 12,
          }}
        >
          {DEFAULT_STAGGER.map((row) => (
            <div
              key={row.platform}
              style={{
                background: t.cardAlt,
                border: `1px solid ${t.border}`,
                borderRadius: JELLY_TOKENS.radius.md,
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: t.textSecondary }}>{row.platform}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.text, marginTop: 2 }}>{row.slot}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 12 }}>
          Editing slots is a follow-up — wire to <code>/api/content/campaigns</code> when ready.
        </div>
      </VCard>

      {/* Live log feed */}
      <VCard style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <SectionTitle
            icon="history"
            title="Live pipeline log"
            sub={
              logSource === 'sse'
                ? 'Streaming via observer SSE.'
                : logSource === 'poll'
                  ? 'Polling /api/vater/pipeline-status every 5s (observer SSE unavailable).'
                  : 'Connecting…'
            }
          />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: t.textSecondary,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: logSource === 'sse' ? JELLY_TOKENS.success : logSource === 'poll' ? JELLY_TOKENS.accent : t.textDisabled,
              }}
            />
            {logSource === 'sse' ? 'sse' : logSource === 'poll' ? 'poll' : 'idle'}
          </span>
        </div>
        {logErr && <ErrorBar message={`Log feed error: ${logErr}`} />}
        <div
          style={{
            marginTop: 12,
            maxHeight: 320,
            overflowY: 'auto',
            background: t.cardAlt,
            border: `1px solid ${t.border}`,
            borderRadius: JELLY_TOKENS.radius.md,
            padding: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12,
          }}
        >
          {logs.length === 0 ? (
            <div style={{ color: t.textSecondary }}>
              No live activity yet. The DGX worker emits a line on every phase boundary; if you just started a project, expect lines within a few seconds.
            </div>
          ) : (
            logs.slice(0, 200).map((item) => <LogRow key={item.id} item={item} />)
          )}
        </div>
      </VCard>

      {/* Active job — wraps youtube-creation-progress */}
      <VCard>
        <SectionTitle
          icon="play"
          title="Active project"
          sub="When a project is selected from Project History, its phase ladder + DGX worker tail render here."
        />
        {activeProject ? (
          <div style={{ marginTop: 12 }}>
            <YouTubeCreationProgress
              project={activeProject}
              onUpdate={(p: unknown) =>
                setActiveProject((prev) => (prev ? { ...prev, ...(p as object) } : prev))
              }
            />
          </div>
        ) : (
          <EmptyState message="No project selected. Pick a running project in Project History to live-watch its phase ladder here." />
        )}
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <VBtn
            variant="outlined"
            size="sm"
            onClick={() => {
              const id = window.prompt('Project id to watch (find on the project card):');
              if (!id) return;
              setActiveProject({
                id: id.trim(),
                status: 'transcribing',
                progress: 0,
                mode: null,
                errorMessage: null,
                updatedAt: new Date().toISOString(),
                stepDetails: null,
              });
            }}
          >
            Watch a project by id
          </VBtn>
          {activeProject && (
            <VBtn variant="text" size="sm" onClick={() => setActiveProject(null)}>
              Clear
            </VBtn>
          )}
        </div>
      </VCard>
    </div>
  );
}

/* ─── helpers ─── */

function mergeLogs(prev: LogItem[], next: LogItem[]): LogItem[] {
  if (next.length === 0) return prev;
  const seen = new Set(prev.map((l) => l.id));
  const additions = next.filter((l) => !seen.has(l.id));
  if (additions.length === 0) return prev;
  // Newest first; cap at 300.
  const merged = [...additions, ...prev];
  merged.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return merged.slice(0, 300);
}

function LogRow({ item }: { item: LogItem }): React.ReactElement {
  const { t } = useTheme();
  const ts = formatTime(item.ts);
  if (item.kind === 'proposal') {
    return (
      <div style={{ marginBottom: 6, lineHeight: 1.4 }}>
        <span style={{ color: t.textSecondary }}>{ts} </span>
        <span
          style={{
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: JELLY_TOKENS.radius.xs,
            background: JELLY_TOKENS.brandGhost,
            color: JELLY_TOKENS.brand,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginRight: 6,
          }}
        >
          proposal · {item.actionType}
        </span>
        <span style={{ color: t.text }}>{item.reasoning ?? '(no reasoning)'} </span>
        {item.jobId && <span style={{ color: t.textDisabled }}>· {item.jobId.slice(0, 8)}</span>}
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 4, lineHeight: 1.4 }}>
      <span style={{ color: t.textSecondary }}>{ts} </span>
      <span style={{ color: t.text }}>{item.text}</span>
      {item.jobId && <span style={{ color: t.textDisabled }}> · {item.jobId.slice(0, 8)}</span>}
    </div>
  );
}

function IntakeRow({ src }: { src: IntakeSource }): React.ReactElement {
  const { t } = useTheme();
  const dotColor =
    src.status === 'configured'
      ? JELLY_TOKENS.success
      : src.status === 'pending'
        ? JELLY_TOKENS.accent
        : t.textDisabled;
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: 12,
        background: t.cardAlt,
        border: `1px solid ${t.border}`,
        borderRadius: JELLY_TOKENS.radius.md,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: JELLY_TOKENS.radius.md,
          background: JELLY_TOKENS.brandGhost,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={src.icon} size={18} color={JELLY_TOKENS.brand} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{src.label}</span>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />
          <span style={{ fontSize: 11, color: t.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {src.status}
          </span>
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>{src.description}</div>
        <div style={{ fontSize: 12, color: t.textDisabled, marginTop: 4 }}>{src.detail}</div>
      </div>
    </div>
  );
}

export function SectionTitle({
  icon,
  title,
  sub,
}: {
  icon: IconName;
  title: string;
  sub?: string;
}): React.ReactElement {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: JELLY_TOKENS.radius.md,
          background: JELLY_TOKENS.brandGhost,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={18} color={JELLY_TOKENS.brand} />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div
      style={{
        marginTop: 12,
        padding: '20px 16px',
        textAlign: 'center',
        background: t.cardAlt,
        border: `1px dashed ${t.border}`,
        borderRadius: JELLY_TOKENS.radius.md,
        color: t.textSecondary,
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

export function ErrorBar({ message }: { message: string }): React.ReactElement {
  return (
    <div
      style={{
        marginTop: 12,
        padding: '8px 12px',
        background: 'rgba(220,38,38,0.08)',
        border: `1px solid rgba(220,38,38,0.4)`,
        borderRadius: JELLY_TOKENS.radius.md,
        color: JELLY_TOKENS.error,
        fontSize: 12,
      }}
    >
      {message}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }): React.ReactElement {
  const { t } = useTheme();
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 56,
            borderRadius: JELLY_TOKENS.radius.md,
            background: `linear-gradient(90deg, ${t.cardAlt}, ${t.hover}, ${t.cardAlt})`,
            backgroundSize: '200% 100%',
            animation: 'vshimmer 1.4s linear infinite',
          }}
        />
      ))}
      <style>{`@keyframes vshimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}
