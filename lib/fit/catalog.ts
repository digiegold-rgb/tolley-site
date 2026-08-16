/**
 * Shoppable persona fits (Jared 2026-08-16).
 *
 * Every persona video's outfit is COMPOSED on the DGX (growth-engine
 * lib/persona-wardrobe.mjs) from stable wardrobe ids, and the renderer puts
 * tolley.io/fit/<code> in the caption. The code is positional + URL-safe:
 *   <silhouette>~<colour>~<footwear>~<jewelry>~<hair>[~<accent>]
 * We resolve it here against two committed JSON files that the DGX syncs
 * (growth-engine/scripts/build-fit-catalog.py --sync):
 *   app/fit/wardrobe.json  — ids -> wording + which PIECES make the look
 *   app/fit/catalog.json   — piece id -> brand + Amazon ASIN
 * Nothing is guessed from the video: the code IS what she wore.
 *
 * Compliance: no Amazon prices or images are shown on the public page (those
 * need PA-API freshness rules); links carry the per-channel Associates subtag.
 */
import wardrobeJson from "@/app/fit/wardrobe.json";
import catalogJson from "@/app/fit/catalog.json";
import { resolveAmazonSubtag } from "@/lib/amazon/subtags";

export type Slot = "dress" | "top" | "bottom" | "shoes" | "jewelry" | "hair" | "accessory";

interface WardrobeEntry { id: string; text: string; register?: string; registers?: string[]; pieces?: string[] }
interface Wardrobe {
  silhouettes: WardrobeEntry[]; footwear: WardrobeEntry[]; jewelry: WardrobeEntry[];
  hair: WardrobeEntry[]; accents: WardrobeEntry[]; colors: string[];
}
export interface CatalogPiece {
  slot: Slot; label: string; brand?: string; asin?: string; title?: string; query?: string;
}
interface Catalog { pieces: Record<string, CatalogPiece>; updated?: string }

const wardrobe = wardrobeJson as unknown as Wardrobe;
const catalog = catalogJson as unknown as Catalog;

export const SLOT_ORDER: Slot[] = ["dress", "top", "bottom", "shoes", "jewelry", "hair", "accessory"];
export const SLOT_META: Record<Slot, { label: string; emoji: string }> = {
  dress: { label: "The dress", emoji: "👗" },
  top: { label: "Top", emoji: "👚" },
  bottom: { label: "Bottoms", emoji: "👖" },
  shoes: { label: "Shoes", emoji: "👠" },
  jewelry: { label: "Jewelry", emoji: "💍" },
  hair: { label: "Hair", emoji: "🎀" },
  accessory: { label: "Accessory", emoji: "🕶️" },
};

export interface FitItem extends CatalogPiece { pieceId: string; url: string | null; searchUrl: string }
export interface ResolvedFit {
  code: string;
  outfit: string;          // "a fitted soft white ribbed sleeveless midi dress"
  color: string;           // "soft white"
  footwear: string;        // "tan block-heel sandals"
  jewelry: string;
  hair: string;
  accent: string;
  register: string;
  items: FitItem[];
}

const byId = (list: WardrobeEntry[], id: string) => list.find((e) => e.id === id) || null;

/** Amazon product URL with the channel subtag (utm_source -> tolley-<src>-20). */
export function amazonUrl(asin: string | undefined, src?: string | null): string | null {
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) return null;
  return `https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(resolveAmazonSubtag(src || "shop"))}`;
}
/** Tagged Amazon SEARCH link — the fallback when a piece has no ASIN yet. */
export function amazonSearchUrl(query: string, src?: string | null): string {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&tag=${encodeURIComponent(resolveAmazonSubtag(src || "shop"))}`;
}

export function pieceItem(pieceId: string, src?: string | null): FitItem | null {
  const p = catalog.pieces[pieceId];
  if (!p) return null;
  return { ...p, pieceId, url: amazonUrl(p.asin, src), searchUrl: amazonSearchUrl(p.query || p.label, src) };
}

const uniq = (ids: string[]) => ids.filter((x, i) => x && ids.indexOf(x) === i);

/** Parse + resolve a fit code. Returns null when the silhouette id is unknown. */
export function resolveFit(code: string, src?: string | null): ResolvedFit | null {
  const parts = decodeURIComponent(code || "").split("~");
  if (parts.length < 2) return null;
  const [silId, colorSlug, shoeId = "", jwId = "", hairId = "", accId = ""] = parts;
  const sil = byId(wardrobe.silhouettes, silId);
  if (!sil) return null;
  const color = wardrobe.colors.find((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, "-") === colorSlug) || colorSlug.replace(/-/g, " ");
  const shoe = byId(wardrobe.footwear, shoeId);
  const jw = byId(wardrobe.jewelry, jwId);
  const hair = byId(wardrobe.hair, hairId);
  const acc = accId ? byId(wardrobe.accents, accId) : null;
  let outfit = sil.text.includes("{color}") ? sil.text.replace("{color}", color) : sil.text;
  outfit = outfit.replace(/\b([Aa]) (?=[aeiouAEIOU])/g, "$1n ");
  const pieceIds = uniq([...(sil.pieces || []), ...(shoe?.pieces || []), ...(jw?.pieces || []), ...(hair?.pieces || []), ...(acc?.pieces || [])]);
  const items = pieceIds.map((id) => pieceItem(id, src)).filter((x): x is FitItem => !!x);
  items.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  return {
    code, outfit, color, footwear: shoe?.text || "", jewelry: jw?.text || "", hair: hair?.text || "",
    accent: acc?.text || "", register: sil.register || "", items,
  };
}

/** The whole closet, grouped by slot — for the /fit lookbook. */
export function lookbook(src?: string | null): Record<Slot, FitItem[]> {
  const out = Object.fromEntries(SLOT_ORDER.map((s) => [s, [] as FitItem[]])) as Record<Slot, FitItem[]>;
  for (const id of Object.keys(catalog.pieces)) {
    const it = pieceItem(id, src);
    if (it && out[it.slot]) out[it.slot].push(it);
  }
  return out;
}

export const catalogUpdated = catalog.updated || "";
export const wardrobeCounts = {
  silhouettes: wardrobe.silhouettes.length, footwear: wardrobe.footwear.length,
  jewelry: wardrobe.jewelry.length, hair: wardrobe.hair.length, accents: wardrobe.accents.length,
  colors: wardrobe.colors.length,
};
