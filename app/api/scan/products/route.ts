/**
 * POST /api/scan/products/run — Product scanner
 *
 * Currently: checks Pool360 product stock levels, flags OOS/low-stock items.
 * Future: competitor price scraping (Leslie's, Amazon, Walmart).
 *
 * Auth: x-sync-secret or CRON_SECRET
 * Triggered by: DGX cron at 3:00 AM
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logScanActivity, startScanRun, completeScanRun } from "@/lib/scan/log";

function checkAuth(req: NextRequest): boolean {
  const syncSecret = req.headers.get("x-sync-secret");
  if (syncSecret && syncSecret === process.env.SYNC_SECRET) return true;
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = await startScanRun("products", { source: "auto-scan" });

  try {
    await logScanActivity("products", "Product scan started", {
      event: "scan_start",
      severity: "info",
    });

    // ── Stock level audit ──
    const [totalProducts, oosProducts, lowStockProducts, recentlyUpdated] = await Promise.all([
      prisma.poolProduct.count(),
      prisma.poolProduct.count({ where: { stockStatus: "out-of-stock" } }),
      prisma.poolProduct.count({ where: { stockStatus: "low-stock" } }),
      prisma.poolProduct.count({
        where: {
          lastSyncedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Find products that went OOS since last scan
    const newOos = await prisma.poolProduct.findMany({
      where: {
        stockStatus: "out-of-stock",
        lastSyncedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { sku: true, name: true, costPrice: true },
      take: 20,
    });

    // Find products back in stock
    const backInStock = await prisma.poolProduct.findMany({
      where: {
        stockStatus: "in-stock",
        stockQty: { gt: 0 },
        lastSyncedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      select: { sku: true, name: true },
      take: 20,
    });

    // Stale products (not synced in 7+ days)
    const staleProducts = await prisma.poolProduct.count({
      where: {
        OR: [
          { lastSyncedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          { lastSyncedAt: null },
        ],
      },
    });

    const results = {
      totalProducts,
      oosProducts,
      lowStockProducts,
      recentlyUpdated,
      newOosCount: newOos.length,
      backInStockCount: backInStock.length,
      staleProducts,
    };

    // Log alerts for OOS items
    if (newOos.length > 0) {
      const names = newOos.slice(0, 5).map((p) => p.name).join(", ");
      await logScanActivity("products", `${newOos.length} products now out of stock: ${names}`, {
        event: "alert",
        severity: "warning",
        meta: { oosSkus: newOos.map((p) => p.sku) },
      });
    }

    // Log back in stock
    if (backInStock.length > 0) {
      const names = backInStock.slice(0, 5).map((p) => p.name).join(", ");
      await logScanActivity("products", `${backInStock.length} products back in stock: ${names}`, {
        event: "discovery",
        severity: "success",
        meta: { skus: backInStock.map((p) => p.sku) },
      });
    }

    // Stale warning
    if (staleProducts > 0) {
      await logScanActivity("products", `${staleProducts} products not synced in 7+ days`, {
        event: "alert",
        severity: "warning",
      });
    }

    await completeScanRun(runId, {
      itemsFound: totalProducts,
      alertsGen: newOos.length + (staleProducts > 0 ? 1 : 0),
    });

    await logScanActivity("products", `Product scan complete: ${totalProducts} tracked, ${oosProducts} OOS, ${lowStockProducts} low stock`, {
      event: "scan_complete",
      severity: "info",
      meta: results,
    });

    return NextResponse.json({ ok: true, ...results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await completeScanRun(runId, { error: msg });
    await logScanActivity("products", `Product scan failed: ${msg}`, { event: "error", severity: "alert" });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
