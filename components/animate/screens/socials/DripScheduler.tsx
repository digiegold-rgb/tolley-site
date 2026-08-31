'use client';

/**
 * 4-step drip scheduler. Nothing is created until the confirm click
 * (step 4 → POST /api/vater/socials/schedule-batch). The server never
 * reschedules or extends a batch.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn } from '../../primitives';
import { PLATFORM_META, SOCIAL_PLATFORMS, type SocialPlatform } from '../live/ConnectionsPanel';
import { customerStage } from '@/lib/vater/youtube-status';
import { enumerateDripSlots } from '@/lib/vater/socials/schedule';

interface LibProject {
  id: string;
  status?: string;
  sourceTitle?: string | null;
  publishTitle?: string | null;
  topic?: string | null;
  finalVideoUrl?: string | null;
  settingsJson?: unknown;
}

interface LivePost {
  projectId: string;
  status: string;
}

function titleOf(p: LibProject): string {
  return p.publishTitle || p.sourceTitle || p.topic || p.id;
}

function settingsBag(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function isDgxPosted(p: LibProject): boolean {
  const bag = settingsBag(p.settingsJson);
  const imp = bag.dgxImport;
  if (!imp || typeof imp !== 'object' || Array.isArray(imp)) return false;
  return (imp as { posted?: unknown }).posted === true;
}

const LIVE = new Set(['scheduled', 'publishing', 'draft', 'queued', 'pending']);

export function DripScheduler({
  open,
  onClose,
  onScheduled,
  preselectedIds,
}: {
  open: boolean;
  onClose: () => void;
  onScheduled?: () => void;
  preselectedIds?: string[];
}): React.ReactElement | null {
  const { t } = useTheme();
  const [step, setStep] = React.useState(1);
  const [projects, setProjects] = React.useState<LibProject[]>([]);
  const [liveIds, setLiveIds] = React.useState<Set<string>>(new Set());
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [platforms, setPlatforms] = React.useState<Set<SocialPlatform>>(new Set());
  const [connected, setConnected] = React.useState<SocialPlatform[]>([]);
  const [boards, setBoards] = React.useState<Array<{ id: string; name: string }>>([]);
  const [boardId, setBoardId] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [perDay, setPerDay] = React.useState(1);
  const [timeOfDay, setTimeOfDay] = React.useState('09:00');
  const tz = React.useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [quote, setQuote] = React.useState<{ totalCents: number; unmetered: boolean } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setStep(1);
    setError(null);
    setBusy(false);
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setStartDate(`${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
    void (async () => {
      const [yt, posts, acc] = await Promise.all([
        fetch('/api/vater/youtube', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/vater/social-posts?limit=200', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        fetch('/api/vater/social-accounts', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      ]);
      const list = (Array.isArray(yt.projects) ? yt.projects : []) as LibProject[];
      const done = list.filter((p) => customerStage(p) === 'done' && !!p.finalVideoUrl);
      setProjects(done);
      const live = new Set<string>();
      for (const row of (posts.posts ?? []) as LivePost[]) {
        if (LIVE.has(row.status)) live.add(row.projectId);
      }
      setLiveIds(live);
      const pre = new Set((preselectedIds ?? []).filter((id) => done.some((p) => p.id === id) && !live.has(id)));
      setPicked(pre);
      const by = (acc.byPlatform ?? {}) as Record<string, { provider?: string; status?: string }>;
      const conn = SOCIAL_PLATFORMS.filter((p) => by[p]?.provider === 'zernio' && by[p]?.status === 'active');
      setConnected(conn);
      setPlatforms(new Set(conn));
    })();
  }, [open, preselectedIds]);

  React.useEffect(() => {
    if (!open || !platforms.has('pinterest') || boards.length) return;
    void (async () => {
      const r = await fetch('/api/vater/social-accounts/pinterest/options', { cache: 'no-store' });
      if (!r.ok) return;
      const d = (await r.json()) as { boards?: Array<{ id: string; name: string }> };
      if (d.boards?.length) {
        setBoards(d.boards);
        setBoardId((b) => b || d.boards![0].id);
      }
    })();
  }, [open, platforms, boards.length]);

  if (!open || typeof document === 'undefined') return null;

  const eligible = projects.filter((p) => !liveIds.has(p.id));
  const selected = eligible.filter((p) => picked.has(p.id));
  const needsBoard = platforms.has('pinterest') && !boardId;

  const startAtIso = (() => {
    if (!startDate) return '';
    const [y, m, d] = startDate.split('-').map(Number);
    const [hh, mm] = timeOfDay.split(':').map(Number);
    const local = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);
    return local.toISOString();
  })();

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/vater/socials/schedule-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectIds: selected.map((p) => p.id),
          platforms: [...platforms],
          startAt: startAtIso,
          timezone: tz,
          perDay,
          timeOfDay,
          pinterestBoardId: needsBoard ? undefined : boardId || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        total?: number;
        quote?: { totalCents: number; unmetered: boolean };
      };
      if (res.status === 402) {
        setQuote({ totalCents: data.total ?? data.quote?.totalCents ?? 0, unmetered: false });
        setError(`Not enough credit — this batch is $${((data.total ?? 0) / 100).toFixed(2)}.`);
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onScheduled?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'schedule failed');
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canNext =
    (step === 1 && selected.length > 0) ||
    (step === 2 && platforms.size > 0 && !needsBoard) ||
    (step === 3 && !!startDate && perDay >= 1);

  const body = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Schedule videos"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          overflow: 'auto',
          background: t.panel,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: JELLY_TOKENS.radius.xxl,
          boxShadow: JELLY_TOKENS.shadow24,
          padding: 20,
          fontFamily: JELLY_TOKENS.font,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
          Schedule videos · step {step} of 4
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>
          Nothing is created until you confirm on the last step.
        </div>

        {step === 1 && (
          <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
            {projects.length === 0 && (
              <div style={{ fontSize: 13, color: t.textSecondary }}>No finished videos in this studio.</div>
            )}
            {projects.map((p) => {
              const live = liveIds.has(p.id);
              const posted = isDgxPosted(p);
              const disabled = live;
              return (
                <label
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: 8,
                    borderRadius: JELLY_TOKENS.radius.md,
                    border: `1px solid ${t.border}`,
                    background: t.card,
                    opacity: disabled || posted ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    color: t.text,
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={picked.has(p.id)}
                    onChange={() => toggle(p.id)}
                  />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {titleOf(p)}
                  </span>
                  {live && <span style={{ fontSize: 10, color: t.textSecondary }}>already queued</span>}
                  {posted && !live && <span style={{ fontSize: 10, color: t.textSecondary }}>DGX posted</span>}
                </label>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            {connected.length === 0 && (
              <div style={{ fontSize: 13, color: t.textSecondary }}>
                Connect a channel on Socials or Publishing first.
              </div>
            )}
            {connected.map((p) => {
              const meta = PLATFORM_META[p];
              return (
                <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.text, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={platforms.has(p)}
                    onChange={() => {
                      setPlatforms((prev) => {
                        const next = new Set(prev);
                        if (next.has(p)) next.delete(p);
                        else next.add(p);
                        return next;
                      });
                    }}
                  />
                  {meta.emoji} {meta.label}
                </label>
              );
            })}
            {platforms.has('pinterest') && (
              <label style={{ display: 'grid', gap: 4, fontSize: 12, color: t.textSecondary }}>
                Pinterest board
                <select
                  value={boardId}
                  onChange={(e) => setBoardId(e.target.value)}
                  style={{
                    padding: 8,
                    borderRadius: JELLY_TOKENS.radius.md,
                    border: `1px solid ${t.border}`,
                    background: t.card,
                    color: t.text,
                    fontFamily: JELLY_TOKENS.font,
                  }}
                >
                  {boards.length === 0 && <option value="">Loading boards…</option>}
                  {boards.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {step === 3 && (
          <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: t.textSecondary }}>
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle(t)}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: t.textSecondary }}>
              Videos per day
              <input
                type="number"
                min={1}
                max={20}
                value={perDay}
                onChange={(e) => setPerDay(Math.max(1, Number(e.target.value) || 1))}
                style={inputStyle(t)}
              />
            </label>
            <label style={{ display: 'grid', gap: 4, fontSize: 12, color: t.textSecondary }}>
              Time of day
              <input
                type="time"
                value={timeOfDay}
                onChange={(e) => setTimeOfDay(e.target.value)}
                style={inputStyle(t)}
              />
            </label>
            <div style={{ fontSize: 12, color: t.textSecondary }}>Timezone: {tz} (this browser)</div>
          </div>
        )}

        {step === 4 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: t.text, marginBottom: 8 }}>
              {selected.length} video{selected.length === 1 ? '' : 's'} · {[...platforms].map((p) => PLATFORM_META[p].label).join(', ')}
            </div>
            <div style={{ display: 'grid', gap: 6, maxHeight: 240, overflow: 'auto' }}>
              {(() => {
                const slots = startAtIso
                  ? enumerateDripSlots({
                      startAt: new Date(startAtIso),
                      timezone: tz,
                      perDay,
                      timeOfDay,
                      count: selected.length,
                    })
                  : [];
                return selected.map((p, i) => {
                  const when = slots[i]?.at ?? null;
                  return (
                    <div key={p.id} style={{ fontSize: 12, color: t.text, padding: '6px 0', borderBottom: `1px solid ${t.border}` }}>
                      <div style={{ fontWeight: 600 }}>{titleOf(p)}</div>
                      <div style={{ color: t.textSecondary }}>
                        {[...platforms].map((pl) => PLATFORM_META[pl].label).join(', ')}
                        {' · '}
                        {when ? when.toLocaleString() : '—'}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: t.text }}>
              List price:{' '}
              <strong>{quote?.unmetered === false && quote.totalCents
                ? `$${(quote.totalCents / 100).toFixed(2)}`
                : '$0.00'}</strong>
              {' '}
              (owner / connected accounts — posts themselves are $0)
            </div>
          </div>
        )}

        {error && (
          <div style={{ marginTop: 10, fontSize: 12, color: JELLY_TOKENS.error }}>{error}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
          <VBtn size="sm" variant="ghost" onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as 1)} disabled={busy}>
            {step === 1 ? 'Close' : 'Back'}
          </VBtn>
          {step < 4 ? (
            <VBtn size="sm" disabled={!canNext} onClick={() => setStep((s) => (s + 1) as 2)}>
              Next
            </VBtn>
          ) : (
            <VBtn size="sm" disabled={busy || selected.length === 0} onClick={() => void confirm()}>
              {busy ? 'Scheduling…' : 'Confirm schedule'}
            </VBtn>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

function inputStyle(t: { border: string; card: string; text: string }): React.CSSProperties {
  return {
    padding: 8,
    borderRadius: JELLY_TOKENS.radius.md,
    border: `1px solid ${t.border}`,
    background: t.card,
    color: t.text,
    fontFamily: JELLY_TOKENS.font,
    fontSize: 14,
  };
}
