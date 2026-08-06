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

/** Header pill: estimated total Vater spend. Monitoring only. */
export function VaterCostPill(): React.ReactElement | null {
  const { t } = useTheme();
  const data = useVaterLatest();
  const c = data?.costs;
  if (!c) return null;
  const totalUsd = c.claudeUsd + c.modalUsd + c.geminiUsd + c.falUsd + c.otherUsd;
  const title = [
    `Estimated Vater build+production spend (variance expected):`,
    `Claude ~${fmtTokens(c.claudeTokens)} tokens ≈ $${c.claudeUsd.toFixed(2)}`,
    `Modal $${c.modalUsd.toFixed(2)} · Gemini $${c.geminiUsd.toFixed(2)} · fal $${c.falUsd.toFixed(2)} · other $${c.otherUsd.toFixed(2)}`,
    c.note ? `Note: ${c.note}` : '',
    `Updated ${timeAgo(c.updatedAt)}`,
  ]
    .filter(Boolean)
    .join('\n');
  return (
    <div
      title={title}
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
  );
}
