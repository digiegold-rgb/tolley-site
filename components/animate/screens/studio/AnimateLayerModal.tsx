'use client';

/* AnimateLayerModal — quote + kickoff + poll for the Library motion layer.
 *
 * Cinema billing is always an Admit One ticket. The GPU path is the existing
 * animate-all batch; this modal is the customer gate in front of it.
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { JELLY_TOKENS } from '../../tokens';
import { useTheme } from '../../theme-context';
import { VBtn, RetryError } from '../../primitives';
import { AdmitOneTicket, MicroLabel } from '../../cinema';
import {
  BillingBlockModal,
  readBillingBlock,
  type BillingBlockContext,
  type BillingBlockReason,
} from '../editor/BillingBlock';
import {
  ANIMATE_LAYER_DEFAULT_QUALITY,
  ANIMATE_LAYER_QUALITIES,
  ANIMATE_LAYER_WINDOW_S,
  type AnimateLayerQuality,
} from '@/lib/vater/animate-layer';
import { animationOptionLabel, formatPrice } from '@/lib/vater/pricing';
import type { AnimationQuality } from '@/lib/vater/video-spec';

export interface AnimateLayerQuote {
  ok: boolean;
  windowS: number;
  quality: AnimateLayerQuality;
  qualityLabel: string;
  priceCentsPerClip: number;
  sceneCount: number;
  sceneIdxs: number[];
  coverageStartS: number;
  coverageEndS: number;
  coverageLabel: string;
  timed: boolean;
  fallback: string;
  skippedAnimatedCount: number;
  estimateCents: number;
  estimateUsd: number;
  limit: string;
  finished: boolean;
  hasWorkDir: boolean;
  inFlight: {
    animateAllJobId: string;
    startedAt: string;
    polling: { jobUrl: string; finalizeUrl: string };
  } | null;
  error?: string;
}

type PollState = {
  phase: string;
  status: string;
  done: number;
  failed: number;
  recentLogs: string[];
};

const POLL_MS = 5000;

export function AnimateLayerModal({
  projectId,
  projectTitle,
  open,
  onClose,
  onStarted,
}: {
  projectId: string;
  projectTitle: string;
  open: boolean;
  onClose: () => void;
  onStarted?: () => void;
}): React.ReactElement | null {
  const { t } = useTheme();
  const [quality, setQuality] = React.useState<AnimateLayerQuality>(
    ANIMATE_LAYER_DEFAULT_QUALITY,
  );
  const [force, setForce] = React.useState(false);
  const [quote, setQuote] = React.useState<AnimateLayerQuote | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [kicking, setKicking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [poll, setPoll] = React.useState<PollState | null>(null);
  const [pollingUrls, setPollingUrls] = React.useState<{
    jobUrl: string;
    finalizeUrl: string;
  } | null>(null);
  const [doneNote, setDoneNote] = React.useState<string | null>(null);
  const [billing, setBilling] = React.useState<{
    reason: BillingBlockReason;
    context: BillingBlockContext;
  } | null>(null);

  const pollingRef = React.useRef(pollingUrls);
  pollingRef.current = pollingUrls;

  const loadQuote = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ quality });
      if (force) q.set('force', '1');
      const res = await fetch(
        `/api/vater/youtube/${projectId}/animate-layer?${q}`,
        { cache: 'no-store' },
      );
      const data = (await res.json().catch(() => ({}))) as AnimateLayerQuote;
      if (!res.ok) {
        setError(data.error || `Could not quote this layer (HTTP ${res.status})`);
        setQuote(null);
        return;
      }
      setQuote(data);
      if (data.inFlight && !pollingRef.current) {
        const started = Date.parse(data.inFlight.startedAt);
        const young =
          Number.isFinite(started) && Date.now() - started < 3 * 60 * 60 * 1000;
        if (young) {
          try {
            const jobRes = await fetch(data.inFlight.polling.jobUrl, {
              cache: 'no-store',
            });
            const job = (await jobRes.json().catch(() => ({}))) as {
              status?: string;
            };
            const live =
              jobRes.ok &&
              job.status !== 'done' &&
              job.status !== 'failed';
            if (live) {
              setPollingUrls(data.inFlight.polling);
              setPoll({
                phase: 'running',
                status: job.status ?? 'running',
                done: 0,
                failed: 0,
                recentLogs: ['Resuming the layer already in flight…'],
              });
            }
          } catch {
            /* quote still stands; user can kick off or wait */
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setLoading(false);
    }
  }, [projectId, quality, force]);

  React.useEffect(() => {
    if (!open) return;
    void loadQuote();
  }, [open, loadQuote]);

  React.useEffect(() => {
    if (!open || !pollingUrls) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const jobRes = await fetch(pollingUrls.jobUrl, { cache: 'no-store' });
        if (!jobRes.ok || cancelled) return;
        const job = (await jobRes.json()) as {
          status?: string;
          phase?: string;
          error?: string;
          logs?: string[];
        };
        const logs = Array.isArray(job.logs) ? job.logs : [];
        const done = logs.filter((l) => /scene \d+ written/i.test(l)).length;
        const failed = logs.filter((l) => /scene \d+ FAILED/i.test(l)).length;
        if (cancelled) return;
        setPoll({
          phase: job.phase ?? 'running',
          status: job.status ?? 'running',
          done,
          failed,
          recentLogs: logs.slice(-4),
        });
        if (job.status === 'failed') {
          setError(job.error || 'Motion layer failed on the GPU.');
          setPollingUrls(null);
          return;
        }
        if (job.status === 'done') {
          const fin = await fetch(pollingUrls.finalizeUrl, { method: 'POST' });
          const finData = (await fin.json().catch(() => ({}))) as {
            error?: string;
            succeeded?: number;
            total?: number;
          };
          if (!fin.ok) {
            setError(finData.error || `Finalize failed (HTTP ${fin.status})`);
            setPollingUrls(null);
            return;
          }
          setDoneNote(
            `Motion is on the scenes (${finData.succeeded ?? 0}/${finData.total ?? 0}). Re-compose from the player to bake it into the final cut — compose is billed separately.`,
          );
          setPollingUrls(null);
          setPoll(null);
          void loadQuote();
        }
      } catch {
        /* keep the last frame; next tick retries */
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, pollingUrls, loadQuote]);

  const kickoff = React.useCallback(async () => {
    setKicking(true);
    setError(null);
    setDoneNote(null);
    try {
      const res = await fetch(`/api/vater/youtube/${projectId}/animate-layer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality, force }),
      });
      if (res.status === 402) {
        const { reason, context, data } = await readBillingBlock(res);
        if (reason) {
          setBilling({ reason, context });
          return;
        }
        setError(data.error || 'Payment required.');
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        retryAfterSeconds?: number;
        polling?: { jobUrl: string; finalizeUrl: string };
        sceneCount?: number;
      };
      if (res.status === 429) {
        const s =
          typeof data.retryAfterSeconds === 'number'
            ? Math.ceil(data.retryAfterSeconds)
            : null;
        setError(
          s !== null
            ? `Rate limited — retry in ${s}s.`
            : 'Rate limited — try again in a moment.',
        );
        return;
      }
      if (!res.ok) {
        setError(data.error || `Could not start the layer (HTTP ${res.status})`);
        return;
      }
      if (data.polling) {
        setPollingUrls(data.polling);
        setPoll({
          phase: 'starting',
          status: 'running',
          done: 0,
          failed: 0,
          recentLogs: [`Queuing ${data.sceneCount ?? 0} clips…`],
        });
        onStarted?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'network error');
    } finally {
      setKicking(false);
    }
  }, [projectId, quality, force, onStarted]);

  if (!open) return null;

  const sceneCount = quote?.sceneCount ?? 0;
  const estimateCents = quote?.estimateCents ?? 0;
  const inFlight = Boolean(pollingUrls);
  const canKick =
    !loading &&
    !kicking &&
    !inFlight &&
    Boolean(quote?.finished && quote.hasWorkDir && sceneCount > 0);

  const body = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Opening motion layer"
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
        if (e.target === e.currentTarget && !inFlight) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: t.panel,
          border: `1px solid ${t.borderStrong}`,
          borderRadius: JELLY_TOKENS.radius.xxl,
          boxShadow: JELLY_TOKENS.shadow24,
          padding: 22,
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <MicroLabel tone="violet" size={10.5} tracking="0.22em">
          Opening motion
        </MicroLabel>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: t.text,
            marginTop: 6,
            fontFamily: JELLY_TOKENS.fontSerif,
            fontStyle: 'italic',
          }}
        >
          Animate the first {ANIMATE_LAYER_WINDOW_S}s
        </div>
        <div
          style={{
            fontSize: 13,
            color: t.textSecondary,
            marginTop: 6,
            lineHeight: 1.6,
          }}
        >
          {projectTitle}
        </div>

        <label
          style={{
            display: 'block',
            marginTop: 16,
            fontSize: 12,
            color: t.textSecondary,
          }}
        >
          Quality
          <select
            value={quality}
            disabled={inFlight || kicking}
            onChange={(e) =>
              setQuality(e.target.value as AnimateLayerQuality)
            }
            style={{
              display: 'block',
              width: '100%',
              marginTop: 6,
              padding: '8px 10px',
              borderRadius: JELLY_TOKENS.radius.md,
              border: `1px solid ${t.border}`,
              background: t.card,
              color: t.text,
              fontSize: 13,
              fontFamily: JELLY_TOKENS.font,
            }}
          >
            {ANIMATE_LAYER_QUALITIES.map((id) => (
              <option key={id} value={id}>
                {animationOptionLabel(id as AnimationQuality)}
              </option>
            ))}
          </select>
        </label>

        {loading && !quote ? (
          <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 16 }}>
            Quoting the opening window…
          </div>
        ) : quote ? (
          <AdmitOneTicket
            label="ADMIT ONE"
            state={inFlight ? 'NOW FILMING' : 'ESTIMATE'}
            totalUsd={quote.estimateUsd}
            rows={[
              {
                key: 'clips',
                label: `${quote.sceneCount} Wan clip${quote.sceneCount === 1 ? '' : 's'}`,
                usd: quote.estimateUsd,
                detail: `${formatPrice(quote.priceCentsPerClip)}/clip`,
              },
            ]}
            notes={[
              { label: 'Coverage', value: quote.coverageLabel || '—' },
              { label: 'Window', value: `first ${quote.windowS}s` },
              ...(quote.skippedAnimatedCount
                ? [
                    {
                      label: 'Already in motion',
                      value: String(quote.skippedAnimatedCount),
                      tone: 'faint' as const,
                    },
                  ]
                : []),
            ]}
            footer={quote.limit}
            style={{ marginTop: 16 }}
            data-testid="animate-layer-ticket"
          />
        ) : null}

        {quote && quote.skippedAnimatedCount > 0 && !inFlight && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
              fontSize: 12,
              color: t.textSecondary,
            }}
          >
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
            />
            Re-run clips that already have motion
          </label>
        )}

        {poll && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: t.textSecondary,
                marginBottom: 6,
              }}
            >
              <span>{poll.phase}</span>
              <span>
                {poll.done} done
                {poll.failed ? ` · ${poll.failed} failed` : ''}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: JELLY_TOKENS.radius.pill,
                background: t.cardAlt,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${
                    sceneCount > 0
                      ? Math.min(100, (poll.done / sceneCount) * 100)
                      : poll.status === 'done'
                        ? 100
                        : 12
                  }%`,
                  height: '100%',
                  background: JELLY_TOKENS.cyan,
                  transition: 'width 600ms ease',
                }}
              />
            </div>
            {poll.recentLogs[0] && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: t.textFaint,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {poll.recentLogs[poll.recentLogs.length - 1]}
              </div>
            )}
          </div>
        )}

        {doneNote && (
          <div
            style={{
              marginTop: 14,
              fontSize: 13,
              color: t.textSecondary,
              lineHeight: 1.55,
            }}
          >
            {doneNote}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12 }}>
            <RetryError message={error} />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 20,
          }}
        >
          <VBtn
            size="sm"
            variant="ghost"
            onClick={onClose}
            data-testid="animate-layer-close"
          >
            {inFlight ? 'Hide' : 'Cancel'}
          </VBtn>
          <VBtn
            size="sm"
            onClick={() => void kickoff()}
            disabled={!canKick}
            data-testid="animate-layer-confirm"
          >
            {kicking
              ? 'Queuing…'
              : inFlight
                ? 'In flight…'
                : sceneCount === 0
                  ? 'Nothing to animate'
                  : `Confirm — ${formatPrice(estimateCents)}`}
          </VBtn>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(body, document.body)}
      <BillingBlockModal
        reason={billing?.reason ?? null}
        context={billing?.context}
        projectId={projectId}
        onClose={() => setBilling(null)}
      />
    </>
  );
}
