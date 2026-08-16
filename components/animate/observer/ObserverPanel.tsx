'use client';

/* ObserverPanel — cinema-skinned wrapper around the existing Vater Observer
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
 *     3. re-skins the legacy Tailwind in place
 *
 * The re-skin has two layers. `.jelly-legacy` (app/animate/animate.css) covers
 * the shared zinc/sky/amber utilities. The scoped block below covers what it
 * cannot: this sidebar is written in Tailwind ARBITRARY values
 * (`bg-[#06050a]/95`, `bg-white/[0.02]`, `border-white/10`), which no shared
 * selector can match. Attribute selectors are used instead of class selectors
 * so the `/` in `bg-amber-500/30` needs no CSS escaping. Colours are
 * interpolated from JELLY_TOKENS — nothing here invents a hue.
 *
 * Semantics: connected/live is CYAN (the "● NOW FILMING" colour); pending
 * proposals are VIOLET; applied stays the semantic success green; failed stays
 * the semantic error red.
 *
 * Scope auto-narrowing:
 *   The legacy component already auto-falls-back to "all" when activeJobId
 *   is null (see line 65 of VaterObserverSidebar.tsx). We just pass the
 *   value through; no extra logic needed here.
 *
 * Apply-vs-manual disclosure (Risk 4 from spec):
 *   The "Apply" button only auto-executes for actionType=regen_scene; other
 *   types mark applied with manual-execution note. The legacy sidebar
 *   already surfaces this via item.resultSummary, which we leave alone.
 */

import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';
import { VaterObserverSidebar } from '../../vater/VaterObserverSidebar';

/* The observer inset stays a dark "screening room" in both themes, exactly as
 * `.jelly-legacy` does — one skin to maintain. */
const D = JELLY_TOKENS.dark;
const OBSERVER_SKIN = `
.jc-observer aside,
.jc-observer > button {
  background: ${D.cardAlt} !important;
  border-color: ${D.border} !important;
  color: ${D.text};
  font-family: ${JELLY_TOKENS.font};
  backdrop-filter: ${D.glassBlur};
  -webkit-backdrop-filter: ${D.glassBlur};
  box-shadow: ${JELLY_TOKENS.shadow24};
}
/* Leading space in the substring so hover:bg-white/5 is NOT matched — only
   the resting utility is re-skinned, hover states are left to Tailwind. */
.jc-observer [class*=" border-white/"] { border-color: ${D.border} !important; }
.jc-observer [class*=" bg-white/"] { background: ${D.card} !important; }
.jc-observer [class*=" text-white/8"],
.jc-observer [class*=" text-white/7"] { color: ${D.textSecondary} !important; }
.jc-observer [class*=" text-white/5"],
.jc-observer [class*=" text-white/4"],
.jc-observer [class*=" text-white/3"] { color: ${D.textFaint} !important; }
/* live / connected → cyan */
.jc-observer .bg-emerald-400 { background: ${JELLY_TOKENS.cyan} !important; }
/* pending / attention → violet, never amber */
.jc-observer .bg-amber-400 { background: ${JELLY_TOKENS.brandLight} !important; }
.jc-observer [class*="text-amber-"] { color: ${JELLY_TOKENS.brandLight} !important; }
.jc-observer [class*="bg-amber-500/"] { background: ${JELLY_TOKENS.brandGhost} !important; }
.jc-observer [class*="border-amber-500/"] { border-color: ${JELLY_TOKENS.brandOutline} !important; }
/* active scope chip → the violet→cyan chip tint */
.jc-observer [class*="bg-purple-500/"] { background: ${JELLY_TOKENS.gradChipOn} !important; }
.jc-observer [class*="text-purple-"] { color: ${D.text} !important; }
`;

export interface ObserverPanelProps {
  /** Currently-active autopilot job id from ActiveJobContext, if any. */
  activeJobId?: string | null;
}

export function ObserverPanel({
  activeJobId,
}: ObserverPanelProps): React.ReactElement {
  return (
    <div className="jelly-legacy jc-observer" data-testid="observer-panel">
      <style>{OBSERVER_SKIN}</style>
      <VaterObserverSidebar activeJobId={activeJobId ?? null} />
    </div>
  );
}
