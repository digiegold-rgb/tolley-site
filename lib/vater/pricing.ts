/**
 * lib/vater/pricing.ts — single source of truth for customer-facing Vater
 * Studio pricing (pay-per-video, card on file).
 *
 * Isomorphic: imported by API routes (billing gates, recordUsage) AND client
 * components (VisualsStep quality dropdown, PricingScreen table). Prices are
 * not secret — only costs estimates live here too, and those are fine to ship
 * to the client (they already appeared in the old dropdown labels).
 *
 * estCostCents = DGX-measured (vater_i2v.py TIERS, 5s clip): Wan L40S ~16¢,
 * H100 ~26¢ (re-synced 2026-08-26 — the old 32¢/40¢ were April guesses, which
 * quietly put Wan at ~9x). Batch animate loads the model once, so real
 * per-clip cost there is at or below these numbers.
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
  "modal-wan22-narrative":      { priceCents: 150, estCostCents: 16, label: "Wan2.2 Narrative L40S",   etaLabel: "~5 min" },
  "modal-wan22-narrative-fast": { priceCents: 200, estCostCents: 26, label: "Wan2.2 Narrative H100",   etaLabel: "~2 min" },
  "modal-hunyuan-narrative":      { priceCents: 75,  estCostCents: 14, label: "Hunyuan Narrative L40S", etaLabel: "~3 min" },
  "modal-hunyuan-narrative-fast": { priceCents: 125, estCostCents: 24, label: "Hunyuan Narrative H100", etaLabel: "~1 min" },
  "modal-wan22":      { priceCents: 150, estCostCents: 16, label: "Wan2.2 Action L40S", etaLabel: "~3 min" },
  "modal-wan22-fast": { priceCents: 200, estCostCents: 26, label: "Wan2.2 Action H100", etaLabel: "~2 min" },
  "modal-easyanimate-anime": { priceCents: 150, estCostCents: 30, label: "EasyAnimate v5 Anime", etaLabel: "~4 min" },
  // Animate-2 motion transfer: ~5-7 min of L40S per clip (≈ $0.20-0.25 real).
  "modal-animate2": { priceCents: 175, estCostCents: 25, label: "Wan Animate-2 Motion L40S", etaLabel: "~6 min" },
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
  // Character Lab (2026-08-20). A batch = 3 portrait takes (descriptor +
  // FireRed-Modal still each — same model customer scenes render on).
  // ~$0.11/batch all-in (3 × $0.03 L40S + metered LLM), so 68¢ holds the
  // standing 4-6x margin while staying far cheaper than auditioning
  // characters via $7 test renders.
  character: { priceCents: 68, unit: "/batch of 3 takes" },
  // Import = Gemini Vision descriptor + one stylized anchor render.
  character_import: { priceCents: 49, unit: "/import" },
} as const;

export type FlatAction = keyof typeof FLAT_ACTION_PRICES;

/**
 * Tiers a customer may pick in the /animate editor + wizard, in display
 * order, with plain-English copy. This is THE list every dropdown renders —
 * a tier absent here is not offered anywhere (local GB10 tiers, EasyAnimate
 * until its backend is wired). Prices come from ANIMATION_PRICES so the
 * label, the confirm modal and the server charge can never disagree again
 * (2026-08-26: the editor showed our Modal cost "~$0.16/clip" while the route
 * billed $1.50).
 */
export type AnimationTierGroup = "calm" | "action" | "motion" | "premium" | "photoreal";

export interface CustomerAnimationTier {
  id: AnimationQuality;
  group: AnimationTierGroup;
  /** One line a first-time user understands. */
  blurb: string;
  /** Cartoon/stylized stills get rejected by Google Veo's safety filter. */
  cartoonUnsafe?: boolean;
  recommended?: boolean;
}

export const ANIMATION_TIER_GROUPS: Record<AnimationTierGroup, { label: string; hint: string }> = {
  calm: {
    label: "Calm — talking, narrative, close-ups",
    hint: "Gentle motion, mouth stays closed. Best for story and explainer scenes.",
  },
  action: {
    label: "Action — fights, dance, big movement",
    hint: "Energetic motion. Flails on calm shots — use only for action beats.",
  },
  motion: {
    label: "Motion transfer — your character performs a real clip",
    hint: "Wan Animate-2: pick a 3-6 s driver clip (or let it rotate through your library) and the character in the still copies that motion, full-body, continuously.",
  },
  premium: {
    label: "Premium — third-party engines",
    hint: "Kling / Luma via fal.ai. Any art style. Higher price per clip.",
  },
  photoreal: {
    label: "Photoreal only — Google Veo",
    hint: "Rejects cartoon faces. Only for photorealistic stills.",
  },
};

export const CUSTOMER_ANIMATION_TIERS: ReadonlyArray<CustomerAnimationTier> = [
  { id: "modal-wan22-narrative", group: "calm", recommended: true,
    blurb: "Wan 2.2 with the calm-narrative training. Our default." },
  { id: "modal-wan22-narrative-fast", group: "calm",
    blurb: "Same result as Wan 2.2 Narrative, ~2× faster on a bigger GPU." },
  { id: "modal-hunyuan-narrative", group: "calm",
    blurb: "HunyuanVideo 1.5 — a different model family; try it if Wan looks off." },
  { id: "modal-hunyuan-narrative-fast", group: "calm",
    blurb: "Same result as Hunyuan, ~2× faster on a bigger GPU." },
  { id: "modal-wan22", group: "action",
    blurb: "Wan 2.2 Fun-InP — built for movement. Overshoots on quiet shots." },
  { id: "modal-wan22-fast", group: "action",
    blurb: "Same as Wan 2.2 Action, ~2× faster on a bigger GPU." },
  { id: "modal-animate2", group: "motion",
    blurb: "Wan 2.2 Animate-2 — the character copies a driver clip's motion. Constant, full-body movement; needs a driver clip (starter library included)." },
  { id: "kling-standard", group: "premium",
    blurb: "Kling Standard 720p — reliable on cartoons and stylized art." },
  { id: "kling-pro", group: "premium",
    blurb: "Kling Pro 1080p — sharper output." },
  { id: "kling-master", group: "premium",
    blurb: "Kling v2 Master — flagship quality, most expensive clip we offer." },
  { id: "luma", group: "premium",
    blurb: "Luma Dream Machine — fast, good on realistic scenes." },
  { id: "default", group: "photoreal", cartoonUnsafe: true,
    blurb: "Veo 3 Fast 720p." },
  { id: "default_1080p", group: "photoreal", cartoonUnsafe: true,
    blurb: "Veo 3 Fast 1080p." },
  { id: "high", group: "photoreal", cartoonUnsafe: true,
    blurb: "Veo 3.1 — highest cinematic quality." },
];

const CUSTOMER_TIER_IDS = new Set<string>(CUSTOMER_ANIMATION_TIERS.map((t) => t.id));

/** True for tiers a customer is allowed to submit. Server routes gate on this. */
export function isCustomerAnimationQuality(quality: unknown): quality is AnimationQuality {
  return typeof quality === "string" && CUSTOMER_TIER_IDS.has(quality);
}

/** GB10-local tiers — never offered, never accepted from the browser
 *  (vater-modal-only doctrine: customer work never touches the DGX GPU). */
export function isLocalAnimationQuality(quality: unknown): boolean {
  return typeof quality === "string" && /-local$/.test(quality);
}

export function customerAnimationTier(quality: string): CustomerAnimationTier | null {
  return CUSTOMER_ANIMATION_TIERS.find((t) => t.id === quality) ?? null;
}

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
