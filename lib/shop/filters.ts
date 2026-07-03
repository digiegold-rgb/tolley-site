import type { Prisma } from "@prisma/client";
import { SHOP_CATEGORIES, type ShopCategory } from "@/lib/shop";

export type ShopSort = "newest" | "az" | "price_asc" | "price_desc";

const SORTS: ReadonlySet<ShopSort> = new Set([
  "newest",
  "az",
  "price_asc",
  "price_desc",
]);

export interface ShopFilters {
  cat: ShopCategory | null;
  /** Stored as cents internally for precision; URL params use whole-dollar units. */
  minCents: number | null;
  maxCents: number | null;
  pickup: boolean;
  ship: boolean;
  sort: ShopSort;
  /**
   * Free-text search. Tokenized on whitespace; each token must hit somewhere
   * in title/description/brand/category (AND across tokens, OR across fields).
   * Substring-match is intentional so partial words like "pend" find "pendant"
   * — the public storefront is the kind of place people search by feel.
   */
  q: string | null;
}

export const DEFAULT_SHOP_FILTERS: ShopFilters = {
  cat: null,
  minCents: null,
  maxCents: null,
  pickup: false,
  ship: false,
  sort: "newest",
  q: null,
};

/** Cap query length so a pasted novel can't blow up the SQL. */
const MAX_QUERY_LEN = 100;
/** Cap tokens per query to avoid pathological N×M Prisma trees. */
const MAX_QUERY_TOKENS = 8;

export function parseSearchQuery(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().slice(0, MAX_QUERY_LEN);
  return trimmed.length > 0 ? trimmed : null;
}

export function tokenizeSearchQuery(q: string): string[] {
  return q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1)
    .slice(0, MAX_QUERY_TOKENS);
}

function asString(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === "string" ? v : null;
}

function isShopCategory(value: string): value is ShopCategory {
  return (SHOP_CATEGORIES as readonly string[]).includes(value);
}

function parseDollarsToCents(raw: string | null): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  // Whole dollars in URL → cents in filter
  return Math.round(n * 100);
}

function isTruthyFlag(raw: string | null): boolean {
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function parseShopFilters(
  sp: Record<string, string | string[] | undefined>
): ShopFilters {
  const catRaw = asString(sp.cat);
  const cat = catRaw && isShopCategory(catRaw) ? catRaw : null;

  const minCents = parseDollarsToCents(asString(sp.min));
  const maxCents = parseDollarsToCents(asString(sp.max));

  const pickup = isTruthyFlag(asString(sp.pickup));
  const ship = isTruthyFlag(asString(sp.ship));

  const sortRaw = asString(sp.sort);
  const sort: ShopSort =
    sortRaw && (SORTS as ReadonlySet<string>).has(sortRaw)
      ? (sortRaw as ShopSort)
      : "newest";

  const q = parseSearchQuery(asString(sp.q));

  return { cat, minCents, maxCents, pickup, ship, sort, q };
}

export function buildPrismaWhere(
  filters: ShopFilters,
  base: Prisma.ProductWhereInput
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { ...base };

  if (filters.cat) {
    where.category = filters.cat;
  }

  // targetPrice is stored in dollars (Float). Convert cents → dollars for comparison.
  const priceFilter: Prisma.FloatNullableFilter<"Product"> = {};
  if (filters.minCents !== null) {
    priceFilter.gte = filters.minCents / 100;
  }
  if (filters.maxCents !== null) {
    priceFilter.lte = filters.maxCents / 100;
  }
  if (priceFilter.gte !== undefined || priceFilter.lte !== undefined) {
    where.targetPrice = priceFilter;
  }

  // Shipping rules:
  //   pickup=true & ship=false  → shipPrice IS NULL  (local-pickup only)
  //   ship=true   & pickup=false → shipPrice IS NOT NULL  (must ship)
  //   both true OR both false  → no constraint (show everything)
  if (filters.pickup && !filters.ship) {
    where.shipPrice = null;
  } else if (filters.ship && !filters.pickup) {
    where.shipPrice = { not: null };
  }

  if (filters.q) {
    const tokens = tokenizeSearchQuery(filters.q);
    if (tokens.length > 0) {
      const tokenClauses: Prisma.ProductWhereInput[] = tokens.map((tok) =>
        buildTokenWhere(tok)
      );
      where.AND = [...((where.AND as Prisma.ProductWhereInput[]) ?? []), ...tokenClauses];
    }
  }

  return where;
}

/**
 * One Prisma `OR` clause for a single search token: matches anywhere in
 * title/description/brand/category, case-insensitive. We don't anchor on word
 * boundaries — buyers type fragments ("pend" → "pendant lamp") and we want
 * those to hit. Ranking happens in `buildPrismaOrderBy` via the existing
 * `sort` axis; full-text rank would require pg_trgm/tsvector wiring we don't
 * have yet.
 */
function buildTokenWhere(token: string): Prisma.ProductWhereInput {
  const contains: Prisma.StringFilter<"Product"> | Prisma.StringNullableFilter<"Product"> = {
    contains: token,
    mode: "insensitive",
  };
  return {
    OR: [
      { title: contains as Prisma.StringFilter<"Product"> },
      { description: contains },
      { brand: contains },
      { category: contains },
    ],
  };
}

export function buildPrismaOrderBy(
  filters: ShopFilters
): Prisma.ProductOrderByWithRelationInput[] {
  switch (filters.sort) {
    case "az":
      return [{ title: "asc" }];
    case "price_asc":
      return [{ targetPrice: "asc" }, { createdAt: "desc" }];
    case "price_desc":
      return [{ targetPrice: "desc" }, { createdAt: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

export function filtersToSearchParams(filters: ShopFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.cat) params.set("cat", filters.cat);
  if (filters.minCents !== null) {
    // Convert cents back to dollars (whole-number string when possible)
    const dollars = filters.minCents / 100;
    params.set("min", Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2));
  }
  if (filters.maxCents !== null) {
    const dollars = filters.maxCents / 100;
    params.set("max", Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2));
  }
  if (filters.pickup) params.set("pickup", "1");
  if (filters.ship) params.set("ship", "1");
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.q) params.set("q", filters.q);
  return params;
}

export function hasAnyFilter(filters: ShopFilters): boolean {
  return (
    filters.cat !== null ||
    filters.minCents !== null ||
    filters.maxCents !== null ||
    filters.pickup ||
    filters.ship ||
    filters.sort !== "newest" ||
    filters.q !== null
  );
}
