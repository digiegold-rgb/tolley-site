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

/* ── Brand family = CSS variables with Jelly fallbacks (2026-08-26) ──────
 *
 * Listing Studio (tolley.io/realestateanimated) wears the SAME shell in a
 * navy/gold palette. Rather than thread a provider through the ~115 files
 * that import JELLY_TOKENS directly, every brand-family value below is
 * `var(--jb-<kebab>, <jelly hex>)`: on /animate nothing sets the variable,
 * so the fallback IS the Jelly palette and the studio is pixel-identical;
 * app/realestateanimated/layout.tsx sets the variables (LISTING_CSS_VARS in
 * components/animate/brands.ts) and the whole shell re-colours.
 *
 * RULES:
 *   • Variable names match LISTING_CSS_VARS keys exactly — see JELLY_CSS_VARS.
 *   • Never string-concatenate a brand token (`${brand}55`) — it is a var()
 *     expression now, not a hex. Use brandGhost / brandOutline instead.
 *   • Anything that needs a literal hex (canvas, three.js) reads the variable
 *     off `getComputedStyle(document.documentElement)` with a hex fallback
 *     (see cinema/SpaceField.tsx) or uses JELLY_HEX below.
 */

const VIOLET = '#8F7DFF';
const VIOLET_LIGHT = '#B3A6FF';
const CYAN = '#6FD6FF';
const INK = '#0A0A14';
const GRAD_PRIMARY_HEX = 'linear-gradient(120deg, #8F7DFF, #6FD6FF)';

/** `var(--jb-<name>, <fallback>)` — fallbacks may contain commas (gradients). */
function v(name: string, fallback: string): string {
  return `var(--jb-${name}, ${fallback})`;
}

/** Literal Jelly hex values for the few non-CSS consumers (three.js, canvas). */
export const JELLY_HEX = {
  brand: VIOLET,
  brandLight: VIOLET_LIGHT,
  cyan: CYAN,
  ink: INK,
} as const;

/**
 * Every `--jb-*` variable the shell reads, with its Jelly value. Exported so
 * a brand file (components/animate/brands.ts) can be diffed against it and so
 * tests can assert the two key sets never drift.
 */
export const JELLY_CSS_VARS: Record<string, string> = {
  '--jb-brand': VIOLET,
  '--jb-brand-light': VIOLET_LIGHT,
  '--jb-brand-dark': '#6C5CE7',
  '--jb-brand-ghost': 'rgba(143,125,255,0.08)',
  '--jb-brand-outline': 'rgba(143,125,255,0.35)',
  /* colour only — tokens compose it into `0 12px 44px <glow>` */
  '--jb-brand-glow': 'rgba(143,125,255,0.35)',
  '--jb-cyan': CYAN,
  '--jb-cyan-ghost': 'rgba(111,214,255,0.08)',
  '--jb-accent': CYAN,
  '--jb-accent-dark': '#3FB8EE',
  '--jb-grad-primary': GRAD_PRIMARY_HEX,
  '--jb-grad-text': 'linear-gradient(110deg, #B3A6FF, #6FD6FF)',
  '--jb-grad-ticket': 'linear-gradient(160deg, rgba(143,125,255,0.12), rgba(111,214,255,0.06))',
  '--jb-grad-chip-on': 'linear-gradient(120deg, rgba(143,125,255,0.25), rgba(111,214,255,0.18))',
  '--jb-grad-create': GRAD_PRIMARY_HEX,
  '--jb-grad-credits': 'linear-gradient(135deg, #6C5CE7, #8F7DFF)',
  '--jb-grad-upgrade': 'linear-gradient(135deg, #1B1533, #2A2350)',
  '--jb-grad-tutorial': GRAD_PRIMARY_HEX,
  '--jb-on-gradient': INK,
  /* dark theme surfaces (light theme has its own fallbacks in `light`) */
  '--jb-body': INK,
  '--jb-card-alt': '#08070F',
  '--jb-panel': '#0E0D19',
  '--jb-nebula': '#1B1533',
  '--jb-hover': 'rgba(143,125,255,0.07)',
  '--jb-link': VIOLET_LIGHT,
  '--jb-sidebar-bg': 'rgba(8,7,15,0.72)',
  '--jb-header-bg': 'rgba(10,10,20,0.6)',
  /* colour only — tokens compose it into `0 0 60px <halo>` */
  '--jb-halo': 'rgba(143,125,255,0.25)',
  '--jb-hero-wash': 'radial-gradient(90% 70% at 75% -10%, #1B1533 0%, #0A0A14 55%)',
};

const GRAD_PRIMARY = v('grad-primary', GRAD_PRIMARY_HEX);

export const JELLY_TOKENS = {
  /* ── brand pair ── */
  brand: v('brand', VIOLET),
  brandLight: v('brand-light', VIOLET_LIGHT),
  brandDark: v('brand-dark', '#6C5CE7'),
  brandGhost: v('brand-ghost', 'rgba(143,125,255,0.08)'),
  brandOutline: v('brand-outline', 'rgba(143,125,255,0.35)'),
  brandGlow: `0 12px 44px ${v('brand-glow', 'rgba(143,125,255,0.35)')}`,
  cyan: v('cyan', CYAN),
  cyanGhost: v('cyan-ghost', 'rgba(111,214,255,0.08)'),
  /* `accent` was amber; it is used site-wide as the "in progress / live" colour,
   * which in the cinema language is cyan ("● NOW FILMING"). */
  accent: v('accent', CYAN),
  accentDark: v('accent-dark', '#3FB8EE'),
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
  gradText: v('grad-text', 'linear-gradient(110deg, #B3A6FF, #6FD6FF)'),
  gradTicket: v('grad-ticket', 'linear-gradient(160deg, rgba(143,125,255,0.12), rgba(111,214,255,0.06))'),
  gradChipOn: v('grad-chip-on', 'linear-gradient(120deg, rgba(143,125,255,0.25), rgba(111,214,255,0.18))'),
  onGradient: v('on-gradient', INK),
  gradCreate: v('grad-create', GRAD_PRIMARY_HEX),
  gradCredits: v('grad-credits', 'linear-gradient(135deg, #6C5CE7, #8F7DFF)'),
  gradUpgrade: v('grad-upgrade', 'linear-gradient(135deg, #1B1533, #2A2350)'),
  gradTutorial: v('grad-tutorial', GRAD_PRIMARY_HEX),
  light: {
    body: v('body', '#F6F4FF'),
    card: 'rgba(255,255,255,0.72)',
    cardAlt: v('card-alt', '#EFEDF9'),
    panel: v('panel', '#FFFFFF'),
    nebula: v('nebula', '#E9E4FF'),
    text: '#14122A',
    textSecondary: '#5C5878',
    textFaint: '#7A7694',
    textDisabled: 'rgba(20,18,42,0.38)',
    border: 'rgba(20,18,42,0.10)',
    borderStrong: 'rgba(20,18,42,0.16)',
    hover: v('hover', 'rgba(143,125,255,0.08)'),
    link: v('link', '#5B4BD6'),
    sidebarBg: v('sidebar-bg', 'rgba(255,255,255,0.7)'),
    headerBg: v('header-bg', 'rgba(246,244,255,0.75)'),
    glassBlur: 'blur(10px)',
    cardShadow: '0 30px 60px rgba(60,50,120,0.12)',
    halo: `0 0 60px ${v('halo', 'rgba(143,125,255,0.18)')}`,
    heroWash: v('hero-wash', 'radial-gradient(90% 70% at 75% -10%, #E9E4FF 0%, #F6F4FF 55%)'),
  },
  dark: {
    body: v('body', INK),
    card: 'rgba(240,238,248,0.04)',
    cardAlt: v('card-alt', '#08070F'),
    panel: v('panel', '#0E0D19'),
    nebula: v('nebula', '#1B1533'),
    text: '#F0EEF8',
    textSecondary: '#9A94B0',
    textFaint: '#6B6584',
    textDisabled: '#4A4560',
    border: 'rgba(240,238,248,0.10)',
    borderStrong: 'rgba(240,238,248,0.16)',
    hover: v('hover', 'rgba(143,125,255,0.07)'),
    link: v('link', VIOLET_LIGHT),
    sidebarBg: v('sidebar-bg', 'rgba(8,7,15,0.72)'),
    headerBg: v('header-bg', 'rgba(10,10,20,0.6)'),
    glassBlur: 'blur(10px)',
    cardShadow: '0 40px 80px rgba(0,0,0,0.5)',
    halo: `0 0 60px ${v('halo', 'rgba(143,125,255,0.25)')}`,
    heroWash: v('hero-wash', 'radial-gradient(90% 70% at 75% -10%, #1B1533 0%, #0A0A14 55%)'),
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
