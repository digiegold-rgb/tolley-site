/**
 * JellyMark — the Jelly Studio profile mark, rebuilt in React from the
 * handoff at design/jelly-studio-logo-1c/.
 *
 * A stacked JELLY / STUDIO wordmark in ink on the brand plate, with a
 * monospace TOLLEY.IO sub-line on the full variant. Proportions and type are
 * from that handoff and are final.
 *
 * ⚠️ NOT USED BY THE LANDING. The cinema pass (2026-08-16) replaced the nav
 * and footer lockups with public/animate/brand/logo.svg. This component
 * survives for any surface that still wants a self-contained plate — an OG
 * route, an email header, an avatar export — so it has been re-toned to the
 * violet→cyan gradient. If it ever renders pink again, something has been
 * reverted.
 *
 * ── PROPORTIONS ──────────────────────────────────────────────────────────
 * Everything is expressed as a percentage of the canvas edge, taken from the
 * 340px reference, so the mark is resolution-independent and one `size` prop
 * drives it. Do not hardcode pixel values here — a 48px nav lockup and a
 * 1024px avatar export must be the same drawing.
 *
 *   full     wordmark 17.65% · radius 8.2% · sub-line 3.53% (ls .28em, 72%)
 *   compact  wordmark 21%    · no sub-line  (below ~96px TOLLEY.IO is mud)
 *
 * ── FONTS ────────────────────────────────────────────────────────────────
 * Type comes from JELLY_TOKENS.font / .fontMono, i.e. the CSS variables the
 * /animate layout already loads (components/animate/fonts.ts). It used to call
 * next/font itself; that shipped a second copy of the font CSS on every page
 * that touched the mark, and the fallback stacks in the tokens cover the case
 * where it is rendered outside that layout.
 *
 * For a distributable logo file, export vector SVG with the type converted
 * to outlines — see the handoff README. This component is for screen use.
 */

import { JELLY_TOKENS } from "../tokens";

/** The plate the wordmark sits on, and the ink it is cut out of. Both come
 *  from tokens.ts — never hardcode a third value here. */
export const JELLY_MARK_PLATE = JELLY_TOKENS.gradPrimary;
export const JELLY_MARK_INK = JELLY_TOKENS.onGradient;

export interface JellyMarkProps {
  /**
   * `compact` drops the TOLLEY.IO line and enlarges the wordmark — use it
   * for nav lockups, favicons and any avatar under 128px.
   */
  variant?: "compact" | "full";
  /** Canvas edge in px. Defaults: 48 compact, 340 full (the reference size). */
  size?: number;
  /** Fully round instead of the 8.2% squircle — for avatar placements. */
  round?: boolean;
  className?: string;
}

export function JellyMark({
  variant = "compact",
  size,
  round = false,
  className,
}: JellyMarkProps): React.ReactElement {
  const edge = size ?? (variant === "compact" ? 48 : 340);
  const compact = variant === "compact";

  // Percentages of the edge, straight off the 340px reference.
  const wordSize = edge * (compact ? 0.21 : 0.1765);
  const radius = round ? edge / 2 : edge * 0.082;

  return (
    <span
      role="img"
      aria-label="Jelly Studio by tolley.io"
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: edge,
        height: edge,
        flex: "none",
        borderRadius: radius,
        background: JELLY_MARK_PLATE,
        // Nothing else may sit on the plate: the ink type is the only content,
        // and white-on-gradient is explicitly out per the brand rules.
        color: JELLY_MARK_INK,
        boxShadow: JELLY_TOKENS.brandGlow,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontFamily: JELLY_TOKENS.font,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: compact ? 0 : edge * 0.0059,
          fontWeight: 700,
          fontSize: wordSize,
          letterSpacing: compact ? "-0.03em" : "-0.04em",
          lineHeight: compact ? 1.02 : 0.98,
        }}
      >
        {/* Set as literal uppercase, not text-transform, so the tracking
          * above applies to the glyphs the designer actually spaced. */}
        <span>JELLY</span>
        <span>STUDIO</span>
      </span>
      {compact ? null : (
        <span
          style={{
            fontFamily: JELLY_TOKENS.fontMono,
            marginTop: edge * 0.0412,
            fontSize: edge * 0.0353,
            letterSpacing: "0.28em",
            // The sub-line is tracked out to the right, which leaves a
            // trailing gap; nudge it back so the lockup reads centred.
            textIndent: "0.28em",
            opacity: 0.72,
          }}
        >
          TOLLEY.IO
        </span>
      )}
    </span>
  );
}
