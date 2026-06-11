'use client';

/* ObserverPanel — v2-themed wrapper around the existing Vater Observer
 * (components/vater/VaterObserverSidebar.tsx).
 *
 * Why we wrap rather than rewrite:
 *   The legacy sidebar already implements the full SSE + scope-toggle +
 *   localStorage("vater:observer:collapsed:v1") + apply/dismiss flow against
 *   a stable bearer-authed backend. Re-implementing it here would risk
 *   regressing scope=active, the stream auth contract, and the proposal
 *   record shape. Instead this panel:
 *     1. forwards `activeJobId` (null/undefined ⇒ scope=all)
 *     2. preserves the same collapse-state localStorage key
 *     3. lets the existing Tailwind classes remain in place — the legacy
 *        sidebar is already styled to be a fixed right-edge slide-out and
 *        the v2 shell does not control its layout.
 *
 * Scope auto-narrowing:
 *   The legacy component already auto-falls-back to "all" when activeJobId
 *   is null (see line 65 of VaterObserverSidebar.tsx). We just pass the
 *   value through; no extra logic needed here.
 *
 * Apply-vs-manual disclosure (Risk 4 from spec):
 *   The "Apply" button only auto-executes for actionType=regen_scene; other
 *   types mark applied with manual-execution note. The legacy sidebar
 *   already surfaces this via item.resultSummary in a black-background
 *   box (line 318-322). We rely on that existing UX.
 */

import * as React from 'react';
import { VaterObserverSidebar } from '../../vater/VaterObserverSidebar';

export interface ObserverPanelProps {
  /** Currently-active autopilot job id from ActiveJobContext, if any. */
  activeJobId?: string | null;
}

export function ObserverPanel({
  activeJobId,
}: ObserverPanelProps): React.ReactElement {
  return <VaterObserverSidebar activeJobId={activeJobId ?? null} />;
}
