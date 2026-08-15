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

export interface TierContextValue {
  tier: VaterTier;
  capabilities: VaterCapabilities;
  routes: string[];
  loading: boolean;
  email: string | null;
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

const defaultValue: TierContextValue = {
  tier: 'public',
  capabilities: EMPTY_CAPS,
  routes: routeIdsForTier('public'),
  loading: true,
  email: null,
};

interface MePayload {
  tier?: VaterTier;
  email?: string | null;
  capabilities?: Partial<VaterCapabilities>;
  routes?: string[];
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
        setState({
          tier,
          capabilities: { ...EMPTY_CAPS, ...(data.capabilities ?? {}) },
          routes: data.routes ?? routeIdsForTier(tier),
          loading: false,
          email: data.email ?? null,
        });
      } catch {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <TierContext.Provider value={state}>{children}</TierContext.Provider>;
}
