/* Jelly by Tolley — Design Tokens (Phase 1 v2 shell)
 *
 * Ported verbatim from
 *   /home/jelly/Shared/tubegen-ui-research/vater-design/tubegen/project/components/vater-core.jsx
 * (lines 4-49) and vater-editor.jsx (EDITOR_STEPS + SECTION_PRICES, lines 3-8).
 *
 * Single source of truth for v2 inline-style values. No Tailwind, no CSS modules.
 */

export const JELLY_TOKENS = {
  brand: '#8B5CF6',
  brandLight: '#A78BFA',
  brandDark: '#7C3AED',
  brandGhost: 'rgba(139,92,246,0.08)',
  brandOutline: 'rgba(139,92,246,0.4)',
  brandGlow: '0 20px 38px rgba(139,92,246,0.24)',
  accent: '#F59E0B',
  accentDark: '#FBBF24',
  success: '#16A34A',
  error: '#DC2626',
  warning: '#F59E0B',
  light: {
    body: '#F5F3FA',
    card: '#FFFFFF',
    cardAlt: '#F5F3FA',
    text: '#1A1726',
    textSecondary: 'rgba(26,23,38,0.6)',
    textDisabled: 'rgba(26,23,38,0.38)',
    border: 'rgba(26,23,38,0.12)',
    hover: 'rgba(26,23,38,0.04)',
    sidebarBg: '#FFFFFF',
    headerBg: '#FFFFFF',
  },
  dark: {
    body: '#0A0A10',
    card: '#16141F',
    cardAlt: '#1C1A28',
    text: '#F1F0F5',
    textSecondary: '#9794A8',
    textDisabled: 'rgba(241,240,245,0.38)',
    border: 'rgba(139,92,246,0.12)',
    hover: 'rgba(255,255,255,0.04)',
    sidebarBg: '#110F1A',
    headerBg: '#110F1A',
  },
  gradCreate: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
  gradCredits: 'linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)',
  gradUpgrade: 'linear-gradient(135deg, #4B5563 0%, #6B7280 100%)',
  gradTutorial: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
  font: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  radius: { xs: 4, sm: 6, md: 8, lg: 12, xl: 16, pill: 24, full: 9999 },
  shadow1:
    '0 3px 3px -2px rgba(0,0,0,0.2), 0 3px 4px 0 rgba(0,0,0,0.14), 0 1px 8px 0 rgba(0,0,0,0.12)',
  shadow4:
    '0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12)',
  shadow24:
    '0 8px 10px -5px rgba(0,0,0,0.2), 0 16px 24px 2px rgba(0,0,0,0.14), 0 6px 30px 5px rgba(0,0,0,0.12)',
} as const;

/* `VaterTheme` is the structural shape shared by both the light and dark
 * token slices. We can't write `typeof JELLY_TOKENS.dark` directly because
 * the `as const` assertion narrows every value to its literal type, which
 * makes the light slice fail assignability against the dark slice. Mapping
 * each key to `string` keeps the per-slice readonly contract while letting
 * either slice flow through the same theme context.
 */
export type VaterTheme = { readonly [K in keyof typeof JELLY_TOKENS.dark]: string };

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

export const SECTION_PRICES = {
  title: '$2',
  script: '$5',
  voiceover: '$8',
  visuals: '$0.50/scene',
  soundtrack: '$5',
  thumbnail: '$3',
  description: '$1',
} as const;

export type SectionPriceKey = keyof typeof SECTION_PRICES;
