/**
 * lib/vater/listing-pricing.ts — Listing Studio SKU price list, and nothing else.
 *
 * ⚠️ ZERO IMPORTS, DELIBERATELY (same rule as credit-packs.ts). Shared by the
 * public landing page, the wizard (client) and the billing routes (server) so
 * the number on the card, in the MoneyConfirm modal and in the ledger row can
 * never disagree.
 *
 * Costs are the DGX-measured backend spend (fal Seedance 2.5 @ $0.0214/1k
 * tokens ≈ $0.462/s at 720p; nano-banana-2 edit $0.08; Modal L40S ×1.6
 * overhead). House policy: list ≥ 4× cost. A node:test asserts it.
 */

export type ListingSku =
  | "virtual_staging"
  | "before_after"
  | "beauty_shot"
  | "walkthrough"
  | "exterior_reveal"
  | "agent_tour";

export type ListingEngine = "seedance" | "modal-wan";
export type ListingLook = "photoreal" | "render3d" | "blueprint" | "bw";
export type ListingLane = "social" | "mls";
export type ListingPhase = "p0" | "p1" | "p2";

export interface ListingSkuSpec {
  /** List price in cents (Seedance / photoreal engine). */
  priceCents: number;
  /** List price in cents on the Economy (Modal Wan) engine, when offered. */
  economyPriceCents?: number;
  /** Expected backend cost in cents (photoreal engine). */
  estCostCents: number;
  economyEstCostCents?: number;
  label: string;
  blurb: string;
  etaLabel: string;
  kind: "still" | "video";
  minPhotos: number;
  maxPhotos: number;
  /** Default clip length for video SKUs. */
  durationS?: number;
  /** Extra per additional photo/room beyond `includedPhotos` (walkthrough). */
  perExtraPhotoCents?: number;
  includedPhotos?: number;
  /**
   * True when the output depicts a change to affixed property (walls, floors,
   * finished construction). Heartland MLS §11.2.2: social/marketing use only,
   * label on frame, paired with the as-listed photo.
   */
  materialChange: boolean;
  phase: ListingPhase;
}

export const LISTING_SKUS: Record<ListingSku, ListingSkuSpec> = {
  virtual_staging: {
    priceCents: 499,
    estCostCents: 9,
    label: "Virtual Staging photo",
    blurb: "Your empty room, furnished. MLS-safe still + labeled social version.",
    etaLabel: "about 1 minute",
    kind: "still",
    minPhotos: 1,
    maxPhotos: 1,
    materialChange: false,
    phase: "p0",
  },
  before_after: {
    priceCents: 2900,
    economyPriceCents: 1900,
    estCostCents: 571,
    economyEstCostCents: 82,
    label: "Before → After Reveal",
    blurb: "One photo becomes a 10–12 second transformation video — bare to beautiful.",
    etaLabel: "about 6 minutes",
    kind: "video",
    minPhotos: 1,
    maxPhotos: 1,
    durationS: 12,
    materialChange: true,
    phase: "p0",
  },
  beauty_shot: {
    priceCents: 1400,
    estCostCents: 240,
    label: "Room Beauty Shot",
    blurb: "A slow, cinematic push-in on the room exactly as it is. 5 seconds.",
    etaLabel: "about 4 minutes",
    kind: "video",
    minPhotos: 1,
    maxPhotos: 1,
    durationS: 5,
    materialChange: false,
    phase: "p0",
  },
  walkthrough: {
    priceCents: 7900,
    estCostCents: 1450,
    perExtraPhotoCents: 1400,
    includedPhotos: 4,
    label: "Walkthrough Tour",
    blurb: "3–6 room photos become one narrated tour with price, beds, baths and sqft.",
    etaLabel: "about 12 minutes",
    kind: "video",
    minPhotos: 3,
    maxPhotos: 6,
    durationS: 6,
    materialChange: false,
    phase: "p1",
  },
  exterior_reveal: {
    priceCents: 2900,
    estCostCents: 386,
    label: "Exterior Reveal",
    blurb: "Curb appeal in motion — a slow drone-rise on the front of the home.",
    etaLabel: "about 6 minutes",
    kind: "video",
    minPhotos: 0,
    maxPhotos: 1,
    durationS: 8,
    materialChange: false,
    phase: "p1",
  },
  agent_tour: {
    priceCents: 4900,
    estCostCents: 400,
    label: "Agent Character Tour",
    blurb: "Your locked character walks the listing for you. Per scene.",
    etaLabel: "about 10 minutes",
    kind: "video",
    minPhotos: 1,
    maxPhotos: 5,
    durationS: 8,
    materialChange: false,
    phase: "p2",
  },
};

export const LISTING_SKU_IDS = Object.keys(LISTING_SKUS) as ListingSku[];

export function isListingSku(v: unknown): v is ListingSku {
  return typeof v === "string" && v in LISTING_SKUS;
}

/** Re-stage the still (new seed / tweak) after the first one. */
export const RESTAGE_PRICE_CENTS = 99;

/** 9:16 Listing Reel add-on — a full second render, not a crop. */
export const REEL_ADDON_CENTS: Record<"video_photoreal" | "video_economy" | "beauty", number> = {
  video_photoreal: 1900,
  video_economy: 900,
  beauty: 900,
};

export interface ListingPack {
  id: "launch";
  label: string;
  priceCents: number;
  estCostCents: number;
  includes: string[];
}

export const LISTING_PACKS: ListingPack[] = [
  {
    id: "launch",
    label: "Listing Launch",
    priceCents: 9900,
    estCostCents: 2100,
    includes: ["3 Virtual Staging photos", "1 Before → After Reveal", "1 Walkthrough Tour (up to 4 rooms)"],
  },
];

export interface ListingPriceOpts {
  engine?: ListingEngine;
  photos?: number;
  reel?: boolean;
}

/** List price in cents for a SKU with options. */
export function listingPriceCents(sku: ListingSku, opts: ListingPriceOpts = {}): number {
  const spec = LISTING_SKUS[sku];
  const economy = opts.engine === "modal-wan" && spec.economyPriceCents != null;
  let cents = economy ? (spec.economyPriceCents as number) : spec.priceCents;
  if (spec.perExtraPhotoCents && spec.includedPhotos != null && opts.photos != null) {
    const extra = Math.max(0, Math.min(opts.photos, spec.maxPhotos) - spec.includedPhotos);
    cents += extra * spec.perExtraPhotoCents;
  }
  if (opts.reel && spec.kind === "video") {
    cents += sku === "beauty_shot" ? REEL_ADDON_CENTS.beauty : economy ? REEL_ADDON_CENTS.video_economy : REEL_ADDON_CENTS.video_photoreal;
  }
  return cents;
}

/** Expected backend cost in cents (for margin checks + HQ). */
export function listingEstCostCents(sku: ListingSku, opts: ListingPriceOpts = {}): number {
  const spec = LISTING_SKUS[sku];
  const economy = opts.engine === "modal-wan" && spec.economyEstCostCents != null;
  let cents = economy ? (spec.economyEstCostCents as number) : spec.estCostCents;
  if (spec.perExtraPhotoCents && spec.includedPhotos != null && opts.photos != null) {
    const extra = Math.max(0, Math.min(opts.photos, spec.maxPhotos) - spec.includedPhotos);
    cents += extra * Math.round(spec.estCostCents / (spec.includedPhotos || 1));
  }
  if (opts.reel && spec.kind === "video") cents += economy ? 274 : sku === "beauty_shot" ? 250 : 570;
  return cents;
}

/**
 * Which budget action funds a SKU. Stills are "scene" (fundable by the
 * stills-only starter grant — the free-trial conversion); video is
 * "animation" (purchased balance only).
 */
export function budgetActionFor(sku: ListingSku): "scene" | "animation" {
  return LISTING_SKUS[sku].kind === "still" ? "scene" : "animation";
}

export function formatListingPrice(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/** Ledger dedupe key for the one debit per listing job. */
export function listingDebitKey(sku: ListingSku, listingJobId: string): string {
  return `re:${sku}:${listingJobId}`;
}

/** Minimum list/cost multiple the house accepts. */
export const LISTING_MIN_MARGIN = 4;
