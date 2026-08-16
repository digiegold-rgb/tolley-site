'use client';

/**
 * lib/vater/use-estimate.ts — "what will this render cost?" for client code.
 *
 * One hook, so the 402 wall, the render button and anything else that wants to
 * show a price all read the SAME endpoint and therefore the same number. Two
 * components quoting a project independently is how a user ends up being shown
 * $2.10 in one place and $6.30 in another and trusting neither.
 *
 *   const { estimate, loading, error, reload } = useRenderEstimate(projectId);
 *
 * `projectId` may be null/undefined — the hook simply idles, so a caller can
 * mount it unconditionally instead of guarding the hook itself (which would
 * break the rules of hooks).
 *
 * A failed estimate is NOT an error state the caller must handle: `estimate`
 * stays null and the surface renders without a price, exactly as it did before
 * this existed. Nothing in the golden path may be blocked on a quote.
 *
 * Also exports `usePricingRates()`, the public per-minute rates behind the
 * landing-page calculator (GET /api/vater/billing/rate).
 */

import * as React from 'react';

/* lib/vater/billing/estimate.ts is deliberately dependency-free (no prisma,
 * no `server-only`), so the browser can share the exact constants the API
 * quotes from. Do not import anything else out of billing/ here. */
import {
  ESTIMATE_WORDS_PER_MINUTE,
  MOTION_USD_PER_MIN,
  STILLS_USD_PER_MIN,
  type RenderEstimate,
} from '@/lib/vater/billing/estimate';
import { DEFAULT_OPS_RATE_PER_MIN } from '@/lib/vater/video-cost';

export type { RenderEstimate };

export interface UseRenderEstimate {
  estimate: RenderEstimate | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch — the estimate moves when the script or target length does. */
  reload: () => void;
}

export function useRenderEstimate(
  projectId: string | null | undefined,
): UseRenderEstimate {
  const [estimate, setEstimate] = React.useState<RenderEstimate | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    if (!projectId) {
      setEstimate(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/vater/youtube/${encodeURIComponent(projectId)}/estimate`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as RenderEstimate;
        if (!cancelled) setEstimate(data);
      } catch (err) {
        if (!cancelled) {
          setEstimate(null);
          setError(err instanceof Error ? err.message : 'Estimate unavailable');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, nonce]);

  return { estimate, loading, error, reload };
}

export interface PricingRates {
  opsRatePerMinute: number;
  stillsUsdPerMinute: number;
  motionUsdPerMinute: number;
  wordsPerMinute: number;
}

/**
 * The fallback is the CONFIGURED rate, not a guess: a calculator that renders
 * for a beat before the fetch lands must never flash a price that was never
 * real (same rule as DEFAULT_OPS_RATE_PER_MIN in lib/vater/video-cost.ts).
 */
const FALLBACK_RATES: PricingRates = {
  opsRatePerMinute: DEFAULT_OPS_RATE_PER_MIN,
  stillsUsdPerMinute: STILLS_USD_PER_MIN,
  motionUsdPerMinute: MOTION_USD_PER_MIN,
  wordsPerMinute: ESTIMATE_WORDS_PER_MINUTE,
};

/** Public per-minute rates. Never fails — falls back to the configured ones. */
export function usePricingRates(): { rates: PricingRates; loaded: boolean } {
  const [rates, setRates] = React.useState<PricingRates>(FALLBACK_RATES);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/vater/billing/rate', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as Partial<PricingRates>;
        if (cancelled) return;
        setRates((prev) => ({
          opsRatePerMinute:
            typeof data.opsRatePerMinute === 'number'
              ? data.opsRatePerMinute
              : prev.opsRatePerMinute,
          stillsUsdPerMinute:
            typeof data.stillsUsdPerMinute === 'number'
              ? data.stillsUsdPerMinute
              : prev.stillsUsdPerMinute,
          motionUsdPerMinute:
            typeof data.motionUsdPerMinute === 'number'
              ? data.motionUsdPerMinute
              : prev.motionUsdPerMinute,
          wordsPerMinute:
            typeof data.wordsPerMinute === 'number'
              ? data.wordsPerMinute
              : prev.wordsPerMinute,
        }));
      } catch {
        /* the calculator still works on the configured rates */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rates, loaded };
}
