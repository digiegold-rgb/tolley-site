import { prisma } from "@/lib/prisma";

// ─── Configuration ───────────────────────────────────────

const MARGIN_FLOOR_PCT = 20; // warn below this
const MARGIN_CRITICAL_PCT = 10; // critical below this
const OOS_TREND_DAYS = 14; // lookback for stock trend
const TRENDING_THRESHOLD = 10; // min events to be "trending"
const SORT_BOOST_THRESHOLD = 5; // min engagement to boost sort
const AUTO_FEATURE_TOP_N = 10; // auto-feature top N engaged products
const SNAPSHOT_INTERVAL_HOURS = 12; // min hours between snapshots

// ─── Main Intelligence Runner ────────────────────────────

export interface IntelligenceResult {
  snapshotsCaptured: number;
  insightsGenerated: number;
  sortAdjustments: number;
  featureUpdates: number;
  marginAlerts: number;
  oosWarnings: number;
  enrichmentFlags: number;
}

export async function runPoolsIntelligence(): Promise<IntelligenceResult> {
  const result: IntelligenceResult = {
    snapshotsCaptured: 0,
    insightsGenerated: 0,
    sortAdjustments: 0,
    featureUpdates: 0,
    marginAlerts: 0,
    oosWarnings: 0,
    enrichmentFlags: 0,
  };

  // 1. Capture daily stock/price snapshots
  result.snapshotsCaptured = await captureSnapshots();

  // 2. Analyze engagement and auto-tune sort order + featured
  const { sortAdjustments, featureUpdates, insightsGenerated: engInsights } =
    await analyzeEngagement();
  result.sortAdjustments = sortAdjustments;
  result.featureUpdates = featureUpdates;
  result.insightsGenerated += engInsights;

  // 3. Margin monitoring
  const marginAlerts = await analyzeMargins();
  result.marginAlerts = marginAlerts;
  result.insightsGenerated += marginAlerts;

  // 4. Stock intelligence / OOS prediction
  const oosWarnings = await analyzeStockTrends();
  result.oosWarnings = oosWarnings;
  result.insightsGenerated += oosWarnings;

  // 5. Content gap detection
  const enrichmentFlags = await analyzeContentGaps();
  result.enrichmentFlags = enrichmentFlags;
  result.insightsGenerated += enrichmentFlags;

  // 6. Expire old insights (>30 days, still "new")
  await prisma.poolInsight.updateMany({
    where: {
      status: "new",
      createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    data: { status: "dismissed" },
  });

  return result;
}

// ─── 1. Snapshot Capture ─────────────────────────────────

async function captureSnapshots(): Promise<number> {
  // Only capture if last snapshot is old enough
  const lastSnapshot = await prisma.poolStockSnapshot.findFirst({
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true },
  });

  if (
    lastSnapshot &&
    Date.now() - lastSnapshot.capturedAt.getTime() <
      SNAPSHOT_INTERVAL_HOURS * 60 * 60 * 1000
  ) {
    return 0;
  }

  const products = await prisma.poolProduct.findMany({
    where: { status: "active" },
    select: { sku: true, stockQty: true, costPrice: true, price: true },
  });

  if (products.length === 0) return 0;

  await prisma.poolStockSnapshot.createMany({
    data: products.map((p) => ({
      sku: p.sku,
      stockQty: p.stockQty,
      costPrice: p.costPrice,
      price: p.price,
    })),
  });

  return products.length;
}

// ─── 2. Engagement Analysis + Auto-Tune ──────────────────

async function analyzeEngagement(): Promise<{
  sortAdjustments: number;
  featureUpdates: number;
  insightsGenerated: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Count events per SKU in last 30 days
  const eventCounts = await prisma.poolProductEvent.groupBy({
    by: ["sku"],
    _count: { id: true },
    where: { createdAt: { gte: thirtyDaysAgo } },
    orderBy: { _count: { id: "desc" } },
  });

  if (eventCounts.length === 0) return { sortAdjustments: 0, featureUpdates: 0, insightsGenerated: 0 };

  // Cart adds weighted 3x, views 1x
  const cartAdds = await prisma.poolProductEvent.groupBy({
    by: ["sku"],
    _count: { id: true },
    where: { event: "cart_add", createdAt: { gte: thirtyDaysAgo } },
  });
  const cartMap = Object.fromEntries(cartAdds.map((c) => [c.sku, c._count.id]));

  // Calculate engagement score: views + 3*cart_adds
  const scores: { sku: string; score: number }[] = eventCounts.map((e) => ({
    sku: e.sku,
    score: e._count.id + (cartMap[e.sku] || 0) * 2, // cart adds already in total, add 2x bonus
  }));

  // Get current products
  const products = await prisma.poolProduct.findMany({
    where: { status: "active" },
    select: { sku: true, sortOrder: true, featured: true, stockStatus: true, name: true },
  });
  const productMap = Object.fromEntries(products.map((p) => [p.sku, p]));

  let sortAdjustments = 0;
  let featureUpdates = 0;
  let insightsGenerated = 0;

  // Auto-adjust sort order: more engagement = lower sortOrder (higher position)
  const engagedSkus = scores
    .filter((s) => s.score >= SORT_BOOST_THRESHOLD && productMap[s.sku])
    .slice(0, 50);

  for (let i = 0; i < engagedSkus.length; i++) {
    const { sku, score } = engagedSkus[i];
    const product = productMap[sku];
    if (!product) continue;

    // Boost sort: engaged products get sortOrder 1-50
    const targetSort = i + 1;
    if (product.sortOrder !== targetSort && product.stockStatus !== "out-of-stock") {
      await prisma.poolProduct.update({
        where: { sku },
        data: { sortOrder: targetSort },
      });
      sortAdjustments++;
    }
  }

  // Auto-feature: top N engaged in-stock products
  const topEngaged = scores
    .filter((s) => {
      const p = productMap[s.sku];
      return p && p.stockStatus !== "out-of-stock" && s.score >= TRENDING_THRESHOLD;
    })
    .slice(0, AUTO_FEATURE_TOP_N)
    .map((s) => s.sku);

  // Set featured for top engaged, unset for others
  const currentFeatured = products.filter((p) => p.featured).map((p) => p.sku);
  const toFeature = topEngaged.filter((sku) => !currentFeatured.includes(sku));
  const toUnfeature = currentFeatured.filter((sku) => !topEngaged.includes(sku));

  for (const sku of toFeature) {
    await prisma.poolProduct.update({ where: { sku }, data: { featured: true } });
    featureUpdates++;
  }
  for (const sku of toUnfeature) {
    await prisma.poolProduct.update({ where: { sku }, data: { featured: false } });
    featureUpdates++;
  }

  // Generate "trending" insights for high-engagement products
  const trending = scores.filter((s) => s.score >= TRENDING_THRESHOLD * 2);
  for (const { sku, score } of trending.slice(0, 5)) {
    const product = productMap[sku];
    if (!product) continue;

    const existing = await prisma.poolInsight.findFirst({
      where: { sku, type: "trending", status: "new" },
    });
    if (!existing) {
      await prisma.poolInsight.create({
        data: {
          type: "trending",
          severity: "info",
          sku,
          title: `Trending: ${product.name}`,
          body: `${score} engagement points in the last 30 days. Auto-boosted sort position.`,
          meta: { score, rank: scores.findIndex((s) => s.sku === sku) + 1 },
        },
      });
      insightsGenerated++;
    }
  }

  return { sortAdjustments, featureUpdates, insightsGenerated };
}

// ─── 3. Margin Monitoring ────────────────────────────────

async function analyzeMargins(): Promise<number> {
  const products = await prisma.poolProduct.findMany({
    where: { status: "active" },
    select: { sku: true, name: true, price: true, costPrice: true, category: true, brand: true },
  });

  let alerts = 0;

  for (const p of products) {
    if (p.costPrice == null) continue;

    const marginPct =
      p.price > 0 ? Math.round(((p.price - p.costPrice) / p.price) * 100) : 0;

    if (marginPct < 0) {
      // Negative margin — critical
      const existing = await prisma.poolInsight.findFirst({
        where: { sku: p.sku, type: "margin_alert", status: "new" },
      });
      if (!existing) {
        await prisma.poolInsight.create({
          data: {
            type: "margin_alert",
            severity: "critical",
            sku: p.sku,
            title: `Negative margin: ${p.name}`,
            body: `Selling at $${p.price.toFixed(2)} vs cost $${p.costPrice.toFixed(2)} (${marginPct}% margin). Losing money on every sale.`,
            meta: { marginPct, price: p.price, cost: p.costPrice, brand: p.brand },
          },
        });
        alerts++;
      }
    } else if (marginPct < MARGIN_CRITICAL_PCT) {
      const existing = await prisma.poolInsight.findFirst({
        where: { sku: p.sku, type: "margin_alert", status: "new" },
      });
      if (!existing) {
        await prisma.poolInsight.create({
          data: {
            type: "margin_alert",
            severity: "critical",
            sku: p.sku,
            title: `Critical margin: ${p.name}`,
            body: `Only ${marginPct}% margin ($${p.price.toFixed(2)} sell, $${p.costPrice.toFixed(2)} cost). Consider price increase.`,
            meta: {
              marginPct,
              price: p.price,
              cost: p.costPrice,
              suggestedPrice: Math.ceil(p.costPrice * 1.45),
            },
          },
        });
        alerts++;
      }
    } else if (marginPct < MARGIN_FLOOR_PCT) {
      const existing = await prisma.poolInsight.findFirst({
        where: { sku: p.sku, type: "margin_alert", status: "new" },
      });
      if (!existing) {
        await prisma.poolInsight.create({
          data: {
            type: "margin_alert",
            severity: "warning",
            sku: p.sku,
            title: `Low margin: ${p.name}`,
            body: `${marginPct}% margin is below the ${MARGIN_FLOOR_PCT}% floor. Cost: $${p.costPrice.toFixed(2)}, Sell: $${p.price.toFixed(2)}.`,
            meta: {
              marginPct,
              price: p.price,
              cost: p.costPrice,
              suggestedPrice: Math.ceil(p.costPrice * 1.45),
            },
          },
        });
        alerts++;
      }
    }

    // Check for margin drift via snapshots (cost went up but price didn't)
    const snapshots = await prisma.poolStockSnapshot.findMany({
      where: { sku: p.sku },
      orderBy: { capturedAt: "desc" },
      take: 2,
      select: { costPrice: true, price: true, capturedAt: true },
    });

    if (snapshots.length === 2) {
      const [latest, prev] = snapshots;
      if (
        latest.costPrice != null &&
        prev.costPrice != null &&
        latest.costPrice > prev.costPrice &&
        latest.price === prev.price
      ) {
        const costIncrease = latest.costPrice - prev.costPrice;
        const existing = await prisma.poolInsight.findFirst({
          where: { sku: p.sku, type: "price_suggest", status: "new" },
        });
        if (!existing) {
          await prisma.poolInsight.create({
            data: {
              type: "price_suggest",
              severity: "warning",
              sku: p.sku,
              title: `Cost increased: ${p.name}`,
              body: `Cost rose $${costIncrease.toFixed(2)} (from $${prev.costPrice.toFixed(2)} to $${latest.costPrice.toFixed(2)}) but sell price unchanged at $${p.price.toFixed(2)}. Margin shrinking.`,
              meta: {
                oldCost: prev.costPrice,
                newCost: latest.costPrice,
                currentPrice: p.price,
                suggestedPrice: Math.ceil(latest.costPrice * 1.45),
              },
            },
          });
          alerts++;
        }
      }
    }
  }

  return alerts;
}

// ─── 4. Stock Intelligence ───────────────────────────────

async function analyzeStockTrends(): Promise<number> {
  const cutoff = new Date(Date.now() - OOS_TREND_DAYS * 24 * 60 * 60 * 1000);

  // Get products that are currently in stock
  const inStockProducts = await prisma.poolProduct.findMany({
    where: { status: "active", stockStatus: { in: ["in-stock", "low-stock"] } },
    select: { sku: true, name: true, stockQty: true, brand: true },
  });

  let warnings = 0;

  for (const p of inStockProducts) {
    const snapshots = await prisma.poolStockSnapshot.findMany({
      where: { sku: p.sku, capturedAt: { gte: cutoff } },
      orderBy: { capturedAt: "asc" },
      select: { stockQty: true, capturedAt: true },
    });

    if (snapshots.length < 3) continue; // need enough data points

    // Check for consistent decline
    const quantities = snapshots
      .map((s) => s.stockQty)
      .filter((q): q is number => q != null);
    if (quantities.length < 3) continue;

    // Simple linear regression for trend
    const n = quantities.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = quantities.reduce((a, b) => a + b, 0);
    const sumXY = quantities.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // If slope is negative and current qty is low, warn
    if (slope < -0.5 && (p.stockQty ?? 0) <= 10) {
      const daysToOos =
        p.stockQty != null && slope < 0
          ? Math.round(p.stockQty / Math.abs(slope))
          : null;

      const existing = await prisma.poolInsight.findFirst({
        where: { sku: p.sku, type: "oos_predict", status: "new" },
      });
      if (!existing) {
        await prisma.poolInsight.create({
          data: {
            type: "oos_predict",
            severity: daysToOos != null && daysToOos <= 7 ? "critical" : "warning",
            sku: p.sku,
            title: `Stock declining: ${p.name}`,
            body: `Stock dropping at ~${Math.abs(slope).toFixed(1)} units/snapshot. Currently ${p.stockQty ?? "?"} units.${daysToOos ? ` Estimated OOS in ~${daysToOos} days.` : ""}`,
            meta: {
              currentQty: p.stockQty,
              slope: Math.round(slope * 100) / 100,
              daysToOos,
              trend: quantities,
            },
          },
        });
        warnings++;
      }
    }
  }

  return warnings;
}

// ─── 5. Content Gap Analysis ─────────────────────────────

async function analyzeContentGaps(): Promise<number> {
  const products = await prisma.poolProduct.findMany({
    where: { status: "active" },
    select: {
      sku: true,
      name: true,
      description: true,
      specs: true,
      imageUrl: true,
      upc: true,
      mfgPart: true,
      brand: true,
    },
  });

  let flags = 0;

  // Batch check: only create insights for products that don't already have one
  const existingEnrichment = await prisma.poolInsight.findMany({
    where: { type: "enrichment", status: "new" },
    select: { sku: true },
  });
  const existingSkus = new Set(existingEnrichment.map((e) => e.sku));

  for (const p of products) {
    if (existingSkus.has(p.sku)) continue;

    const missing: string[] = [];
    if (!p.description) missing.push("description");
    if (!p.specs) missing.push("specs");
    if (!p.imageUrl) missing.push("image");
    if (!p.upc) missing.push("UPC");
    if (!p.mfgPart) missing.push("mfg part#");

    if (missing.length === 0) continue;

    // Prioritize: more missing fields = higher severity
    const severity =
      missing.length >= 3 ? "warning" : missing.length >= 2 ? "info" : "info";

    // Only flag products missing 2+ fields to avoid noise
    if (missing.length < 2) continue;

    await prisma.poolInsight.create({
      data: {
        type: "enrichment",
        severity,
        sku: p.sku,
        title: `Incomplete: ${p.name}`,
        body: `Missing: ${missing.join(", ")}. Run deep scrape or manually add data.`,
        meta: { missing, brand: p.brand },
      },
    });
    flags++;
  }

  return flags;
}

// ─── Utility: Apply a price suggestion ───────────────────

export async function applyInsight(insightId: string): Promise<boolean> {
  const insight = await prisma.poolInsight.findUnique({
    where: { id: insightId },
  });
  if (!insight || !insight.sku) return false;

  const meta = insight.meta as Record<string, unknown> | null;

  if (
    (insight.type === "margin_alert" || insight.type === "price_suggest") &&
    meta?.suggestedPrice
  ) {
    await prisma.poolProduct.update({
      where: { sku: insight.sku },
      data: { price: meta.suggestedPrice as number },
    });
  }

  await prisma.poolInsight.update({
    where: { id: insightId },
    data: { status: "applied", appliedAt: new Date() },
  });

  return true;
}

export async function dismissInsight(insightId: string): Promise<boolean> {
  await prisma.poolInsight.update({
    where: { id: insightId },
    data: { status: "dismissed" },
  });
  return true;
}
