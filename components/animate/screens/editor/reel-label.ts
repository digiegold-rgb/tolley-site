import { EDITOR_STEPS } from '../../tokens';

/* "REEL 02 — SCRIPT".
 *
 * The seven editor steps are the five-reel motif from the landing page,
 * carried into the product: the same micro-label pattern above every step
 * header so the studio reads as the same picture the marketing page promised.
 * Derived from EDITOR_STEPS, so a step added or renamed there cannot leave a
 * stale label behind. */
export function reelLabel(stepIndex: number): string {
  const step = EDITOR_STEPS[stepIndex] ?? '';
  return `Reel ${String(stepIndex + 1).padStart(2, '0')} — ${step}`;
}
