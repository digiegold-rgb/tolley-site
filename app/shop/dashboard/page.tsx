"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { InventoryTable } from "@/components/shop/InventoryTable";
import { ProductForm } from "@/components/shop/ProductForm";
import { PLATFORMS } from "@/lib/shop/types";

interface OverviewData {
  overview: {
    totalProducts: number;
    activeListings: number;
    draftProducts: number;
    soldThisPeriod: number;
    totalRevenue: number;
    totalProfit: number;
    avgMargin: number;
    lotCount: number;
    activeLots: number;
  };
  recentSales: {
    id: string;
    title: string;
    salePrice: number;
    platform: string;
    netProfit: number | null;
    soldAt: string;
    product: { id: string; title: string; imageUrls: string[] } | null;
  }[];
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-white/40">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color || "text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/30">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/shop/analytics?days=7")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const platformLabel = (p: string) =>
    PLATFORMS.find((pl) => pl.value === p)?.label || p;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Overview</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="shop-btn-primary rounded-lg px-4 py-2 text-sm"
        >
          {showForm ? "Cancel" : "+ Add Product"}
        </button>
      </div>

      {showForm && (
        <div className="mt-4">
          <ProductForm
            onSuccess={() => {
              setShowForm(false);
              refresh();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Stats grid */}
      {data && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Active Listings" value={String(data.overview.activeListings)} color="text-blue-400" />
          <StatCard label="Revenue (7d)" value={`$${data.overview.totalRevenue.toLocaleString()}`} color="text-green-400" />
          <StatCard label="Profit (7d)" value={`$${data.overview.totalProfit.toLocaleString()}`} color="text-emerald-400" />
          <StatCard label="Avg Margin" value={`${data.overview.avgMargin}%`} color="text-purple-400" />
          <StatCard label="Draft" value={String(data.overview.draftProducts)} />
          <StatCard label="Sold (7d)" value={String(data.overview.soldThisPeriod)} color="text-green-400" />
          <StatCard label="Total Products" value={String(data.overview.totalProducts)} />
          <StatCard label="Active Lots" value={String(data.overview.activeLots)} sub={`${data.overview.lotCount} total`} />
        </div>
      )}

      {/* Recent sales */}
      {data && data.recentSales.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-white/60">Recent Sales</h2>
          <div className="space-y-2">
            {data.recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{sale.title}</p>
                  <p className="text-xs text-white/30">
                    {platformLabel(sale.platform)} &middot;{" "}
                    {new Date(sale.soldAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm font-semibold text-green-400">
                    ${sale.salePrice}
                  </p>
                  {sale.netProfit !== null && (
                    <p className={`text-xs ${sale.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {sale.netProfit >= 0 ? "+" : ""}${sale.netProfit.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/shop/dashboard/analytics" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center transition hover:bg-white/[0.06]">
          <p className="text-2xl">📈</p>
          <p className="mt-1 text-xs text-white/50">Analytics</p>
        </Link>
        <Link href="/shop/dashboard/trends" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center transition hover:bg-white/[0.06]">
          <p className="text-2xl">🔥</p>
          <p className="mt-1 text-xs text-white/50">Trends</p>
        </Link>
        <Link href="/shop/dashboard/arbitrage" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center transition hover:bg-white/[0.06]">
          <p className="text-2xl">💰</p>
          <p className="mt-1 text-xs text-white/50">Arbitrage</p>
        </Link>
        <Link href="/shop/dashboard/affiliates" className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center transition hover:bg-white/[0.06]">
          <p className="text-2xl">🔗</p>
          <p className="mt-1 text-xs text-white/50">Affiliates</p>
        </Link>
      </div>

      {/* Inventory table */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-white/60">Inventory</h2>
        <InventoryTable refreshKey={refreshKey} onRefresh={refresh} />
      </div>
    </div>
  );
}
