'use client';

/* System Log — "what actually happened to my render".
 *
 * The single screen a beta tester can open before writing to support, and the
 * screen support opens first during a view-as session. It merges three
 * timelines that each know part of the story (durable events, credit ledger
 * rows, current project status) into one newest-first table, filterable to a
 * single project.
 *
 * "Copy for support" puts the visible rows on the clipboard as plain text, so
 * a bug report arrives with evidence attached instead of "it broke".
 *
 * Everything is scoped server-side to the caller (GET /api/vater/me/log) —
 * this component never asks for a userId and can't be pointed at anyone else.
 */

import * as React from 'react';

import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, VCard, SectionHeader } from '../../primitives';

type LogLevel = 'info' | 'warn' | 'error';
type LogSource = 'event' | 'credit' | 'project';

interface LogEntry {
  id: string;
  at: string;
  source: LogSource;
  kind: string;
  level: LogLevel;
  message: string;
  projectId: string | null;
  jobId: string | null;
  detail?: Record<string, unknown> | null;
}

interface LogPayload {
  entries?: LogEntry[];
  projects?: Array<{ id: string; label: string }>;
  impersonating?: boolean;
}

const SOURCE_LABEL: Record<LogSource, string> = {
  event: 'Pipeline',
  credit: 'Billing',
  project: 'Project',
};

function levelColor(level: LogLevel): string {
  if (level === 'error') return JELLY_TOKENS.error;
  if (level === 'warn') return JELLY_TOKENS.warning;
  return JELLY_TOKENS.brand;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function SystemLog(): React.ReactElement {
  const { t } = useTheme();
  const [entries, setEntries] = React.useState<LogEntry[]>([]);
  const [projects, setProjects] = React.useState<Array<{ id: string; label: string }>>([]);
  const [projectId, setProjectId] = React.useState<string>('');
  const [levelFilter, setLevelFilter] = React.useState<'all' | 'problems'>('all');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const load = React.useCallback(async (pid: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: '300' });
      if (pid) qs.set('projectId', pid);
      const r = await fetch(`/api/vater/me/log?${qs.toString()}`, { cache: 'no-store' });
      if (!r.ok) {
        setError(
          r.status === 401
            ? 'Your session expired — sign in again to see your log.'
            : 'Could not load your system log.',
        );
        return;
      }
      const data = (await r.json()) as LogPayload;
      setEntries(Array.isArray(data.entries) ? data.entries : []);
      // The project list is the same regardless of filter; only refresh it
      // when unfiltered so narrowing can't empty the dropdown you're using.
      if (!pid && Array.isArray(data.projects)) setProjects(data.projects);
    } catch {
      setError('Could not load your system log.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(projectId);
  }, [load, projectId]);

  const visible = React.useMemo(
    () =>
      levelFilter === 'problems'
        ? entries.filter((e) => e.level === 'error' || e.level === 'warn')
        : entries,
    [entries, levelFilter],
  );

  const copyForSupport = React.useCallback(async () => {
    const header = [
      'Jelly Studio — system log export',
      `exported: ${new Date().toISOString()}`,
      projectId ? `project: ${projectId}` : 'project: (all)',
      `rows: ${visible.length}`,
      '',
    ].join('\n');
    const body = visible
      .map((e) => {
        const detail = e.detail ? ` ${JSON.stringify(e.detail)}` : '';
        return `${e.at} [${e.level}] ${SOURCE_LABEL[e.source]} ${e.kind} — ${e.message}${detail}`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(`${header}${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Your browser blocked clipboard access — select the rows and copy manually.');
    }
  }, [visible, projectId]);

  const selectStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: JELLY_TOKENS.radius.md,
    border: `1px solid ${t.border}`,
    background: t.card,
    color: t.text,
    fontSize: 13,
    fontFamily: JELLY_TOKENS.font,
    maxWidth: 280,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="description"
        title="System Log"
        description="Everything that happened on your account — renders, phase changes, failures, credits. Newest first."
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <label htmlFor="log-project" style={{ fontSize: 13, color: t.textSecondary }}>
          Project
        </label>
        <select
          id="log-project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          data-testid="log-project-filter"
          style={selectStyle}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <label htmlFor="log-level" style={{ fontSize: 13, color: t.textSecondary }}>
          Show
        </label>
        <select
          id="log-level"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as 'all' | 'problems')}
          data-testid="log-level-filter"
          style={{ ...selectStyle, maxWidth: 180 }}
        >
          <option value="all">Everything</option>
          <option value="problems">Problems only</option>
        </select>

        <div style={{ flex: 1 }} />

        <VBtn variant="ghost" onClick={() => void load(projectId)}>
          Refresh
        </VBtn>
        <VBtn onClick={copyForSupport} disabled={visible.length === 0}>
          {copied ? 'Copied ✓' : 'Copy for support'}
        </VBtn>
      </div>

      {error ? (
        <VCard variant="flat">
          <div style={{ color: JELLY_TOKENS.error, fontSize: 14 }}>{error}</div>
        </VCard>
      ) : null}

      {loading ? (
        <VCard variant="flat">
          <div style={{ color: t.textSecondary, fontSize: 14 }}>Loading your log…</div>
        </VCard>
      ) : visible.length === 0 ? (
        <VCard variant="flat">
          <div style={{ color: t.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
            {levelFilter === 'problems'
              ? 'No problems recorded. That is the good outcome.'
              : 'Nothing logged yet. Make a video and every step of it shows up here.'}
          </div>
        </VCard>
      ) : (
        <VCard variant="flat">
          {/* Wide table scrolls inside its own box — the page never scrolls
              sideways on a phone. */}
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <table
              data-testid="system-log-table"
              style={{
                width: '100%',
                minWidth: 640,
                borderCollapse: 'collapse',
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ textAlign: 'left', color: t.textSecondary }}>
                  <th style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>When</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Source</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Event</th>
                  <th style={{ padding: '8px 10px', fontWeight: 600 }}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <tr key={entry.id} style={{ borderTop: `1px solid ${t.border}` }}>
                    <td
                      style={{
                        padding: '8px 10px',
                        color: t.textSecondary,
                        whiteSpace: 'nowrap',
                        verticalAlign: 'top',
                      }}
                    >
                      {formatWhen(entry.at)}
                    </td>
                    <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          color: levelColor(entry.level),
                          background: `${levelColor(entry.level)}1a`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {SOURCE_LABEL[entry.source] ?? entry.source}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: t.textSecondary,
                        verticalAlign: 'top',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.kind}
                    </td>
                    <td
                      style={{
                        padding: '8px 10px',
                        color: entry.level === 'error' ? JELLY_TOKENS.error : t.text,
                        verticalAlign: 'top',
                        lineHeight: 1.5,
                      }}
                    >
                      {entry.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </VCard>
      )}

      <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.6 }}>
        Reporting a problem? Hit <strong>Copy for support</strong> first and paste the
        result into your message — it saves a round-trip of questions.
      </div>
    </div>
  );
}
