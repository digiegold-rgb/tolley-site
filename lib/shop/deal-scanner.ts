/**
 * Retail Deal Scanner — our own "scavenger.ai".
 *
 * Finds genuine markdowns / clearance / Special-Buy items at big-box retailers
 * and (optionally) validates resale value against eBay comps.
 *
 * WHY MARKDOWN-FIRST: empirically, full-price big-box items don't flip — there's
 * no margin over eBay net resale. The money is in items discounted off MSRP. The
 * Home Depot SerpAPI *search* endpoint doesn't expose discounts, but the
 * *product* endpoint does, via `promotion` = {type, save, percentage, original}.
 * So the pipeline is: cheap search to gather candidate SKUs → enrich a capped
 * sample through the product endpoint to read the real discount → keep the ones
 * marked down past a threshold. The discount % is the deal signal (like
 * scavenger.ai's clearance detection); eBay comps are optional resale sanity.
 *
 * QUOTA (SerpAPI Starter = 1k/mo, shared with dossier + ASIN cron):
 *   per run ≈ (queries) search calls + (DEAL_MAX_ENRICH) product calls
 *            + (DEAL_MAX_COMPS) eBay calls when DEAL_EBAY_COMP=true
 *   Defaults (6 + 12 + 0) × 3 runs/week ≈ 230/mo.
 */

import { prisma } from "@/lib/prisma";
import { serpapiCall, serpapiKey, type SerpapiEngine } from "@/lib/serpapi";
import { ebaySoldComps } from "@/lib/shop/resale-comps";

// ── Tunables (env-overridable) ───────────────────────────────────────────────
const ZIP = process.env.DEAL_SCAN_ZIP || "64052";
const MIN_DISCOUNT_PCT = Number(process.env.DEAL_MIN_DISCOUNT_PCT || "20");
const ALERT_DISCOUNT_PCT = Number(process.env.DEAL_ALERT_DISCOUNT_PCT || "40");
const MAX_ENRICH = Number(process.env.DEAL_MAX_ENRICH || "12");
const PRODUCTS_PER_QUERY = Number(process.env.DEAL_PRODUCTS_PER_QUERY || "12");
const MAX_BUY_PRICE = Number(process.env.DEAL_MAX_BUY_PRICE || "400");
// eBay resale validation is opt-in (extra quota + active-listing prices).
const EBAY_COMP = process.env.DEAL_EBAY_COMP === "true";
const MAX_COMPS = Number(process.env.DEAL_MAX_COMPS || "6");

const RETAILERS = (process.env.DEAL_RETAILERS || "home_depot")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean) as RetailerKey[];

// Resale-friendly, markdown-prone categories. Override via DEAL_SCAN_QUERIES
// (pipe-separated).
const DEFAULT_QUERIES = [
  "power tool combo kit",
  "cordless drill kit",
  "smart thermostat",
  "robot vacuum",
  "pressure washer",
  "smart lock deadbolt",
];
const QUERIES = (process.env.DEAL_SCAN_QUERIES
  ? process.env.DEAL_SCAN_QUERIES.split("|")
  : DEFAULT_QUERIES
)
  .map((s) => s.trim())
  .filter(Boolean);

type RetailerKey = "home_depot";

interface RawProduct {
  externalId: string;
  title: string;
  price: number;
  url: string | null;
  imageUrl: string | null;
  brand: string | null;
  model: string | null;
}

interface Markdown {
  originalPrice: number | null;
  savings: number | null;
  discountPct: number | null;
  promoType: string | null;
  storeName: string | null;
  inStockQty: number | null;
}

export interface DealScanResult {
  retailers: string[];
  queriesRun: number;
  productsSeen: number;
  enriched: number;
  finds: number;
  alerts: number;
  comped: number;
  errors: string[];
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
function firstString(...vals: unknown[]): string | null {
  for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

// ── Home Depot search → candidate products ──────────────────────────────────
async function fetchCandidates(query: string): Promise<RawProduct[]> {
  const result = await serpapiCall<{ products?: Record<string, unknown>[] }>({
    engine: "home_depot",
    integration: "deal-scanner",
    params: { q: query, delivery_zip: ZIP, country: "us" },
    timeoutMs: 20000,
    costUnits: 1,
  });
  if (!result.ok || !result.data?.products) return [];
  return result.data.products
    .map((p) => {
      const id = firstString(p.product_id, p.itemId);
      const price = num(p.price);
      if (!id || price <= 0) return null;
      const thumbs = p.thumbnails as unknown;
      const image = Array.isArray(thumbs)
        ? firstString(thumbs[0])
        : firstString(p.thumbnail);
      return {
        externalId: id,
        title: String(p.title || "").trim(),
        price,
        url: firstString(p.link),
        imageUrl: image,
        brand: firstString(p.brand),
        model: firstString(p.model_number),
      } as RawProduct;
    })
    .filter((p): p is RawProduct => !!p && p.price <= MAX_BUY_PRICE)
    .slice(0, PRODUCTS_PER_QUERY);
}

// ── Product endpoint → real markdown (promotion + fulfillment) ───────────────
async function fetchMarkdown(externalId: string): Promise<Markdown | null> {
  const result = await serpapiCall<{ product_results?: Record<string, unknown> }>({
    engine: "home_depot_product" as SerpapiEngine,
    integration: "deal-scanner-enrich",
    params: { product_id: externalId, delivery_zip: ZIP },
    timeoutMs: 20000,
    costUnits: 1,
  });
  const pr = result.data?.product_results;
  if (!pr) return null;

  const current = num(pr.price);
  const promo = (pr.promotion as Record<string, unknown>) || {};
  const original = num(promo.original);
  const save = num(promo.save);
  const pct = num(promo.percentage);
  const fulfillment = (pr.fulfillment as Record<string, unknown>) || {};

  // Derive any missing field from the others where possible.
  const savings = save > 0 ? save : original > current ? +(original - current).toFixed(2) : null;
  const discountPct =
    pct > 0
      ? pct
      : original > 0 && current > 0
        ? +(((original - current) / original) * 100).toFixed(1)
        : null;

  return {
    originalPrice: original > 0 ? original : null,
    savings,
    discountPct,
    promoType: firstString(promo.type),
    storeName: firstString(fulfillment.store),
    inStockQty: num(fulfillment.quantity) || null,
  };
}

function compQuery(p: RawProduct): string {
  if (p.brand && p.model) return `${p.brand} ${p.model}`;
  if (p.model) return p.model;
  return p.title.split(/\s+/).slice(0, 7).join(" ");
}

export async function runDealScan(): Promise<DealScanResult> {
  const res: DealScanResult = {
    retailers: RETAILERS.map((r) => (r === "home_depot" ? "Home Depot" : r)),
    queriesRun: 0,
    productsSeen: 0,
    enriched: 0,
    finds: 0,
    alerts: 0,
    comped: 0,
    errors: [],
  };

  if (!serpapiKey()) {
    res.errors.push("SERPAPI_KEY missing — cannot scan");
    return res;
  }

  // 1. Gather candidate SKUs (cheap search), deduped, round-robin across queries
  //    so the enrich budget samples the whole pool, not just the first query.
  const byQuery: RawProduct[][] = [];
  for (const query of QUERIES) {
    try {
      const products = await fetchCandidates(query);
      res.queriesRun++;
      res.productsSeen += products.length;
      byQuery.push(products);
    } catch (e) {
      res.errors.push(`search "${query}": ${e instanceof Error ? e.message : e}`);
      byQuery.push([]);
    }
  }
  const pool: RawProduct[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; ; i++) {
    let added = false;
    for (const list of byQuery) {
      if (i < list.length) {
        added = true;
        const p = list[i];
        if (!seenIds.has(p.externalId)) {
          seenIds.add(p.externalId);
          pool.push(p);
        }
      }
    }
    if (!added) break;
  }

  // 2. Enrich a capped sample via the product endpoint; keep real markdowns.
  const found: { p: RawProduct; mk: Markdown }[] = [];
  for (const p of pool.slice(0, MAX_ENRICH)) {
    try {
      const mk = await fetchMarkdown(p.externalId);
      res.enriched++;
      if (mk && (mk.discountPct ?? 0) >= MIN_DISCOUNT_PCT) {
        found.push({ p, mk });
      }
    } catch (e) {
      res.errors.push(`enrich ${p.externalId}: ${e instanceof Error ? e.message : e}`);
    }
  }
  found.sort((a, b) => (b.mk.discountPct ?? 0) - (a.mk.discountPct ?? 0));

  // 3. Optional eBay resale validation on the deepest markdowns (quota-capped).
  const comps = new Map<string, { median: number; net: number; samples: number }>();
  if (EBAY_COMP) {
    for (const f of found.slice(0, MAX_COMPS)) {
      try {
        const c = await ebaySoldComps(compQuery(f.p));
        res.comped++;
        if (c) comps.set(f.p.externalId, { median: c.median, net: c.netMedian, samples: c.count });
      } catch {
        /* comp is best-effort */
      }
    }
  }

  // 4. Upsert finds (dedupe by retailer+externalId; preserve human status).
  for (const { p, mk } of found) {
    const c = comps.get(p.externalId);
    const estProfit = c ? +(c.net - p.price).toFixed(2) : null;
    const marginPct = c && p.price > 0 ? +(((c.net - p.price) / p.price) * 100).toFixed(1) : null;
    try {
      const existing = await prisma.retailDeal.findUnique({
        where: { retailer_externalId: { retailer: "home_depot", externalId: p.externalId } },
        select: { id: true },
      });
      const data = {
        retailer: "home_depot",
        retailerLabel: "Home Depot",
        externalId: p.externalId,
        title: p.title,
        imageUrl: p.imageUrl,
        productUrl: p.url,
        brand: p.brand,
        model: p.model,
        zip: ZIP,
        buyPrice: p.price,
        originalPrice: mk.originalPrice,
        savings: mk.savings,
        discountPct: mk.discountPct,
        promoType: mk.promoType,
        onClearance: (mk.discountPct ?? 0) >= ALERT_DISCOUNT_PCT,
        storeName: mk.storeName,
        inStockQty: mk.inStockQty,
        resaleMedian: c?.median ?? null,
        resaleNetMedian: c?.net ?? null,
        resaleSamples: c?.samples ?? 0,
        estProfit,
        marginPct,
      };
      if (existing) {
        await prisma.retailDeal.update({
          where: { id: existing.id },
          data: { ...data, lastSeenAt: new Date() },
        });
      } else {
        await prisma.retailDeal.create({ data: { ...data, status: "new" } });
        res.finds++;
      }
    } catch (e) {
      res.errors.push(`upsert ${p.externalId}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 5. Alert the deepest NEW discounts to the routines inbox.
  const alertable = found.filter((f) => (f.mk.discountPct ?? 0) >= ALERT_DISCOUNT_PCT).slice(0, 10);
  if (alertable.length > 0) {
    res.alerts = alertable.length;
    await postDealAlert(
      alertable.map((f) => ({ ...f, comp: comps.get(f.p.externalId) }))
    ).catch((e) => res.errors.push(`alert: ${e instanceof Error ? e.message : e}`));
  }

  return res;
}

interface AlertItem {
  p: RawProduct;
  mk: Markdown;
  comp?: { median: number; net: number; samples: number };
}

async function postDealAlert(items: AlertItem[]): Promise<void> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://tolley.io";
  const secret = process.env.SYNC_SECRET;
  if (!secret) return;

  const lines = items
    .map((f, i) => {
      const flip = f.comp
        ? ` · eBay ~$${f.comp.net.toFixed(0)} (${f.comp.samples} comps)`
        : "";
      const was = f.mk.originalPrice ? ` (was $${f.mk.originalPrice.toFixed(0)})` : "";
      return `${i + 1}. **${f.p.title.slice(0, 64)}** — $${f.p.price.toFixed(0)}${was} · **${f.mk.discountPct}% off**${flip}${f.p.url ? `\n   ${f.p.url}` : ""}`;
    })
    .join("\n");

  const body = `Deal Scanner found **${items.length}** markdowns at ${ALERT_DISCOUNT_PCT}%+ off at Home Depot:\n\n${lines}\n\n_Discount is from Home Depot's own promotion data. ${
    items.some((f) => f.comp)
      ? "eBay figures are net of fees/shipping and use active-listing comps — verify the exact item before sourcing."
      : "Resale comps not run this pass — check eBay sold before sourcing."
  }_`;

  await fetch(`${base}/api/routines/inbox`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sync-secret": secret },
    body: JSON.stringify({
      slug: "retail-deal-scanner",
      title: `🛒 ${items.length} Home Depot markdowns · top ${items[0].mk.discountPct}% off`,
      body,
      severity: "action",
      payload: {
        items: items.map((f) => ({
          title: f.p.title,
          buyPrice: f.p.price,
          originalPrice: f.mk.originalPrice,
          discountPct: f.mk.discountPct,
          savings: f.mk.savings,
          promoType: f.mk.promoType,
          ebayNet: f.comp?.net ?? null,
          url: f.p.url,
          externalId: f.p.externalId,
        })),
      },
    }),
    signal: AbortSignal.timeout(15000),
  });
}
