// Client-side shapes for /api/stream-lineup/* (dates arrive as ISO strings).

export type LineupProduct = {
  id: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  brand: string | null;
  condition: string | null;
  targetPrice: number | null;
  minPrice: number | null;
  aiSuggestedPrice: number | null;
  weightOz: number | null;
  amazonAsin: string | null;
  asinMatchScore: number | null;
  status: string;
  fbStatus: string | null;
};

export type LineupItem = {
  id: string;
  productId: string;
  sortOrder: number;
  amazonUrl: string | null;
  amazonVerified: boolean;
  amazonPriceCents: number | null;
  salePrice: number | null;
  weightOz: number | null;
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  tiktokListed: boolean;
  soldAt: string | null;
  notes: string | null;
  quantity: number;
  dimsSource: string | null;
  specsNote: string | null;
  amazonTitle: string | null;
  amazonPriceAt: string | null;
  specsCheckedAt: string | null;
  whatnot: { category?: string; subCategory?: string; condition?: string; hazmat?: string; shippingProfile?: string; source?: string } | null;
  product: LineupProduct;
};

export type Lineup = {
  id: string; slug: string; name: string; currentIndex: number; active: boolean; items: LineupItem[];
  whatnot: { type?: "Auction" | "Buy it Now"; startPrice?: number; heavyProfile?: string } | null;
};
export type LineupSummary = Omit<Lineup, "items"> & { itemCount: number };

export type PickerProduct = {
  id: string;
  title: string;
  thumb: string | null;
  status: string;
  fbStatus: string | null;
  targetPrice: number | null;
  minPrice: number | null;
  aiSuggestedPrice: number | null;
  amazonAsin: string | null;
  asinMatchScore: number | null;
  weightOz: number | null;
  inLineup: boolean;
};

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

/** Whole-percent saving vs the cached Amazon price, or null when either side is missing / not a saving. */
export function pctUnderAmazon(salePrice: number | null, amazonPriceCents: number | null): number | null {
  if (!salePrice || !amazonPriceCents) return null;
  const pct = Math.round((1 - salePrice / (amazonPriceCents / 100)) * 100);
  return pct > 0 ? pct : null;
}

export function dimsMissing(i: LineupItem): boolean {
  return !i.weightOz || !i.lengthIn || !i.widthIn || !i.heightIn;
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard redirect to the login page on a 401; this helper has no router
    window.location.assign(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    throw new Error("Signed out");
  }
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j as T;
}
