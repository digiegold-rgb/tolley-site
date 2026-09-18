// Whatnot bulk-import CSV for a /stream lineup. Column names and every controlled value come from Whatnot's
// official template (lib/stream/whatnot-values.json, its "Values" tab) — they must match EXACTLY, so nothing here
// invents a string: weights map onto the template's shipping profiles, conditions come from the sub category's list.
import VALUES from "./whatnot-values.json";

export type WhatnotItemFields = {
  category?: string;
  subCategory?: string;
  condition?: string;
  hazmat?: string;
  /** Exact name of a custom shipping profile created in Whatnot — overrides the weight-based pick. */
  shippingProfile?: string;
  source?: "ai" | "manual";
};

export type WhatnotLineupSettings = {
  type?: "Auction" | "Buy it Now";
  /** Auction starting bid in dollars. */
  startPrice?: number;
  /** Custom Whatnot shipping profile used for anything over the template's 14 lb ceiling. */
  heavyProfile?: string;
};

export const WHATNOT = VALUES as {
  header: string[]; types: string[]; hazmat: string[]; shippingUS: string[]; categories: string[];
  sub: Record<string, string[]>; subRaw: Record<string, string>; cond: Record<string, string[]>;
};

export const FALLBACK_CATEGORY = "and Whatnot";
export const FALLBACK_SUB = "Other";

// Upper bound in ounces for each template profile, in order. The template has no 7–9 lb tier: 6–14 lb → "10-14 lbs".
const PROFILE_MAX_OZ: [number, string][] = [
  [1, "0-1 oz"], [3, "1-3 oz"], [7, "4-7 oz"], [11, "8-11 oz"], [15, "12-15 oz"], [16, "1 lb"],
  [32, "1-2 lbs"], [48, "2-3 lbs"], [64, "3-4 lbs"], [96, "4-6 lbs"], [224, "10-14 lbs"],
];

/** Template shipping profile for a boxed weight, or null when it is missing or heavier than Whatnot's 14 lb ceiling. */
export function templateProfileFor(weightOz: number | null | undefined): string | null {
  if (!weightOz || weightOz <= 0) return null;
  for (const [max, name] of PROFILE_MAX_OZ) if (weightOz <= max) return name;
  return null;
}

/** First "new" grade in the sub category's own condition list ("Brand New" / "New with box" / "New With Tags" / "New"). */
export function defaultCondition(subCategory: string | undefined): string {
  const list = (subCategory && WHATNOT.cond[subCategory]) || [];
  return list.find((c) => /^(brand )?new( with (box|tags))?$/i.test(c)) ?? list.find((c) => /^new/i.test(c) && !/without|defect/i.test(c)) ?? "";
}

export function normalizeItemFields(raw: unknown): WhatnotItemFields {
  const w = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const category = typeof w.category === "string" && WHATNOT.categories.includes(w.category) ? w.category : undefined;
  const subs = category ? WHATNOT.sub[category] ?? [] : [];
  const subCategory = typeof w.subCategory === "string" && subs.includes(w.subCategory) ? w.subCategory : undefined;
  const conds = subCategory ? WHATNOT.cond[subCategory] ?? [] : [];
  return {
    category,
    subCategory,
    condition: typeof w.condition === "string" && conds.includes(w.condition) ? w.condition : undefined,
    hazmat: typeof w.hazmat === "string" && WHATNOT.hazmat.includes(w.hazmat) ? w.hazmat : undefined,
    shippingProfile: typeof w.shippingProfile === "string" && w.shippingProfile.trim() ? w.shippingProfile.trim().slice(0, 80) : undefined,
    source: w.source === "manual" ? "manual" : w.source === "ai" ? "ai" : undefined,
  };
}

export function normalizeLineupSettings(raw: unknown): Required<Pick<WhatnotLineupSettings, "type" | "startPrice">> & { heavyProfile: string } {
  const w = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const start = typeof w.startPrice === "number" && w.startPrice >= 0 && w.startPrice < 100000 ? w.startPrice : 1;
  return {
    type: w.type === "Buy it Now" ? "Buy it Now" : "Auction",
    startPrice: start,
    heavyProfile: typeof w.heavyProfile === "string" ? w.heavyProfile.trim().slice(0, 80) : "",
  };
}

export type ExportItem = {
  title: string; description: string | null; imageUrls: string[]; sku: string | null; productId: string; costBasis: number | null;
  quantity: number; salePrice: number | null; weightOz: number | null; soldAt: Date | string | null; whatnot: unknown;
};

export type ExportRow = { cells: string[]; title: string; warnings: string[] };

export function buildRows(items: ExportItem[], settingsRaw: unknown): ExportRow[] {
  const s = normalizeLineupSettings(settingsRaw);
  return items.filter((i) => !i.soldAt).map((i) => {
    const w = normalizeItemFields(i.whatnot);
    const warnings: string[] = [];
    const category = w.category ?? FALLBACK_CATEGORY;
    const subList = WHATNOT.sub[category] ?? [];
    const sub = w.subCategory ?? (w.category ? "" : FALLBACK_SUB);
    if (!w.category) warnings.push("no category picked — exported as “and Whatnot › Other”");
    else if (subList.length && !sub) warnings.push("no sub category");
    const condition = w.condition ?? defaultCondition(sub || undefined);

    let profile = w.shippingProfile ?? templateProfileFor(i.weightOz) ?? "";
    if (!profile) {
      if (!i.weightOz) warnings.push("no weight — shipping profile left blank");
      else if (s.heavyProfile) profile = s.heavyProfile;
      else warnings.push(`${(i.weightOz / 16).toFixed(1)} lb is over Whatnot’s 14 lb template ceiling — needs a custom shipping profile`);
    }

    const price = s.type === "Auction" ? s.startPrice : i.salePrice;
    if (s.type === "Buy it Now" && !price) warnings.push("no sale price");
    if (!i.imageUrls.length) warnings.push("no photos");

    const cells = [
      category,
      WHATNOT.subRaw[sub] ?? sub,
      i.title.slice(0, 200),
      (i.description?.trim() || i.title).slice(0, 5000),
      String(Math.max(1, i.quantity || 1)),
      s.type,
      price !== null && price !== undefined ? String(price) : "",
      profile,
      s.type === "Buy it Now" ? "TRUE" : "FALSE",
      w.hazmat ?? "Not Hazmat",
      condition,
      i.costBasis ? String(i.costBasis) : "",
      i.sku || i.productId.slice(-10),
      ...Array.from({ length: 8 }, (_, k) => (i.imageUrls[k]?.startsWith("https://") ? i.imageUrls[k] : "")),
    ];
    return { cells, title: i.title, warnings };
  });
}

const esc = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function toCsv(rows: ExportRow[]): string {
  return [WHATNOT.header, ...rows.map((r) => r.cells)].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
