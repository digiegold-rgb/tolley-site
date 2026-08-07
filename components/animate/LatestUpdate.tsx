'use client';

/* LatestUpdate — green pulsing "what's new" surfaces + estimated cost pill.
 *
 * Data source: GET /api/vater/latest (studio session). One fetch per mount,
 * shared by three consumers:
 *   - LatestUpdateBanner  — top of DashboardScreen (full banner)
 *   - LatestUpdateStrip   — Library header (compact one-liner)
 *   - VaterCostPill       — Header top-right (≈$ · tokens, estimate only)
 *
 * "Seen" state is per-browser via localStorage: the dot keeps blinking until
 * the user clicks the banner, then it goes steady for that update id.
 * Inline styles only (v2 shell contract — no Tailwind, no new deps).
 */

import * as React from 'react';
import { JELLY_TOKENS } from './tokens';
import { useTheme, useRoute } from './theme-context';

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
  claudeTokens: number;
  claudeUsd: number;
  modalUsd: number;
  geminiUsd: number;
  falUsd: number;
  otherUsd: number;
  note: string | null;
  updatedAt: string;
}

interface LatestPayload {
  updates: VaterUpdateRow[];
  costs: VaterCosts | null;
}

export function useVaterLatest(): LatestPayload | null {
  const [data, setData] = React.useState<LatestPayload | null>(null);
  React.useEffect(() => {
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
  }, []);
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

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

/** Header pill: all-time Vater spend with a hover breakdown popover.
 *
 * The number is REAL cash (Modal + Gemini + fal + other, fed by
 * ledger.jsonl rollups the DGX pushes after every render). Claude tokens
 * ride the Max plan and are shown as a count at $0 — never folded into
 * the headline (Jared's cost-counter convention, 2026-08-06).
 */
export function VaterCostPill(): React.ReactElement | null {
  const { t } = useTheme();
  const data = useVaterLatest();
  const [open, setOpen] = React.useState(false);
  const c = data?.costs;
  if (!c) return null;
  const totalUsd = c.claudeUsd + c.modalUsd + c.geminiUsd + c.falUsd + c.otherUsd;
  const rows: { label: string; value: string; dim?: boolean }[] = [
    { label: 'Modal GPU (stills + animation)', value: `$${c.modalUsd.toFixed(2)}` },
    { label: 'Gemini (images + vision)', value: `$${c.geminiUsd.toFixed(2)}` },
    { label: 'fal.ai (Kling/Luma clips)', value: `$${c.falUsd.toFixed(2)}` },
    { label: 'Other (hosted LLM, misc APIs)', value: `$${c.otherUsd.toFixed(2)}` },
    {
      label: `Claude ~${fmtTokens(c.claudeTokens)} tokens (Max plan)`,
      value: c.claudeUsd > 0 ? `$${c.claudeUsd.toFixed(2)}` : '$0.00',
      dim: true,
    },
  ];
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
        <span>
          ${totalUsd.toFixed(2)} · {fmtTokens(c.claudeTokens)} tok
        </span>
        <span style={{ opacity: 0.6, fontSize: 10 }}>est.</span>
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
            All-time Vater spend — ${totalUsd.toFixed(2)}
          </div>
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
