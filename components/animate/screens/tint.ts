/* Status washes for the studio screens.
 *
 * The cinema tokens give us the status HUES (success / error / warning / cyan)
 * but not the 8–12% fills that sit behind an inline notice. Rather than let 20
 * screens each invent their own `rgba(220,38,38,0.08)` — which is how the
 * pre-cinema amber/red strays got in — the fills live here once, derived from
 * JELLY_TOKENS and nowhere else.
 *
 * These are the token hues at low alpha:
 *   success #34C98A · error #F0607A · warning #F5B34B · cyan #6FD6FF
 *   brand   #8F7DFF
 *
 * A notice is normally `{ ...TINT_BG.error, color: JELLY_TOKENS.error }` plus
 * the caller's own radius/padding. `TINT_BORDER` is the matching hairline.
 */

export const TINT_BG = {
  success: { background: 'rgba(52,201,138,0.10)' },
  error: { background: 'rgba(240,96,122,0.10)' },
  warning: { background: 'rgba(245,179,75,0.10)' },
  cyan: { background: 'rgba(111,214,255,0.10)' },
  brand: { background: 'rgba(143,125,255,0.10)' },
} as const;

export const TINT_BORDER = {
  success: 'rgba(52,201,138,0.40)',
  error: 'rgba(240,96,122,0.40)',
  warning: 'rgba(245,179,75,0.40)',
  cyan: 'rgba(111,214,255,0.40)',
  brand: 'rgba(143,125,255,0.40)',
} as const;

export type TintKey = keyof typeof TINT_BG;

/* Ink at low alpha — plates, tracks and chips that sit ON the primary
 * gradient (JELLY_TOKENS.onGradient is the same #0A0A14 at full strength).
 * These replaced the `rgba(255,255,255,0.2)` washes that assumed a dark
 * gradient; the cinema gradient is light, so the scrim has to be ink. */
export const ON_GRADIENT_PLATE = 'rgba(10,10,20,0.20)';
