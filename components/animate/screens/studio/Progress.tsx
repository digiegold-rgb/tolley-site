'use client';

/* Progress tab — replaces Queue (2026-08-28).
 *
 * Four groups from the app-wide progress-summary poll (ProgressBadgeProvider,
 * no second fetch here):
 *
 *   Needs your approval   step 5 / 6 gates + failed rows (the badge count)
 *   In progress           writing / producing / concierge (the sidebar pulse)
 *   Done                  ready in the last 7 days
 *   Expired               a gate that sat 7 days — Reopen puts it back
 *
 * A row expands into the compact 8-step stepper; clicking a row deep-links to
 * `#r=create&p=<id>&s=<step>`. The paste-a-URL import tracker that used to
 * live under Queue is gone — step 1 of Create is that box now.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme, useRoute } from '../../theme-context';
import { VBtn, VCard } from '../../primitives';
import { GlassCard, MicroLabel } from '../../cinema';
import { NotifyOptInCard } from '../../NotifyOptInCard';
import { DriveSyncChip } from '../../DriveSyncChip';
import { RenderTerminal, RenderTerminalToggle } from '../../RenderTerminal';
import { useProgressSummary, refreshProgress, type ProgressRow } from '../../ProgressBadgeProvider';
import { CreateStepper } from '../create/CreateStepper';
import { stepHash, stepDef, type DerivedCreateStep } from '@/lib/vater/create-steps';
import { relativeTimeLabel } from '@/lib/vater/concierge-client';

type Group = 'approval' | 'active' | 'done' | 'expired';

const GROUPS: ReadonlyArray<{ id: Group; eyebrow: string; tone: 'violet' | 'cyan' | 'faint'; empty: string }> = [
  { id: 'approval', eyebrow: 'Needs your approval', tone: 'violet', empty: 'Nothing waiting on you.' },
  { id: 'active', eyebrow: 'In progress', tone: 'cyan', empty: 'Nothing is being written or rendered right now.' },
  { id: 'done', eyebrow: 'Done · last 7 days', tone: 'violet', empty: 'Nothing finished this week — done videos also live in Library.' },
  { id: 'expired', eyebrow: 'Expired', tone: 'faint', empty: '' },
];

function groupOf(r: ProgressRow): Group | null {
  if (r.kind === 'expired') return 'expired';
  if (r.kind === 'approval' || r.kind === 'money' || r.kind === 'failed') return 'approval';
  if (r.kind === 'terminal' || r.status === 'ready') return 'done';
  if (r.active || r.kind === 'async') return 'active';
  // Input steps (a draft parked on 1–3) read as "in progress" — the customer
  // left mid-flow and the row is where they can pick it back up.
  return 'active';
}

function chipFor(r: ProgressRow, t: ReturnType<typeof useTheme>['t']): { label: string; color: string; bg: string } {
  const def = stepDef(r.step);
  switch (r.kind) {
    case 'approval':
      return { label: `Step ${r.step} · Review script`, color: JELLY_TOKENS.brandLight, bg: JELLY_TOKENS.brandGhost };
    case 'money':
      return { label: `Step ${r.step} · Choose engine`, color: JELLY_TOKENS.brandLight, bg: JELLY_TOKENS.brandGhost };
    case 'failed':
      return { label: `Failed on step ${r.step}`, color: JELLY_TOKENS.error, bg: 'rgba(240,96,122,0.12)' };
    case 'expired':
      return { label: `Expired on step ${r.step}`, color: t.textSecondary, bg: t.hover };
    case 'terminal':
      return { label: 'Ready', color: JELLY_TOKENS.success, bg: 'rgba(52,201,138,0.12)' };
    case 'async':
      return { label: `Step ${r.step} · ${def.label}…`, color: JELLY_TOKENS.cyan, bg: JELLY_TOKENS.cyanGhost };
    default:
      return { label: `Step ${r.step} · ${def.label}`, color: t.textSecondary, bg: t.hover };
  }
}

export function Progress(): React.ReactElement {
  const { t } = useTheme();
  const { requestNewVideo } = useRoute();
  const { projects, loaded, error, needsApproval, active } = useProgressSummary();

  const grouped = React.useMemo(() => {
    const out: Record<Group, ProgressRow[]> = { approval: [], active: [], done: [], expired: [] };
    for (const r of projects) {
      const g = groupOf(r);
      if (g) out[g].push(r);
    }
    const byTime = (a: ProgressRow, b: ProgressRow) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    for (const g of Object.keys(out) as Group[]) out[g].sort(byTime);
    return out;
  }, [projects]);

  const empty = loaded && projects.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="progress-screen" data-needs={needsApproval} data-active={active}>
      {!loaded && !error && (
        <VCard variant="flat">
          <div style={{ color: t.textSecondary, fontSize: 14 }}>Loading…</div>
        </VCard>
      )}
      {error && loaded === false && (
        <VCard variant="flat">
          <div style={{ color: JELLY_TOKENS.error, fontSize: 14 }}>Could not load progress ({error}).</div>
          <div style={{ marginTop: 10 }}>
            <VBtn size="sm" onClick={refreshProgress}>Try again</VBtn>
          </div>
        </VCard>
      )}
      {empty && (
        <VCard variant="flat" data-testid="progress-empty">
          <div style={{ color: t.textSecondary, fontSize: 14, lineHeight: 1.6 }}>
            Nothing in flight. Start a video and every step — writing, your approval, the render — shows up here, and this tab lights up when something needs you.
          </div>
          <div style={{ marginTop: 12 }}>
            <VBtn size="sm" variant="primary" onClick={requestNewVideo} data-testid="progress-create">
              Create a video
            </VBtn>
          </div>
        </VCard>
      )}

      {loaded &&
        !empty &&
        GROUPS.map((g) => {
          const rows = grouped[g.id];
          if (g.id === 'expired' && rows.length === 0) return null;
          return (
            <GlassCard key={g.id} data-testid={`progress-section-${g.id}`} padding={16}>
              <MicroLabel tone={g.tone} size={10.5} tracking="0.22em" style={{ marginBottom: 10 }}>
                {g.eyebrow}
                {rows.length > 0 ? ` · ${rows.length}` : ''}
              </MicroLabel>
              {rows.length === 0 ? (
                <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>{g.empty}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rows.map((r) => (
                    <Row key={r.id} row={r} group={g.id} />
                  ))}
                </div>
              )}
            </GlassCard>
          );
        })}

      {loaded && <NotifyOptInCard compact dismissable={false} />}
    </div>
  );
}

function Row({ row, group }: { row: ProgressRow; group: Group }): React.ReactElement {
  const { t } = useTheme();
  // The worker-log box (Jared 2026-08-28): always open for anything in
  // flight — auto AND concierge — collapsed behind "Log" once it needs you
  // or is done. Polls only while the row is actually working.
  const polling = row.active || row.kind === 'async';
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const chip = chipFor(row, t);
  const href = stepHash(row.id, row.step);
  const derived: DerivedCreateStep = {
    step: stepDef(row.step).n,
    kind: row.kind,
    needsUser: row.needsUser,
    active: row.active,
  };

  const reopen = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/vater/youtube/${row.id}/reopen`, { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      refreshProgress();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not reopen');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid={`progress-row-${row.id}`}
      data-kind={row.kind}
      data-step={row.step}
      style={{
        padding: 10,
        background: t.cardAlt,
        border: `1px solid ${row.needsUser ? JELLY_TOKENS.brandOutline : t.border}`,
        borderRadius: JELLY_TOKENS.radius.md,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Hide steps' : 'Show steps'}
          data-testid={`progress-expand-${row.id}`}
          onClick={() => setOpen((v) => !v)}
          style={{ background: 'transparent', border: 'none', color: t.textSecondary, cursor: 'pointer', padding: 2, fontSize: 12, width: 20 }}
        >
          {open ? '▾' : '▸'}
        </button>
        <span
          data-testid="progress-chip"
          className={row.kind === 'async' ? 'jelly-pulse' : undefined}
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
            padding: '3px 9px',
            borderRadius: JELLY_TOKENS.radius.pill,
            color: chip.color,
            background: chip.bg,
            border: `1px solid ${chip.color}33`,
            whiteSpace: 'nowrap',
          }}
        >
          {chip.label}
        </span>
        <a
          href={href}
          data-testid={`progress-open-${row.id}`}
          style={{
            flex: '1 1 180px',
            minWidth: 0,
            fontSize: 13,
            color: t.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
        >
          {row.title || 'Untitled'}
        </a>
        <DriveSyncChip project={row} compact onSynced={refreshProgress} />
        <span style={{ fontSize: 11.5, color: t.textFaint, whiteSpace: 'nowrap' }}>{relativeTimeLabel(row.updatedAt)}</span>
        {row.variationCount > 0 && (
          <span style={{ fontSize: 11, color: t.textSecondary, whiteSpace: 'nowrap' }}>rewrite #{row.variationCount}</span>
        )}
        {row.kind === 'expired' ? (
          <VBtn size="sm" variant="outlined" onClick={(e) => void reopen(e)} disabled={busy} data-testid={`progress-reopen-${row.id}`}>
            {busy ? 'Reopening…' : 'Reopen'}
          </VBtn>
        ) : (
          <VBtn
            size="sm"
            variant={row.needsUser ? 'primary' : 'text'}
            onClick={() => {
              window.location.hash = href;
            }}
          >
            {row.kind === 'approval' ? 'Review →' : row.kind === 'money' ? 'Choose engine →' : row.kind === 'terminal' ? 'Open →' : 'Open step →'}
          </VBtn>
        )}
      </div>
      {err && <div style={{ fontSize: 12, color: JELLY_TOKENS.error }}>{err}</div>}
      {group === 'active' && <RenderTerminal projectId={row.id} active={polling} compact />}
      {(group === 'approval' || group === 'done') && <RenderTerminalToggle projectId={row.id} active={false} compact />}
      {open && (
        <CreateStepper
          current={row.step}
          derived={derived}
          maxStep={row.step}
          orientation="horizontal"
          compact
          onSelect={(s) => {
            window.location.hash = stepHash(row.id, s);
          }}
        />
      )}
    </div>
  );
}
