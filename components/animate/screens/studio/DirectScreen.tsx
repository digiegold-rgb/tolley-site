'use client';

/* Direct — Trey's dictation lane.
 *
 * Speak (or type) a brief, it becomes a VaterDirectJob the DGX runner feeds
 * to headless Claude inside the vater sandbox. Claude's clarifying
 * questions come back as thread messages (kind=question) and the job sits
 * in awaiting_reply until answered here. Mobile-first: big textarea, iOS
 * keyboard dictation does the voice part.
 */

import * as React from 'react';
import { useTheme } from '../../theme-context';
import { VCard, VBtn, SectionHeader } from '../../primitives';

type JobSummary = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
};

type Message = {
  id: string;
  role: 'trey' | 'agent' | 'system';
  kind: 'text' | 'question' | 'result' | 'error';
  text: string;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  queued: '#8b8b9e',
  running: '#3b82f6',
  awaiting_reply: '#f59e0b',
  done: '#22c55e',
  failed: '#ef4444',
  canceled: '#8b8b9e',
};

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  running: 'Working…',
  awaiting_reply: 'Needs your answer',
  done: 'Done',
  failed: 'Failed',
  canceled: 'Canceled',
};

function StatusChip({ status }: { status: string }): React.ReactElement {
  const color = STATUS_COLORS[status] ?? '#8b8b9e';
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: '#fff',
        background: color,
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function DirectScreen(): React.ReactElement {
  const { t } = useTheme();
  const [jobs, setJobs] = React.useState<JobSummary[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [thread, setThread] = React.useState<Message[]>([]);
  const [threadStatus, setThreadStatus] = React.useState<string>('');
  const [draft, setDraft] = React.useState('');
  const [reply, setReply] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refreshJobs = React.useCallback(async () => {
    try {
      const r = await fetch('/api/vater/direct', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      setJobs(Array.isArray(data?.jobs) ? data.jobs : []);
    } catch {
      /* transient — next poll retries */
    }
  }, []);

  const refreshThread = React.useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/vater/direct/${id}`, { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      setThread(Array.isArray(data?.messages) ? data.messages : []);
      setThreadStatus(data?.job?.status ?? '');
    } catch {
      /* transient */
    }
  }, []);

  React.useEffect(() => {
    void refreshJobs();
    const i = setInterval(refreshJobs, 8000);
    return () => clearInterval(i);
  }, [refreshJobs]);

  React.useEffect(() => {
    if (!selectedId) return;
    void refreshThread(selectedId);
    const i = setInterval(() => void refreshThread(selectedId), 4000);
    return () => clearInterval(i);
  }, [selectedId, refreshThread]);

  const submitBrief = React.useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/vater/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data?.error ?? `Submit failed (${r.status})`);
        return;
      }
      const data = await r.json();
      setDraft('');
      await refreshJobs();
      if (data?.job?.id) setSelectedId(data.job.id);
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }, [draft, busy, refreshJobs]);

  const submitReply = React.useCallback(async () => {
    const text = reply.trim();
    if (!text || !selectedId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/vater/direct/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data?.error ?? `Reply failed (${r.status})`);
        return;
      }
      setReply('');
      await refreshThread(selectedId);
    } catch {
      setError('Network error — try again.');
    } finally {
      setBusy(false);
    }
  }, [reply, selectedId, busy, refreshThread]);

  const textareaStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 120,
    padding: 14,
    fontSize: 16, // ≥16px stops iOS Safari from zooming the page on focus
    lineHeight: 1.5,
    borderRadius: 12,
    border: `1px solid ${t.border}`,
    background: t.body,
    color: t.text,
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionHeader
        icon="sparkle"
        title="🎙️ Direct"
        description="Dictate a video brief. Claude runs it in the studio sandbox and asks here if it needs anything."
      />

      <VCard variant="flat">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tap here, then use the mic on your keyboard. Describe the video you want…"
            style={textareaStyle}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <VBtn onClick={() => void submitBrief()} disabled={busy || !draft.trim()}>
              {busy ? 'Sending…' : 'Start the video'}
            </VBtn>
          </div>
        </div>
      </VCard>

      {error && (
        <VCard variant="flat">
          <div style={{ color: '#ef4444', fontSize: 14 }}>{error}</div>
        </VCard>
      )}

      {jobs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jobs.map((job) => (
            <VCard key={job.id} variant={job.id === selectedId ? 'elevated' : 'flat'}>
              <button
                onClick={() => setSelectedId(job.id === selectedId ? null : job.id)}
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: 12,
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {job.preview || '(empty brief)'}
                  </div>
                  <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>
                    {new Date(job.createdAt).toLocaleString()}
                  </div>
                </div>
                <StatusChip status={job.status} />
              </button>

              {job.id === selectedId && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: `1px solid ${t.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {thread.map((m) => {
                    const mine = m.role === 'trey';
                    const isSystem = m.role === 'system';
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: mine ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                          padding: '10px 14px',
                          borderRadius: 14,
                          fontSize: 14,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          overflowWrap: 'anywhere',
                          background: mine
                            ? '#3b82f6'
                            : isSystem
                              ? 'transparent'
                              : t.cardAlt,
                          color: mine ? '#fff' : isSystem ? t.textSecondary : t.text,
                          border: mine || isSystem ? 'none' : `1px solid ${t.border}`,
                          fontStyle: isSystem ? 'italic' : 'normal',
                          ...(m.kind === 'question'
                            ? { borderLeft: '3px solid #f59e0b' }
                            : {}),
                          ...(m.kind === 'error' ? { borderLeft: '3px solid #ef4444' } : {}),
                        }}
                      >
                        {m.kind === 'question' && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
                            QUESTION FOR YOU
                          </div>
                        )}
                        {m.text}
                      </div>
                    );
                  })}

                  {threadStatus === 'awaiting_reply' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                      <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Dictate or type your answer…"
                        style={{ ...textareaStyle, minHeight: 80 }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <VBtn onClick={() => void submitReply()} disabled={busy || !reply.trim()}>
                          {busy ? 'Sending…' : 'Send answer'}
                        </VBtn>
                      </div>
                    </div>
                  )}
                  {threadStatus === 'running' && (
                    <div style={{ fontSize: 13, color: t.textSecondary, fontStyle: 'italic' }}>
                      Claude is working — updates land here automatically.
                    </div>
                  )}
                </div>
              )}
            </VCard>
          ))}
        </div>
      )}
    </div>
  );
}
