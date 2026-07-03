/**
 * Penny List — community-reported Home Depot $0.01 items.
 *
 * IMPORTANT REALITY: true penny prices ($0.01) are NOT in any online price feed.
 * Home Depot's site/app/API all show the regular price; the penny only exists in
 * the store register. So no scanner can confirm a penny online. The only real
 * signal is crowd-sourced: shoppers scan in-store and report SKUs that rang up
 * $0.01. PennyCentral aggregates those reports on a free public lead board; this
 * module pulls that board so the dashboard can show penny *targets* to verify in
 * person — the same data scavenger.ai's "penny" feature is built on.
 *
 * Treat every row as a LEAD, not a guarantee — penny status is store-specific
 * and short-lived.
 */

const SOURCE = "https://www.pennycentral.com/api/penny-list";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// KC-metro cities worth flagging when a penny item is reported nearby. The user
// is in Independence MO (moving to PA ~mid-2026 — PA is also flagged).
const NEAR_STATES = ["MO", "KS"];
const PA_STATES = ["PA"];

interface RawPenny {
  id?: string;
  sku?: string;
  name?: string;
  brand?: string;
  modelNumber?: string;
  upc?: string;
  homeDepotUrl?: string;
  price?: number;
  retailPrice?: number;
  status?: string;
  tier?: string;
  imageUrl?: string;
  lastSeenAt?: string;
  firstReportedAt?: string;
  locations?: Record<string, number>;
  cityLocations?: Record<string, Record<string, number>>;
}

export interface PennyItem {
  sku: string;
  name: string;
  brand: string | null;
  modelNumber: string | null;
  upc: string | null;
  homeDepotUrl: string | null;
  imageUrl: string | null;
  retailPrice: number | null;
  tier: string | null;
  lastSeenAt: string | null;
  totalStores: number;
  nearbyCount: number; // MO + KS store reports
  nearbyCities: string[]; // KC-area cities reporting it
  paCount: number; // PA store reports (relevant to the move)
  reportedStates: string[];
}

function summarize(r: RawPenny): PennyItem {
  const locs = r.locations || {};
  const cityLocs = r.cityLocations || {};
  const totalStores = Object.values(locs).reduce((a, b) => a + (b || 0), 0);
  const nearbyCount = NEAR_STATES.reduce((a, s) => a + (locs[s] || 0), 0);
  const paCount = PA_STATES.reduce((a, s) => a + (locs[s] || 0), 0);
  const nearbyCities: string[] = [];
  for (const s of NEAR_STATES) {
    for (const city of Object.keys(cityLocs[s] || {})) nearbyCities.push(`${city}, ${s}`);
  }
  return {
    sku: String(r.sku ?? r.id ?? ""),
    name: r.name ?? "(unnamed)",
    brand: r.brand ?? null,
    modelNumber: r.modelNumber ?? null,
    upc: r.upc ?? null,
    homeDepotUrl:
      r.homeDepotUrl ??
      (r.sku ? `https://www.homedepot.com/p/${r.sku}` : null),
    imageUrl: r.imageUrl ?? null,
    retailPrice: typeof r.retailPrice === "number" ? r.retailPrice : null,
    tier: r.tier ?? null,
    lastSeenAt: r.lastSeenAt ?? r.firstReportedAt ?? null,
    totalStores,
    nearbyCount,
    nearbyCities,
    paCount,
    reportedStates: Object.keys(locs),
  };
}

export interface PennyListResult {
  items: PennyItem[];
  total: number;
  fetchedAll: boolean;
  error: string | null;
}

/**
 * Fetch the full community penny list, normalized and ranked: items reported
 * near KC (MO/KS) first, then by how widely they're reported. Cached 5 min
 * (matches PennyCentral's update cadence). `nearOnly` keeps only KC-area leads.
 */
export async function fetchPennyList(opts?: {
  nearOnly?: boolean;
}): Promise<PennyListResult> {
  const all: RawPenny[] = [];
  let total = 0;
  let fetchedAll = true;

  try {
    // Page 1 tells us the page count; pull the rest (small — ~2 pages).
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(`${SOURCE}?page=${page}&perPage=50`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        // Revalidate every 5 minutes; penny leads move fast but not per-request.
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        fetchedAll = false;
        if (page === 1) return { items: [], total: 0, fetchedAll: false, error: `source HTTP ${res.status}` };
        break;
      }
      const data = (await res.json()) as { items?: RawPenny[]; total?: number; pageCount?: number };
      const items = data.items || [];
      all.push(...items);
      total = data.total ?? all.length;
      if (!data.pageCount || page >= data.pageCount) break;
    }
  } catch (e) {
    return {
      items: [],
      total: 0,
      fetchedAll: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  let items = all.map(summarize).filter((i) => i.sku);
  if (opts?.nearOnly) items = items.filter((i) => i.nearbyCount > 0);

  // Rank: KC-area reports first, then broadest availability.
  items.sort(
    (a, b) => b.nearbyCount - a.nearbyCount || b.totalStores - a.totalStores
  );

  return { items, total, fetchedAll, error: null };
}
