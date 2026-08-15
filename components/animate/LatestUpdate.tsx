'use client';

/* LatestUpdate — green pulsing "what's new" surfaces + estimated cost pill.
 *
 * Data source: GET /api/vater/latest (studio session). One fetch per mount,
 * shared by three consumers:
 *   - LatestUpdateBanner  — top of DashboardScreen (full banner)
 *   - LatestUpdateStrip   — Library header (compact one-liner)
 *   - VaterCostPill       — Header top-right (≈$ spend, estimate only)
 *
 * "Seen" state is per-browser via localStorage: the dot keeps blinking until
 * the user clicks the banner, then it goes steady for that update id.
 * Inline styles only (v2 shell contract — no Tailwind, no new deps).
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme, useRoute } from './theme-context';
import { useTier } from './tier-context';

const SEEN_KEY = 'vater-latest-seen-id';
const GREEN = '#22c55e';

interface VaterUpdateRow {
  id: string;
  message: string;
  kind: string;
  projectId: string | null;
  url: string | null;
  createdAt: string;
}

interface VaterCosts {
  claudeUsd: number;
  modalUsd: number;
  geminiUsd: number;
  falUsd: number;
  otherUsd: number;
  note: string | null;
  updatedAt: string;
}

interface BreakdownRow {
  key: string;
  label: string;
  usd: number;
}

interface VaterBilling {
  opsRatePerMinute: number;
  minutes: number;
  videos: number;
  computeUsd: number;
  opsUsd: number;
  totalUsd: number;
  paidUsd?: number;
  dueUsd?: number;
  breakdown?: BreakdownRow[];
  since?: {
    from: string | null;
    basis: 'snapshot' | 'activity' | 'all-time';
    computeUsd: number;
    opsUsd: number;
    totalUsd: number;
    carryoverUsd: number;
    rows: BreakdownRow[];
  } | null;
}

interface LatestPayload {
  updates: VaterUpdateRow[];
  costs: VaterCosts | null;
  billing?: VaterBilling | null;
}

export function useVaterLatest(): LatestPayload | null {
  const [data, setData] = React.useState<LatestPayload | null>(null);
  // /api/vater/latest is studio-gated and its payload is the OWNER's spend.
  // Without this check every public customer fired a request that 401'd and
  // the cost pill sat on "—" forever. Skip the fetch entirely.
  const { capabilities } = useTier();
  const allowed = capabilities.latestCosts;
  React.useEffect(() => {
    if (!allowed) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/latest', { cache: 'no-store' });
        if (!r.ok) return;
        const json = (await r.json()) as LatestPayload;
        if (!cancelled) setData(json);
      } catch {
        /* swallow — surfaces simply don't render */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed]);
  return data;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Pulsing (unseen) or steady (seen) green dot. */
export function GreenDot({ pulse }: { pulse: boolean }): React.ReactElement {
  return (
    <>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: GREEN,
          flexShrink: 0,
          boxShadow: pulse ? `0 0 0 0 ${GREEN}` : 'none',
          animation: pulse ? 'vaterPulse 1.6s ease-out infinite' : 'none',
        }}
      />
      <style>{`@keyframes vaterPulse {
        0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.6); }
        70% { box-shadow: 0 0 0 9px rgba(34,197,94,0); }
        100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
      }`}</style>
    </>
  );
}

function useSeen(latestId: string | undefined): [boolean, () => void] {
  const [seen, setSeen] = React.useState(true);
  React.useEffect(() => {
    if (!latestId) return;
    try {
      setSeen(window.localStorage.getItem(SEEN_KEY) === latestId);
    } catch {
      setSeen(false);
    }
  }, [latestId]);
  const markSeen = React.useCallback(() => {
    if (!latestId) return;
    try {
      window.localStorage.setItem(SEEN_KEY, latestId);
    } catch {
      /* private mode — dot just keeps pulsing */
    }
    setSeen(true);
  }, [latestId]);
  return [seen, markSeen];
}

/** Full banner for the Dashboard. Renders nothing until an update exists. */
export function LatestUpdateBanner(): React.ReactElement | null {
  const { t } = useTheme();
  const { openProjectInVideoEditor, setRoute } = useRoute();
  const data = useVaterLatest();
  const latest = data?.updates?.[0];
  const [seen, markSeen] = useSeen(latest?.id);
  if (!latest) return null;

  const onClick = (): void => {
    markSeen();
    if (latest.projectId) openProjectInVideoEditor(latest.projectId);
    else if (latest.url && latest.url.startsWith('/')) window.location.href = latest.url;
    else if (latest.url) window.open(latest.url, '_blank', 'noopener');
    else setRoute('library');
  };

  return (
    <button
      type="button"
      onClick={onClick}
      title="Latest Vater studio update — click to open"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '12px 16px',
        marginBottom: 20,
        borderRadius: JELLY_TOKENS.radius.md,
        border: `1px solid ${seen ? t.border : GREEN}`,
        background: t.card,
        color: t.text,
        cursor: 'pointer',
        fontFamily: JELLY_TOKENS.font,
      }}
    >
      <GreenDot pulse={!seen} />
      <span style={{ fontSize: 13, lineHeight: 1.4, flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 700, marginRight: 8, color: GREEN }}>NEW</span>
        {latest.message}
      </span>
      <span style={{ fontSize: 11, color: t.textSecondary, flexShrink: 0 }}>
        {timeAgo(latest.createdAt)}
      </span>
    </button>
  );
}

/** Compact strip for the Library header row. */
export function LatestUpdateStrip(): React.ReactElement | null {
  const { t } = useTheme();
  const data = useVaterLatest();
  const latest = data?.updates?.[0];
  const [seen] = useSeen(latest?.id);
  if (!latest) return null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        fontSize: 12,
        color: t.textSecondary,
        fontFamily: JELLY_TOKENS.font,
      }}
    >
      <GreenDot pulse={!seen} />
      <span style={{ fontWeight: 700, color: GREEN }}>Latest</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {latest.message}
      </span>
      <span style={{ flexShrink: 0 }}>· {timeAgo(latest.createdAt)}</span>
    </div>
  );
}

/** Header pill: all-time Vater spend with a hover breakdown popover.
 *
 * The number is REAL cash (Modal + Gemini + fal + other, fed by
 * ledger.jsonl rollups the DGX pushes after every render).
 *
 * Token counts were REMOVED 2026-08-08 (Jared: "the tokens used lets just
 * kill that part, it will never update correctly it doesnt matter") — they
 * rode the Max plan at $0, never affected the headline, and the count was
 * an unreliable ±30% estimate. Dollars and the stage breakdown only.
 */
export function VaterCostPill(): React.ReactElement | null {
  const { t } = useTheme();
  const data = useVaterLatest();
  const [open, setOpen] = React.useState(false);
  const c = data?.costs;
  const b = data?.billing;
  if (!c) return null;
  // ONE number on the tab: compute at cost + render operations. The popover
  // carries the full breakdown — every cost category, plain one-liners, no
  // parentheses. Rows come from the server so a new category (a notebook
  // run, a new provider) appears here without touching this component.
  const totalUsd =
    b?.totalUsd ?? c.claudeUsd + c.modalUsd + c.geminiUsd + c.falUsd + c.otherUsd;
  const paidUsd = b?.paidUsd ?? 0;
  const dueUsd = b?.dueUsd ?? Math.max(0, totalUsd - paidUsd);
  // Two stacks in the popover: what the CURRENT DUE is made of (the number
  // that resets when Jared records a Zelle), then the all-time history. The
  // due rows come from the server already reconciled — they sum to dueUsd.
  const since = b?.since ?? null;
  const dueRows: { label: string; value: string; dim?: boolean }[] = since
    ? [
        ...since.rows.map((row) => ({
          label: row.label,
          value: `${row.usd < 0 ? '−' : ''}$${Math.abs(row.usd).toFixed(2)}`,
          dim: true,
        })),
        { label: 'Current due', value: `$${dueUsd.toFixed(2)}` },
      ]
    : [];
  const rows: { label: string; value: string; dim?: boolean }[] = b
    ? [
        ...(b.breakdown ?? []).map((row) => ({
          label: row.label,
          value: `$${row.usd.toFixed(2)}`,
          dim: true,
        })),
        { label: 'Compute', value: `$${b.computeUsd.toFixed(2)}` },
        { label: 'Render operations', value: `$${b.opsUsd.toFixed(2)}` },
        { label: 'All-time total', value: `$${b.totalUsd.toFixed(2)}` },
        { label: 'Paid', value: `−$${paidUsd.toFixed(2)}` },
      ]
    : [
        { label: 'Modal GPU', value: `$${c.modalUsd.toFixed(2)}` },
        { label: 'Gemini', value: `$${c.geminiUsd.toFixed(2)}` },
        { label: 'fal.ai', value: `$${c.falUsd.toFixed(2)}` },
        { label: 'Other', value: `$${c.otherUsd.toFixed(2)}` },
      ];
  const sinceLabel = since
    ? since.from
      ? `New since last payment (${timeAgo(since.from)})`
      : 'What makes up this bill'
    : '';
  return (
    <div
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ position: 'relative', display: 'flex' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: JELLY_TOKENS.radius.full,
          border: `1px solid ${t.border}`,
          fontSize: 12,
          color: t.textSecondary,
          fontFamily: JELLY_TOKENS.font,
          cursor: 'default',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: GREEN, fontWeight: 700 }}>≈</span>
        <span>${dueUsd.toFixed(2)}</span>
        <span style={{ opacity: 0.6, fontSize: 10 }}>due</span>
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 120,
            minWidth: 280,
            padding: '12px 14px',
            borderRadius: JELLY_TOKENS.radius.lg,
            border: `1px solid ${t.border}`,
            background: t.card,
            boxShadow: JELLY_TOKENS.shadow4,
            fontFamily: JELLY_TOKENS.font,
            fontSize: 12,
            color: t.text,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Current due — ${dueUsd.toFixed(2)} · All-time ${totalUsd.toFixed(2)}
          </div>
          {dueRows.length > 0 && (
            <>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: GREEN,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {sinceLabel}
              </div>
              {dueRows.map((r) => (
                <div
                  key={`due-${r.label}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '3px 0',
                    color: r.dim ? t.textSecondary : t.text,
                  }}
                >
                  <span>{r.label}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {r.value}
                  </span>
                </div>
              ))}
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: t.textSecondary,
                  fontWeight: 700,
                  margin: '10px 0 4px',
                  paddingTop: 8,
                  borderTop: `1px solid ${t.border}`,
                }}
              >
                All time
              </div>
            </>
          )}
          {rows.map((r) => (
            <div
              key={r.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                padding: '3px 0',
                color: r.dim ? t.textSecondary : t.text,
              }}
            >
              <span>{r.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {r.value}
              </span>
            </div>
          ))}
          <div
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${t.border}`,
              color: t.textSecondary,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            Real cash across every provider, auto-pushed after each render
            and reconciled against provider dashboards. Per-video totals
            live on each Library card.
            {c.note ? (
              <>
                <br />
                Note: {c.note}
              </>
            ) : null}
            <br />
            Updated {timeAgo(c.updatedAt)}
          </div>
        </div>
      )}
    </div>
  );
}
