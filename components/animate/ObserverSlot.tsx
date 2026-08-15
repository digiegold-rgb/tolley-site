'use client';

/* ObserverSlot — right-side slide-out Vater Observer.
 *
 * This used to return an empty fragment while observer/ObserverPanel.tsx sat
 * unmounted, so the Observer never appeared for anyone. It is now mounted for
 * owner-tier accounts only: /api/vater/observer/* is gated by
 * requireVaterAdminApiSession, so mounting it for a customer would just open
 * an SSE that 401s.
 *
 * No extra providers are needed — ActiveJobContext ships a no-op default
 * (scope falls back to "all") and VaterObserverSidebar owns its own state.
 */

import * as React from 'react';
import { useTier } from './tier-context';
import { useActiveJob } from './observer/active-job-context';
import { ObserverPanel } from './observer/ObserverPanel';

export function ObserverSlot(): React.ReactElement | null {
  const { capabilities } = useTier();
  const { activeJobId } = useActiveJob();
  if (!capabilities.observer) return null;
  return <ObserverPanel activeJobId={activeJobId} />;
}
