'use client';

/* ProgressBadgeProvider — ONE app-wide poll of GET /api/vater/youtube/
 * progress-summary (2026-08-28).
 *
 * Feeds three things from a single request:
 *   - the sidebar Progress badge (`needsApproval`) + pulse (`active > 0`)
 *   - the Progress screen's rows (no second poll)
 *   - in-app toasts: consecutive payloads are diffed and a row whose `kind`
 *     just became approval / money / terminal / failed gets one toast
 *
 * Cadence: 15 s, 30 s while the tab is hidden, an immediate refetch on
 * visibilitychange and after any step action (`refreshProgress()`). Like the
 * old Queue screen it also kicks `[id]/poll` for ≤ 4 in-flight rows so DGX
 * state keeps flowing into the DB without any screen watching it.
 *
 * Tenant = the session user (a workspace tab is its own user), so badges are
 * per-tab by design.
 */

import * as React from 'react';
import { IN_FLIGHT_STATUSES, type YouTubeProjectStatus } from '@/lib/vater/youtube-status';
import { stepHash, type CreateStepKind } from '@/lib/vater/create-steps';
import { useToast } from './ToastHost';
import { useProduct } from './product-context';

export interface ProgressRow {
  id: string;
  title: string;
  status: string;
  flowStep: number;
  scriptApprovedAt: string | null;
  approvalExpiresAt: string | null;
  updatedAt: string;
  thumbnailUrl: string | null;
  finalVideoUrl: string | null;
  hasTranscript: boolean;
  hasScript: boolean;
  failedPhase: string | null;
  conciergeStage: string | null;
  /** Derived server-side by deriveCreateStep(). */
  step: number;
  kind: CreateStepKind;
  needsUser: boolean;
  active: boolean;
  variationCount: number;
}

export interface ProgressSummary {
  needsApproval: number;
  active: number;
  projects: ProgressRow[];
}

export interface ProgressContextValue extends ProgressSummary {
  /** False until the first payload has landed. */
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY: ProgressSummary = { needsApproval: 0, active: 0, projects: [] };

const ProgressContext = React.createContext<ProgressContextValue>({
  ...EMPTY,
  loaded: false,
  error: null,
  refresh: async () => {},
});

const VISIBLE_MS = 15_000;
const HIDDEN_MS = 30_000;
const MAX_KICKS = 4;

/* Module-level hook so a step action anywhere (approve, produce, rewrite)
 * can pull the badge forward without threading a callback through props. */
let refreshRef: (() => Promise<void>) | null = null;
export function refreshProgress(): void {
  void refreshRef?.();
}

/** Toast copy for a row that just needs the customer. */
function toastFor(row: ProgressRow): { message: string; kind: 'success' | 'error' | 'info' } | null {
  switch (row.kind) {
    case 'approval':
      return { message: 'Your script is ready to review', kind: 'info' };
    case 'money':
      return { message: 'Choose an engine', kind: 'info' };
    case 'terminal':
      return { message: 'Your video is ready', kind: 'success' };
    case 'failed':
      return { message: `Something failed on step ${row.step}`, kind: 'error' };
    default:
      return null;
  }
}

export function ProgressBadgeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { toast } = useToast();
  const brand = useProduct();
  // Listing Studio has no create flow; do not poll a route it never shows.
  const enabled = brand.product === 'jelly';

  const [summary, setSummary] = React.useState<ProgressSummary>(EMPTY);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const prevKinds = React.useRef<Map<string, CreateStepKind> | null>(null);
  const inFlight = React.useRef(false);
  const alive = React.useRef(true);

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch('/api/vater/youtube/progress-summary', { cache: 'no-store' });
      if (!alive.current) return;
      if (res.status === 401) return; // signed out — nothing to badge
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json().catch(() => null)) as ProgressSummary | null;
      if (!alive.current || !data || !Array.isArray(data.projects)) return;
      const next: ProgressSummary = {
        needsApproval: Number(data.needsApproval) || 0,
        active: Number(data.active) || 0,
        projects: data.projects,
      };

      // Diff → toasts. Only rows we saw before count; a first payload after
      // reload must not re-announce everything that is already waiting.
      const prev = prevKinds.current;
      if (prev) {
        for (const row of next.projects) {
          const was = prev.get(row.id);
          if (was === undefined || was === row.kind) continue;
          const copy = toastFor(row);
          if (!copy) continue;
          const id = row.id;
          const step = row.step;
          toast(copy.message, {
            kind: copy.kind,
            onClick: () => {
              window.location.hash = stepHash(id, step);
            },
          });
        }
      }
      prevKinds.current = new Map(next.projects.map((r) => [r.id, r.kind]));

      setSummary(next);
      setError(null);
      setLoaded(true);

      // Keep the DGX state flowing for in-flight rows (Queue.tsx did this).
      next.projects
        .filter((r) => IN_FLIGHT_STATUSES.has(r.status as YouTubeProjectStatus))
        .slice(0, MAX_KICKS)
        .forEach((r) => {
          void fetch(`/api/vater/youtube/${r.id}/poll`).catch(() => undefined);
        });
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : 'poll failed');
    } finally {
      inFlight.current = false;
    }
  }, [enabled, toast]);

  React.useEffect(() => {
    refreshRef = refresh;
    return () => {
      if (refreshRef === refresh) refreshRef = null;
    };
  }, [refresh]);

  React.useEffect(() => {
    alive.current = true;
    if (!enabled) return;
    let timer: number | null = null;
    const schedule = (): void => {
      if (timer !== null) window.clearTimeout(timer);
      const ms = typeof document !== 'undefined' && document.hidden ? HIDDEN_MS : VISIBLE_MS;
      timer = window.setTimeout(() => {
        void refresh().finally(schedule);
      }, ms);
    };
    void refresh().finally(schedule);
    const onVisible = (): void => {
      if (!document.hidden) void refresh().finally(schedule);
      else schedule();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive.current = false;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  const value = React.useMemo<ProgressContextValue>(
    () => ({ ...summary, loaded, error, refresh }),
    [summary, loaded, error, refresh],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

/** Rows + counts for the Progress screen. */
export function useProgressSummary(): ProgressContextValue {
  return React.useContext(ProgressContext);
}

/** What the sidebar needs: the count pill and whether to pulse. */
export function useProgressBadge(): { badge: number; pulse: boolean } {
  const { needsApproval, active } = React.useContext(ProgressContext);
  return { badge: needsApproval, pulse: active > 0 };
}
