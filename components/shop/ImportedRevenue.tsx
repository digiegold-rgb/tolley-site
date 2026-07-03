"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface BusinessRow {
  business: string;
  rows: number;
  gross: number;
  cost: number;
  profit: number;
  inventory: number;
  sold: number;
  unsold: number;
}

interface ChannelRow {
  business: string;
  channel: string;
  rows: number;
  gross: number;
  cost: number;
  profit: number;
}

interface ItemRow {
  business: string;
  channel: string | null;
  item: string | null;
  profit: number | null;
  gross?: number | null;
  cost?: number | null;
}

interface OfficialTotals {
  business: string;
  gross: number | null;
  cost: number | null;
  profit: number | null;
  profitOptimistic: number | null;
  inventoryRem: number | null;
  sourceSheet: string;
}

interface Summary {
  totalCount: number;
  totals: { gross: number; cost: number; fees: number; profit: number; inventory: number };
  officialTotals: { gross: number; cost: number; profit: number; inventory: number; sourcesUsed: number };
  official: OfficialTotals[];
  byBusiness: BusinessRow[];
  byChannel: ChannelRow[];
  winners: ItemRow[];
  losers: ItemRow[];
  businessNames: string[];
  lastImport: { sourceFile: string; createdAt: string } | null;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ImportedRevenue() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    const url = filter ? `/api/shop/admin/revenue/summary?business=${encodeURIComponent(filter)}` : "/api/shop/admin/revenue/summary";
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [filter]);

  if (loading) {
    return <p className="mt-3 text-sm text-white/40">Loading imported revenue…</p>;
  }
  if (!data || data.totalCount === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <p className="text-sm text-white/60">
          No imported revenue yet. Drop your weekly Numbers/Excel export at{" "}
          <Link href="/shop/dashboard/tools/revenue" className="text-purple-300 underline">
            Tools → Revenue Import
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-[0.65rem] text-white/40">
          {data.totalCount} imported rows
          {data.lastImport && (
            <>
              {" "}· last import{" "}
              <span className="text-white/60">{data.lastImport.sourceFile}</span>{" "}
              {new Date(data.lastImport.createdAt).toLocaleDateString()}
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          <FilterPill active={!filter} onClick={() => setFilter("")}>All</FilterPill>
          {data.businessNames.map((b) => (
            <FilterPill key={b} active={filter === b} onClick={() => setFilter(b)}>
              {b}
            </FilterPill>
          ))}
        </div>
      </div>

      {/* Topline totals — prefers official Totals tabs when available */}
      {data.officialTotals?.sourcesUsed > 0 && (
        <p className="text-[0.65rem] text-emerald-300">
          Headline numbers below are from your Numbers Totals tabs (
          {data.officialTotals.sourcesUsed} businesses). Line-item rollups
          appear in the per-business table.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Gross"
          value={fmt(data.officialTotals?.gross || data.totals.gross)}
          color="text-white"
        />
        <Stat
          label="Cost"
          value={fmt(data.officialTotals?.cost || data.totals.cost)}
          color="text-white/70"
        />
        <Stat
          label="Profit"
          value={fmt(data.officialTotals?.profit || data.totals.profit)}
          color={
            (data.officialTotals?.profit ?? data.totals.profit) >= 0
              ? "text-emerald-300"
              : "text-red-300"
          }
        />
        <Stat
          label="Inventory remaining"
          value={fmt(data.officialTotals?.inventory || data.totals.inventory)}
          color="text-amber-200"
        />
      </div>

      {/* Per-business breakdown with reconciliation */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white/80">By business</h3>
        <p className="mt-1 text-[0.65rem] text-white/40">
          "Numbers" cols = your Totals tab. "Rollup" cols = sum of line items.
          Differences are normal — Totals tabs may use different formulas
          (e.g. excluding tax, only counting sold items).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[0.6rem] uppercase text-white/40">
              <tr className="border-b border-white/10">
                <th className="py-1.5 pr-3 text-left">Business</th>
                <th className="py-1.5 pr-3 text-right">Rows</th>
                <th className="py-1.5 pr-3 text-right">Numbers Gross</th>
                <th className="py-1.5 pr-3 text-right">Rollup Gross</th>
                <th className="py-1.5 pr-3 text-right">Numbers Cost</th>
                <th className="py-1.5 pr-3 text-right">Rollup Cost</th>
                <th className="py-1.5 pr-3 text-right">Numbers Profit</th>
                <th className="py-1.5 pr-3 text-right">Rollup Profit</th>
                <th className="py-1.5 pr-3 text-right">Inv.</th>
              </tr>
            </thead>
            <tbody className="text-white/80">
              {data.byBusiness.map((b) => {
                const o = data.official.find((x) => x.business === b.business);
                const cell = (n: number | null | undefined) =>
                  n == null ? <span className="text-white/30">—</span> : fmt(n);
                return (
                  <tr key={b.business} className="border-b border-white/5">
                    <td className="py-1.5 pr-3 font-medium">{b.business}</td>
                    <td className="py-1.5 pr-3 text-right text-white/60">{b.rows}</td>
                    <td className="py-1.5 pr-3 text-right text-emerald-200">
                      {cell(o?.gross)}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-white/60">{fmt(b.gross)}</td>
                    <td className="py-1.5 pr-3 text-right text-emerald-200">
                      {cell(o?.cost)}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-white/60">{fmt(b.cost)}</td>
                    <td
                      className={`py-1.5 pr-3 text-right font-semibold ${
                        (o?.profit ?? 0) >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {cell(o?.profit)}
                    </td>
                    <td
                      className={`py-1.5 pr-3 text-right ${
                        b.profit >= 0 ? "text-emerald-200/70" : "text-red-200/70"
                      }`}
                    >
                      {fmt(b.profit)}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-amber-200">
                      {cell(o?.inventoryRem)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-channel */}
      {data.byChannel.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white/80">By channel</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[0.6rem] uppercase text-white/40">
                <tr className="border-b border-white/10">
                  <th className="py-1.5 pr-3 text-left">Business</th>
                  <th className="py-1.5 pr-3 text-left">Channel</th>
                  <th className="py-1.5 pr-3 text-right">Rows</th>
                  <th className="py-1.5 pr-3 text-right">Gross</th>
                  <th className="py-1.5 pr-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="text-white/80">
                {data.byChannel.slice(0, 25).map((c, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-1.5 pr-3 text-white/70">{c.business}</td>
                    <td className="py-1.5 pr-3">{c.channel}</td>
                    <td className="py-1.5 pr-3 text-right text-white/60">{c.rows}</td>
                    <td className="py-1.5 pr-3 text-right">{fmt(c.gross)}</td>
                    <td
                      className={`py-1.5 pr-3 text-right ${
                        c.profit >= 0 ? "text-emerald-300" : "text-red-300"
                      }`}
                    >
                      {fmt(c.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Winners + losers */}
      <div className="grid gap-3 md:grid-cols-2">
        <ItemList title="Top winners" items={data.winners} positive />
        <ItemList title="Biggest losers" items={data.losers} positive={false} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-white/40">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color || "text-white"}`}>{value}</p>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-0.5 text-[0.65rem] transition ${
        active
          ? "bg-purple-500/30 text-purple-100"
          : "border border-white/10 text-white/50 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function ItemList({
  title,
  items,
  positive,
}: {
  title: string;
  items: ItemRow[];
  positive: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-white/80">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-white/40">No data.</p>
      ) : (
        <div className="mt-3 space-y-1">
          {items.map((it, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3 text-xs">
              <div className="min-w-0 flex-1">
                <p className="truncate text-white/80">{it.item || "(no name)"}</p>
                <p className="text-[0.6rem] text-white/40">
                  {it.business}
                  {it.channel ? ` · ${it.channel}` : ""}
                </p>
              </div>
              <span className={positive ? "text-emerald-300" : "text-red-300"}>
                {it.profit != null ? fmt(it.profit) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
