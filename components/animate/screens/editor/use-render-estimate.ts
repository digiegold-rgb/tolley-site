'use client';

/* useRenderEstimate — the Visuals step's "est. $X.XX" for a project.
 *
 * Extracted verbatim from VisualsStep.tsx (2026-08-19) so the engine picker
 * and the EngineBar can quote the SAME number the Visuals step shows without
 * importing a 2,000-line component. Behaviour unchanged.
 *
 * Not to be confused with lib/vater/use-estimate.ts (the full RenderEstimate
 * breakdown hook the 402 wall uses) — this one is the two-number draft/full
 * quote and tolerates the route being absent (404/501 → "est. —").
 */

import * as React from 'react';

/* ─── Render estimate ─────────────────────────────────────────────────────
 * GET /api/vater/youtube/[id]/estimate → { draftUsd, fullUsd, breakdown }.
 * That route is lane-billing's; until it exists (or while the DGX side is
 * still being built) it answers 404/501 and we show "est. —" rather than an
 * error. Pure math on the server — polling it never spends anything.
 */
export interface RenderEstimate {
  draftUsd: number | null;
  fullUsd: number | null;
  /** True while the first fetch is in flight — the caller shows "est. …". */
  loading: boolean;
}

export function useRenderEstimate(projectId: string | null): RenderEstimate {
  const [state, setState] = React.useState<RenderEstimate>({
    draftUsd: null,
    fullUsd: null,
    loading: !!projectId,
  });

  React.useEffect(() => {
    if (!projectId) {
      setState({ draftUsd: null, fullUsd: null, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/vater/youtube/${projectId}/estimate`,
          { cache: 'no-store' },
        );
        if (!res.ok) {
          if (!cancelled) {
            setState({ draftUsd: null, fullUsd: null, loading: false });
          }
          return;
        }
        const data = (await res.json()) as {
          draftUsd?: number;
          fullUsd?: number;
        };
        if (cancelled) return;
        setState({
          draftUsd: typeof data.draftUsd === 'number' ? data.draftUsd : null,
          fullUsd: typeof data.fullUsd === 'number' ? data.fullUsd : null,
          loading: false,
        });
      } catch {
        if (!cancelled) {
          setState({ draftUsd: null, fullUsd: null, loading: false });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return state;
}
