'use client';

/* TierContext — client-side mirror of GET /api/vater/me.
 *
 * Mounted once in Shell.tsx. Every gated surface reads from here instead of
 * fetching a 401 and rendering a broken card. While the fetch is in flight
 * we assume the LOWEST tier (public, all capabilities false) so nothing
 * owner-only ever flashes on screen for a customer.
 */

import * as React from 'react';
import type { VaterTier } from '@/lib/vater/nav-visibility';
import { routeIdsForTier } from '@/lib/vater/nav-visibility';

export interface VaterCapabilities {
  rules: boolean;
  direct: boolean;
  course: boolean;
  latestCosts: boolean;
  voicesRead: boolean;
  voicesWrite: boolean;
  pipelineStatus: boolean;
  rss: boolean;
  chat: boolean;
  observer: boolean;
  publishingPosts: boolean;
}

export interface BetaState {
  invited: boolean;
  accessAllowed: boolean;
  termsAccepted: boolean;
  tosVersion: string | null;
}

export type ScriptCapTier = 'owner' | 'paid' | 'beta';

export interface TierContextValue {
  tier: VaterTier;
  /**
   * Script length ceiling for this account, from GET /api/vater/me — the SAME
   * number the from-script and context routes enforce. Infinity = uncapped
   * (owner). Defaults to the beta floor so a slow /me fetch can never let a
   * script through that the API will then reject.
   */
  maxWords: number;
  /** Why that ceiling: 'beta' means buying credit raises it. */
  capTier: ScriptCapTier;
  capabilities: VaterCapabilities;
  routes: string[];
  loading: boolean;
  email: string | null;
  beta: BetaState;
  /** Optimistic local update after the click-wrap modal succeeds. */
  markTermsAccepted: () => void;
}

const EMPTY_CAPS: VaterCapabilities = {
  rules: false,
  direct: false,
  course: false,
  latestCosts: false,
  voicesRead: false,
  voicesWrite: false,
  pipelineStatus: false,
  rss: false,
  chat: false,
  observer: false,
  publishingPosts: false,
};

const DEFAULT_BETA: BetaState = {
  // Optimistic defaults so a transient /me failure never locks anyone out.
  invited: true,
  accessAllowed: true,
  termsAccepted: true,
  tosVersion: null,
};

const defaultValue: TierContextValue = {
  tier: 'public',
  // Uncapped by default (2026-08-22). GET /api/vater/me sends null for
  // "no cap", which the reducer below maps to Infinity.
  maxWords: Number.POSITIVE_INFINITY,
  capTier: 'beta',
  capabilities: EMPTY_CAPS,
  routes: routeIdsForTier('public'),
  loading: true,
  email: null,
  beta: DEFAULT_BETA,
  markTermsAccepted: () => {},
};

interface MePayload {
  tier?: VaterTier;
  maxWords?: number | null;
  capTier?: ScriptCapTier;
  email?: string | null;
  capabilities?: Partial<VaterCapabilities>;
  routes?: string[];
  beta?: Partial<BetaState>;
}

export const TierContext = React.createContext<TierContextValue>(defaultValue);

/**
 * Context-free capability lookup, memoised for the lifetime of the page.
 *
 * Legacy components under components/vater/* render both inside the /animate
 * Shell (TierProvider present) and on /vater/youtube (no provider), so they
 * can't use useTier(). They call this instead to avoid firing owner-only
 * requests — /api/vater/latest was hitting a 401 on every screen for a
 * public account.
 */
let capsPromise: Promise<VaterCapabilities> | null = null;

export function fetchVaterCapabilities(): Promise<VaterCapabilities> {
  if (capsPromise) return capsPromise;
  capsPromise = (async () => {
    try {
      const r = await fetch('/api/vater/me', { cache: 'no-store' });
      if (!r.ok) return EMPTY_CAPS;
      const data = (await r.json()) as MePayload;
      return { ...EMPTY_CAPS, ...(data.capabilities ?? {}) };
    } catch {
      return EMPTY_CAPS;
    }
  })();
  return capsPromise;
}

export function useTier(): TierContextValue {
  return React.useContext(TierContext);
}

export function TierProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [state, setState] = React.useState<TierContextValue>(defaultValue);
  const markTermsAccepted = React.useCallback(() => {
    setState((prev) => ({ ...prev, beta: { ...prev.beta, termsAccepted: true } }));
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/vater/me', { cache: 'no-store' });
        if (!r.ok) {
          // Signed out or transient failure — stay at the public floor but
          // stop showing the loading skeleton forever.
          if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
          return;
        }
        const data = (await r.json()) as MePayload;
        if (cancelled) return;
        const tier: VaterTier = data.tier ?? 'public';
        setState((prev) => ({
          ...prev,
          tier,
          // null from the API means "no cap" (owner), which is Infinity here
          // so every `words > maxWords` comparison reads the same way.
          maxWords:
            data.maxWords === null
              ? Number.POSITIVE_INFINITY
              : typeof data.maxWords === 'number'
                ? data.maxWords
                : prev.maxWords,
          capTier: data.capTier ?? prev.capTier,
          capabilities: { ...EMPTY_CAPS, ...(data.capabilities ?? {}) },
          routes: data.routes ?? routeIdsForTier(tier),
          loading: false,
          email: data.email ?? null,
          beta: { ...DEFAULT_BETA, ...(data.beta ?? {}) },
        }));
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = React.useMemo(() => ({ ...state, markTermsAccepted }), [state, markTermsAccepted]);
  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
}
