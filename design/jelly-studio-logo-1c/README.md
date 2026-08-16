# Handoff: Jelly Studio profile mark (concept 1C)

## Overview
A square logo mark for Jelly Studio (by tolley.io) — a stacked `JELLY / STUDIO` wordmark
in near-black on the brand pink, with a monospace `TOLLEY.IO` lockup line beneath.
Primary use is the Facebook business profile image (cropped to a circle), but the mark is
built to work anywhere square: favicon, app icon, avatar, OG badge.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing the
intended look, not production code to paste in. Recreate the mark in the target codebase using
its existing patterns (React component, SVG asset, static image, whatever fits). If you are
producing a distributable logo file, the correct output is a **vector SVG** with the type
converted to outlines, plus PNG exports — not a live HTML element.

## Fidelity
**High-fidelity.** Colors, typography, spacing and proportions below are final. Match them exactly.

## The Mark

**Canvas:** 1:1. Reference size 340×340 (all values below scale linearly; ×3 = 1020, ×3.01 = 1024).

**Layout:** flex column, centered on both axes, `gap: 2px` between the two wordmark lines.
The `TOLLEY.IO` line sits `margin-top: 14px` below the second line.

**Container**
- background: `oklch(0.72 0.19 340)` — brand pink, hex fallback `#F26BB0`
- border-radius: `28px` at 340px (≈ 8.2% of the edge). For the Facebook avatar the crop is a
  circle, so the radius is cosmetic there; keep it for square placements.

**Wordmark — two lines, `JELLY` then `STUDIO`**
- font-family: Space Grotesk (Google Fonts), weight 700
- font-size: `60px` @340 (17.65% of canvas edge)
- letter-spacing: `-0.04em`
- line-height: `0.98`
- color: `#17131A`
- Both lines are set in uppercase characters (not `text-transform`) so tracking is literal.

**Sub-lockup — `TOLLEY.IO`**
- font-family: IBM Plex Mono (Google Fonts), weight 400
- font-size: `12px` @340 (3.53% of edge)
- letter-spacing: `0.28em`
- color: `#17131A` at `opacity: 0.72`

## Small-size behavior
Below roughly 96px the `TOLLEY.IO` line becomes illegible. Ship a **compact variant** that
drops it and keeps only the two wordmark lines at `font-size: 4.4% of edge × 10` — in the
prototype's 72px avatar this is 15px type with `letter-spacing: -0.03em`, `line-height: 1`.
Use the compact variant for favicons, avatars under 128px, and any inline nav lockup.

## Design Tokens
| Token | Value |
| --- | --- |
| Brand pink (bg) | `oklch(0.72 0.19 340)` / `#F26BB0` |
| Ink (type on pink) | `#17131A` |
| Studio near-black (alt bg) | `#131318` |
| Page black | `#0D0D10` |
| Off-white | `#F7F5FA` |
| Muted text | `#A8A4B0` |
| Violet accent (unused in 1C, used in sibling concepts) | `oklch(0.72 0.19 285)` |
| Display type | Space Grotesk 500/600/700 |
| Mono type | IBM Plex Mono 400/500 |

## Reversed / mono variants to produce
1. **Primary** — ink type on brand pink (this file).
2. **Reversed** — `#F7F5FA` type on `#131318`, for dark placements where pink clashes.
3. **Single-color** — full-black or full-white type on transparent, for print and one-color stamps.

## Assets
- `jelly-studio-logo-1c.html` — standalone HTML reference (open in a browser; fonts load from Google Fonts).
- `jelly-studio-logo-1024.png` — 1020×1020 raster export of the primary mark. Facebook's profile
  minimum is 320×320; it displays at 176×176 on desktop and 196×196 on mobile.
- Fonts: Space Grotesk and IBM Plex Mono, both SIL Open Font License, free for commercial use.
  Self-host in production rather than hotlinking Google Fonts.

## Files in this project
- `Jelly Studio Logo.dc.html` — the full concept sheet (1A–1D); 1C is the chosen direction.
