/**
 * JellyMark — the Jelly Studio profile mark (brand concept 1C), rebuilt in
 * React from the handoff at design/jelly-studio-logo-1c/.
 *
 * A stacked JELLY / STUDIO wordmark in ink on brand pink, with a monospace
 * TOLLEY.IO sub-line on the full variant. The handoff is marked high
 * fidelity: colours, type, spacing and proportions are final.
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
 * This component loads its own Space Grotesk / IBM Plex Mono via next/font
 * rather than inheriting CSS variables from a parent. That is deliberate:
 * the mark is meant to be dropped onto any surface (nav, footer, an OG
 * route, an email header) and still be correct. next/font dedupes the
 * underlying files, so the cost of self-containment is a little extra CSS.
 *
 * For a distributable logo file, export vector SVG with the type converted
 * to outlines — see the handoff README. This component is for screen use.
 */

import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";

const markDisplay = Space_Grotesk({ subsets: ["latin"], weight: "700" });
const markMono = IBM_Plex_Mono({ subsets: ["latin"], weight: "400" });

/** Brand tokens for the mark itself. Page-level tokens live in landing.css. */
export const JELLY_MARK_PINK = "oklch(0.72 0.19 340)";
export const JELLY_MARK_INK = "#17131A";

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
        background: JELLY_MARK_PINK,
        // Nothing else may sit on the pink: the ink type is the only content,
        // and white-on-pink is explicitly out per the brand rules.
        color: JELLY_MARK_INK,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <span
        className={markDisplay.className}
        style={{
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
          className={markMono.className}
          style={{
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
