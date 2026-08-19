/**
 * lib/vater/pricing.ts — single source of truth for customer-facing Vater
 * Studio pricing (pay-per-video, card on file).
 *
 * Isomorphic: imported by API routes (billing gates, recordUsage) AND client
 * components (VisualsStep quality dropdown, PricingScreen table). Prices are
 * not secret — only costs estimates live here too, and those are fine to ship
 * to the client (they already appeared in the old dropdown labels).
 *
 * Margin policy: ~4-6x over real backend cost (Modal GPU rental / Veo / Kling
 * metered APIs, calibrated 2026-04-25 in Shared/animation-fix.md). Local DGX
 * tiers cost ~$0 to run but are priced at a floor so free renders don't
 * cannibalize the paid tiers.
 */

import type { AnimationQuality } from "@/lib/vater/video-spec";

export interface AnimationPrice {
  /** What the customer pays per clip, in cents. */
  priceCents: number;
  /** Our estimated real cost per clip, in cents (margin tracking only). */
  estCostCents: number;
  /** Human label shown in quality dropdowns. */
  label: string;
  /** Rough wall-clock estimate shown next to the label. */
  etaLabel: string;
}

export const ANIMATION_PRICES: Record<AnimationQuality, AnimationPrice> = {
  // ── Modal GPU rental (Wan2.2 / Hunyuan / EasyAnimate) ──
  "modal-wan22-narrative":      { priceCents: 150, estCostCents: 32, label: "Wan2.2 Narrative L40S",   etaLabel: "~5 min" },
  "modal-wan22-narrative-fast": { priceCents: 200, estCostCents: 40, label: "Wan2.2 Narrative H100",   etaLabel: "~2 min" },
  "modal-hunyuan-narrative":      { priceCents: 75,  estCostCents: 14, label: "Hunyuan Narrative L40S", etaLabel: "~3 min" },
  "modal-hunyuan-narrative-fast": { priceCents: 125, estCostCents: 24, label: "Hunyuan Narrative H100", etaLabel: "~1 min" },
  "modal-wan22":      { priceCents: 150, estCostCents: 32, label: "Wan2.2 Action L40S", etaLabel: "~3 min" },
  "modal-wan22-fast": { priceCents: 200, estCostCents: 40, label: "Wan2.2 Action H100", etaLabel: "~2 min" },
  "modal-easyanimate-anime": { priceCents: 150, estCostCents: 30, label: "EasyAnimate v5 Anime", etaLabel: "~4 min" },
  // ── Metered third-party APIs ──
  "kling-standard": { priceCents: 100, estCostCents: 18, label: "Kling Standard 720p", etaLabel: "~2 min" },
  "kling-pro":      { priceCents: 150, estCostCents: 30, label: "Kling Pro 1080p",     etaLabel: "~3 min" },
  "kling-master":   { priceCents: 400, estCostCents: 90, label: "Kling v2 Master",     etaLabel: "~4 min" },
  luma:             { priceCents: 75,  estCostCents: 14, label: "Luma Dream Machine",  etaLabel: "~2 min" },
  turbo:            { priceCents: 60,  estCostCents: 11, label: "Veo Turbo",           etaLabel: "~1 min" },
  default:          { priceCents: 60,  estCostCents: 11, label: "Veo 3 Fast 720p",     etaLabel: "~1 min" },
  default_1080p:    { priceCents: 75,  estCostCents: 15, label: "Veo 3 Fast 1080p",    etaLabel: "~2 min" },
  high:             { priceCents: 175, estCostCents: 35, label: "Veo 3.1 High",        etaLabel: "~3 min" },
  // ── Local DGX (near-zero cost; floor-priced) ──
  "wan22-local": { priceCents: 25, estCostCents: 0, label: "Wan2.2 Local (budget)", etaLabel: "~15-20 min" },
  "ltx-local":   { priceCents: 25, estCostCents: 0, label: "LTX Local (budget)",    etaLabel: "~90 s" },
};

/** Flat per-action prices, in cents. */
export const FLAT_ACTION_PRICES = {
  script: { priceCents: 5, unit: "/generation" },
  voiceover: { priceCents: 20, unit: "/minute" },
  scene: { priceCents: 25, unit: "/scene image" },
  render: { priceCents: 250, unit: "/video compose" },
  thumbnail: { priceCents: 100, unit: "/generation" },
  description: { priceCents: 10, unit: "/generation" },
  transcription: { priceCents: 50, unit: "/10 min" },
} as const;

export type FlatAction = keyof typeof FLAT_ACTION_PRICES;

export function getAnimationPriceCents(quality: string): number {
  const spec = ANIMATION_PRICES[quality as AnimationQuality];
  if (!spec) {
    throw new Error(`Unknown animation quality tier: ${quality}`);
  }
  return spec.priceCents;
}

export function getAnimationPrice(quality: string): AnimationPrice | null {
  return ANIMATION_PRICES[quality as AnimationQuality] ?? null;
}

export function formatPrice(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

/** Dropdown label: "Wan2.2 Narrative L40S — $1.50/clip (~5 min)" */
export function animationOptionLabel(quality: AnimationQuality): string {
  const p = ANIMATION_PRICES[quality];
  return `${p.label} — ${formatPrice(p.priceCents)}/clip (${p.etaLabel})`;
}

/**
 * Which compute a quality tier actually runs on — "L40S", "H100", "local", or
 * the third-party vendor's name.
 *
 * `VaterUsage.tier` stores the quality KEY ("modal-wan22-fast"), not a GPU, so
 * this is what turns a usage row into the answer to "what is this account
 * burning?". Read off the existing `label` rather than a parallel table: a
 * second copy of the mapping is a second thing to forget when a tier's GPU
 * changes, and the label is what the customer was shown when they picked it.
 */
export function gpuForQuality(quality: string | null | undefined): string {
  if (!quality) return "other";
  const spec = ANIMATION_PRICES[quality as AnimationQuality];
  if (!spec) return "other";
  if (/\bH100\b/i.test(spec.label)) return "H100";
  if (/\bL40S\b/i.test(spec.label)) return "L40S";
  if (/local/i.test(spec.label)) return "local";
  if (/^kling/i.test(quality)) return "Kling";
  if (/^luma/i.test(quality)) return "Luma";
  if (/veo/i.test(spec.label)) return "Veo";
  // EasyAnimate and anything else on rented Modal GPUs with no GPU in the
  // label. Deliberately not guessed into L40S/H100 — a wrong GPU attribution
  // is worse than an honest "Modal".
  if (quality.startsWith("modal-")) return "Modal";
  return "other";
}
