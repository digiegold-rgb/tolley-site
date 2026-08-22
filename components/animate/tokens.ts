import type * as React from 'react';

/* Jelly Studio — Design Tokens ("Cinema" language, 2026-08-16)
 *
 * Source of truth: the design handoff at design/jelly-cinema-2026-08-16/README.md
 * (Jared, "Live pricing receipt meter.zip"). A dark 3-D cinema aesthetic —
 * projector light, film strips, title cards, reels, box-office ticket — on the
 * violet / cyan pair. RULES:
 *   • Never introduce a new hue. Violet #8F7DFF and cyan #6FD6FF only; the
 *     semantic status colours (success/error/warning) are the sole exception.
 *   • Instrument Serif italic is reserved for emotional / cinematic moments
 *     (title cards, the hero accent phrase, "Directed by you.").
 *   • Every panel is glass (translucent fill + hairline + blur). Anything that
 *     must be opaque (modals, dropdowns, sticky bars) uses `t.panel`.
 *   • Billing UI is always an ADMIT ONE ticket (components/animate/cinema/AdmitOneTicket).
 *
 * Single source of truth for inline-style values. No Tailwind, no CSS modules.
 * Every key that existed before the cinema pass is still here (57 consumers).
 */

const VIOLET = '#8F7DFF';
const VIOLET_LIGHT = '#B3A6FF';
const CYAN = '#6FD6FF';
const INK = '#0A0A14';
const GRAD_PRIMARY = 'linear-gradient(120deg, #8F7DFF, #6FD6FF)';

export const JELLY_TOKENS = {
  /* ── brand pair ── */
  brand: VIOLET,
  brandLight: VIOLET_LIGHT,
  brandDark: '#6C5CE7',
  brandGhost: 'rgba(143,125,255,0.08)',
  brandOutline: 'rgba(143,125,255,0.35)',
  brandGlow: '0 12px 44px rgba(143,125,255,0.35)',
  cyan: CYAN,
  cyanGhost: 'rgba(111,214,255,0.08)',
  /* `accent` was amber; it is used site-wide as the "in progress / live" colour,
   * which in the cinema language is cyan ("● NOW FILMING"). */
  accent: CYAN,
  accentDark: '#3FB8EE',
  /* CANON — the locked house cast / canon style marker (2026-08-22).
   * Deliberately OUTSIDE the violet/cyan brand pair so "this is the show"
   * never reads as ordinary UI chrome or as a status colour. */
  canon: '#E7B84B',
  /* semantic status — cooled to sit on the ink ground, never used as brand */
  success: '#34C98A',
  error: '#F0607A',
  warning: '#F5B34B',
  /* ── gradients ── */
  gradPrimary: GRAD_PRIMARY,
  gradText: 'linear-gradient(110deg, #B3A6FF, #6FD6FF)',
  gradTicket: 'linear-gradient(160deg, rgba(143,125,255,0.12), rgba(111,214,255,0.06))',
  gradChipOn: 'linear-gradient(120deg, rgba(143,125,255,0.25), rgba(111,214,255,0.18))',
  onGradient: INK,
  gradCreate: GRAD_PRIMARY,
  gradCredits: 'linear-gradient(135deg, #6C5CE7, #8F7DFF)',
  gradUpgrade: 'linear-gradient(135deg, #1B1533, #2A2350)',
  gradTutorial: GRAD_PRIMARY,
  light: {
    body: '#F6F4FF',
    card: 'rgba(255,255,255,0.72)',
    cardAlt: '#EFEDF9',
    panel: '#FFFFFF',
    nebula: '#E9E4FF',
    text: '#14122A',
    textSecondary: '#5C5878',
    textFaint: '#7A7694',
    textDisabled: 'rgba(20,18,42,0.38)',
    border: 'rgba(20,18,42,0.10)',
    borderStrong: 'rgba(20,18,42,0.16)',
    hover: 'rgba(143,125,255,0.08)',
    link: '#5B4BD6',
    sidebarBg: 'rgba(255,255,255,0.7)',
    headerBg: 'rgba(246,244,255,0.75)',
    glassBlur: 'blur(10px)',
    cardShadow: '0 30px 60px rgba(60,50,120,0.12)',
    halo: '0 0 60px rgba(143,125,255,0.18)',
    heroWash: 'radial-gradient(90% 70% at 75% -10%, #E9E4FF 0%, #F6F4FF 55%)',
  },
  dark: {
    body: INK,
    card: 'rgba(240,238,248,0.04)',
    cardAlt: '#08070F',
    panel: '#0E0D19',
    nebula: '#1B1533',
    text: '#F0EEF8',
    textSecondary: '#9A94B0',
    textFaint: '#6B6584',
    textDisabled: '#4A4560',
    border: 'rgba(240,238,248,0.10)',
    borderStrong: 'rgba(240,238,248,0.16)',
    hover: 'rgba(143,125,255,0.07)',
    link: VIOLET_LIGHT,
    sidebarBg: 'rgba(8,7,15,0.72)',
    headerBg: 'rgba(10,10,20,0.6)',
    glassBlur: 'blur(10px)',
    cardShadow: '0 40px 80px rgba(0,0,0,0.5)',
    halo: '0 0 60px rgba(143,125,255,0.25)',
    heroWash: 'radial-gradient(90% 70% at 75% -10%, #1B1533 0%, #0A0A14 55%)',
  },
  /* Fonts are loaded once in app/animate/layout.tsx (components/animate/fonts.ts).
   * The Sora fallback keeps the two animate banners that /vater/youtube imports
   * readable outside the /animate layout. */
  font: "var(--font-jelly-display, var(--font-sora)), 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSerif: "var(--font-jelly-serif), 'Instrument Serif', Georgia, serif",
  fontMono: "var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
  radius: { xs: 6, sm: 10, md: 12, lg: 14, xl: 18, xxl: 20, pill: 999, full: 9999 },
  shadow1: '0 10px 30px rgba(0,0,0,0.35)',
  shadow4: '0 24px 60px rgba(0,0,0,0.45)',
  shadow24: '0 40px 90px rgba(0,0,0,0.6)',
  /* micro-labels: "ACT I — THE STORY", "— TITLE CARD —" */
  micro: { size: 11.5, tracking: '0.26em' },
  motion: {
    rise: 'jc-rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both',
    fadein: 'jc-fadein 1s both',
    reel: 'jc-reel 14s linear infinite',
    marquee: 'jc-marquee 30s linear infinite',
    blink: 'jc-blink 1.6s infinite',
    flicker: 'jc-flicker 6s infinite',
  },
} as const;

export type VaterTheme = { readonly [K in keyof typeof JELLY_TOKENS.dark]: string };

/** The glass panel recipe every card / bar / drawer shares. Spread it first,
 *  then override radius / padding per use. */
export function glass(t: VaterTheme, opts: { strong?: boolean } = {}): {
  background: string;
  border: string;
  backdropFilter: string;
  WebkitBackdropFilter: string;
} {
  return {
    background: t.card,
    border: `1px solid ${opts.strong ? t.borderStrong : t.border}`,
    backdropFilter: t.glassBlur,
    WebkitBackdropFilter: t.glassBlur,
  };
}

/** Micro-label style ("ACT I — THE STORY"). */
export function microLabelStyle(color: string): React.CSSProperties {
  return {
    fontSize: JELLY_TOKENS.micro.size,
    letterSpacing: JELLY_TOKENS.micro.tracking,
    textTransform: 'uppercase',
    color,
    fontFamily: JELLY_TOKENS.font,
    fontWeight: 500,
  };
}

export const EDITOR_STEPS = [
  'Title',
  'Script',
  'Voiceover',
  'Visuals',
  'Soundtrack',
  'Thumbnail',
  'Description',
] as const;

export type EditorStepLabel = (typeof EDITOR_STEPS)[number];

// Aligned with lib/vater/pricing.ts FLAT_ACTION_PRICES (the billed truth).
// Title + soundtrack are not billable actions — shown as included.
export const SECTION_PRICES = {
  title: 'included',
  script: '$0.05',
  voiceover: '$0.20/min',
  visuals: '$0.25/scene',
  soundtrack: 'included',
  thumbnail: '$1',
  description: '$0.10',
} as const;

export type SectionPriceKey = keyof typeof SECTION_PRICES;
