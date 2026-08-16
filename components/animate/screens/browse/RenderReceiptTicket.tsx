'use client';

/* RenderReceiptTicket — the itemised receipt for one finished video, as an
 * ADMIT ONE ticket.
 *
 * GET /api/vater/youtube/[id]/receipt already returns exactly what a box-office
 * stub needs: the per-stage compute lines, the ops fee with its own rate, what
 * was actually debited, any refund, and the repair cap when it fired. This
 * renders those numbers and nothing else — no estimates dressed as charges, no
 * invented rows. See memory vater-billing-ops-fee ("he doesn't have to wonder
 * where all the money is spent").
 *
 * Two modes:
 *   • projectId          → fetch the receipt (signed-in library / editor)
 *   • receipt (prop)     → render a receipt we already hold, no fetch. This is
 *                          how /animate/demo shows DEMO_RECEIPT to a stranger:
 *                          the route would 401, and the demo numbers are real.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { RetryError } from '../../primitives';
import { AdmitOneTicket, MicroLabel, type TicketNote, type TicketRow } from '../../cinema';

/** GET /api/vater/youtube/[id]/receipt */
export interface RenderReceipt {
  computeUsd: number;
  byStage: { key: string; label: string; usd: number }[];
  minutes: number;
  opsRate: number;
  opsUsd: number;
  totalUsd: number;
  estimateUsd: number;
  cappedAt?: number | null;
  debitedCents: number | null;
  refundedCents: number | null;
  refundReason: string | null;
  netChargedCents: number | null;
  wallClockSec: number | null;
  unmetered: boolean;
}

export interface RenderReceiptTicketProps {
  projectId: string;
  /** Shown in the footer alongside the runtime, when we know it. */
  title?: string | null;
  /** Finished runtime in seconds. */
  duration?: number | null;
  /** Pre-loaded receipt — skips the fetch entirely (demo path). */
  receipt?: RenderReceipt;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

const usd = (n: number): string => `$${n.toFixed(2)}`;
const usdc = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

function fmtRuntime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function fmtWallClock(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)}s`;
  const m = Math.round(seconds / 60);
  if (m < 90) return `${m} min`;
  return `${(m / 60).toFixed(1)} hr`;
}

/** Ticket rows: every compute stage that cost something, then the ops fee. */
export function receiptRows(r: RenderReceipt): TicketRow[] {
  const rows: TicketRow[] = r.byStage.map((s) => ({
    key: s.key,
    label: s.label,
    usd: s.usd,
  }));
  rows.push({
    key: 'ops',
    label: 'render ops',
    usd: r.opsUsd,
    detail: `${r.minutes.toFixed(1)} min × $${r.opsRate.toFixed(2)}`,
  });
  return rows;
}

/** Fine print under the dashed rule: what was charged, refunded, capped. */
export function receiptNotes(r: RenderReceipt): TicketNote[] {
  const notes: TicketNote[] = [];

  if (r.unmetered || r.debitedCents === null) {
    notes.push({
      label: 'charged',
      value: r.unmetered ? 'not charged · unmetered' : 'not charged',
      tone: 'cyan',
    });
  } else {
    notes.push({ label: 'charged to credit', value: usdc(r.debitedCents) });
  }

  if (r.refundedCents !== null && r.refundedCents > 0) {
    notes.push({
      label: r.refundReason ? `refunded — ${r.refundReason}` : 'refunded',
      value: `+${usdc(r.refundedCents)}`,
      tone: 'cyan',
    });
    if (r.netChargedCents !== null) {
      notes.push({ label: 'net', value: usdc(r.netChargedCents) });
    }
  }

  if (r.cappedAt !== undefined && r.cappedAt !== null) {
    notes.push({
      label: 'capped — we covered the overrun',
      value: usd(r.cappedAt),
      tone: 'cyan',
    });
  }

  if (r.wallClockSec !== null && r.wallClockSec > 0) {
    notes.push({ label: 'wall clock', value: fmtWallClock(r.wallClockSec), tone: 'faint' });
  }

  return notes;
}

export function RenderReceiptTicket({
  projectId,
  title,
  duration,
  receipt,
  style,
  'data-testid': testId = 'render-receipt-ticket',
}: RenderReceiptTicketProps): React.ReactElement | null {
  const [data, setData] = React.useState<RenderReceipt | null>(receipt ?? null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(!receipt);
  const [reloads, setReloads] = React.useState(0);

  React.useEffect(() => {
    // A receipt handed in is the receipt. Nothing to fetch, nothing to 401.
    if (receipt) {
      setData(receipt);
      setLoading(false);
      setError(null);
      return;
    }
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/vater/youtube/${projectId}/receipt`, {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const body = (await res.json()) as RenderReceipt;
        if (!cancelled) setData(body);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load the receipt');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, receipt, reloads]);

  if (loading) return <ReceiptSkeleton style={style} />;

  if (error) {
    return (
      <RetryError
        message={`Receipt unavailable — ${error}`}
        onRetry={() => setReloads((n) => n + 1)}
        style={style}
      />
    );
  }

  if (!data) return null;

  const runtime =
    typeof duration === 'number' && duration > 0 ? fmtRuntime(duration) : null;
  const footerBits = [
    title ? `«${title}»` : null,
    runtime,
    'a real render, a real receipt · overruns capped, we absorb the rest',
  ].filter(Boolean);

  return (
    <AdmitOneTicket
      data-testid={testId}
      size="card"
      label="ADMIT ONE — RECEIPT"
      state="FADE TO BLACK — MP4 READY"
      totalUsd={data.totalUsd}
      rows={receiptRows(data)}
      notes={receiptNotes(data)}
      footer={footerBits.join(' · ')}
      style={style}
    />
  );
}

/* Loading state keeps the ticket's shape so the panel doesn't jump when the
 * numbers land. */
function ReceiptSkeleton({ style }: { style?: React.CSSProperties }): React.ReactElement {
  const { t } = useTheme();
  const bar = (w: string | number, h: number): React.ReactElement => (
    <div
      className="jc-fadein"
      style={{
        width: w,
        height: h,
        borderRadius: JELLY_TOKENS.radius.xs,
        background: t.hover,
      }}
    />
  );
  return (
    <div
      data-testid="render-receipt-skeleton"
      aria-busy="true"
      style={{
        background: JELLY_TOKENS.gradTicket,
        border: `1px solid ${JELLY_TOKENS.brandOutline}`,
        borderRadius: JELLY_TOKENS.radius.xxl,
        padding: 22,
        backdropFilter: t.glassBlur,
        WebkitBackdropFilter: t.glassBlur,
        fontFamily: JELLY_TOKENS.font,
        ...style,
      }}
    >
      <MicroLabel tone="violet" size={11} tracking="0.24em">
        ADMIT ONE — RECEIPT
      </MicroLabel>
      <div style={{ marginTop: 8 }}>{bar(150, 40)}</div>
      <div style={{ borderTop: `1px dashed ${t.borderStrong}`, margin: '18px 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {bar('70%', 12)}
        {bar('55%', 12)}
        {bar('62%', 12)}
      </div>
    </div>
  );
}
