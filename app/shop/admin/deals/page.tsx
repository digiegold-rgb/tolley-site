"use client";

import { useState, useEffect, useCallback } from "react";

interface Deal {
  id: string;
  retailerLabel: string;
  title: string;
  imageUrl: string | null;
  productUrl: string | null;
  buyPrice: number;
  originalPrice: number | null;
  savings: number | null;
  discountPct: number | null;
  promoType: string | null;
  storeName: string | null;
  inStockQty: number | null;
  resaleNetMedian: number | null;
  resaleSamples: number;
  estProfit: number | null;
  marginPct: number | null;
  status: string;
  productId: string | null;
  lastSeenAt: string;
}

type Counts = Record<string, number>;

interface PennyItem {
  sku: string;
  name: string;
  brand: string | null;
  upc: string | null;
  homeDepotUrl: string | null;
  imageUrl: string | null;
  retailPrice: number | null;
  tier: string | null;
  totalStores: number;
  nearbyCount: number;
  nearbyCities: string[];
  paCount: number;
}

const STATUSES = ["new", "sourced", "dismissed", "all"] as const;

export default function DealScannerPage() {
  const [mode, setMode] = useState<"markdowns" | "penny">("markdowns");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [status, setStatus] = useState<string>("new");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [penny, setPenny] = useState<PennyItem[]>([]);
  const [pennyTotal, setPennyTotal] = useState(0);
  const [pennyNearOnly, setPennyNearOnly] = useState(false);
  const [pennyLoading, setPennyLoading] = useState(false);

  const loadPenny = useCallback(() => {
    setPennyLoading(true);
    fetch(`/api/shop/deals/penny?near=${pennyNearOnly ? "1" : "0"}`)
      .then((r) => r.json())
      .then((d) => {
        setPenny(d.items || []);
        setPennyTotal(d.total || 0);
        if (d.error) setToast(`Penny source issue: ${d.error}`);
      })
      .catch((e) => setToast(`Penny load failed: ${e}`))
      .finally(() => setPennyLoading(false));
  }, [pennyNearOnly]);

  useEffect(() => {
    if (mode === "penny") loadPenny();
  }, [mode, loadPenny]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/shop/deals?status=${status}&limit=200`)
      .then((r) => r.json())
      .then((d) => {
        setDeals(d.deals || []);
        setCounts(d.counts || {});
      })
      .catch((e) => setToast(`Load failed: ${e}`))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  };

  async function runScan() {
    setScanning(true);
    flash("Scanning Home Depot… this takes ~30–60s");
    try {
      const r = await fetch("/api/cron/retail-deal-scanner", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "scan failed");
      flash(
        `Scan done — ${d.finds} new finds, ${d.enriched} checked, ${d.alerts} alerts`
      );
      load();
    } catch (e) {
      flash(`Scan error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setScanning(false);
    }
  }

  async function source(deal: Deal, thenDraft: boolean) {
    setBusyId(deal.id);
    try {
      const r = await fetch(`/api/shop/deals/${deal.id}/source`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "source failed");
      flash(`Created draft product${d.alreadySourced ? " (existing)" : ""}.`);
      if (thenDraft && d.productId) {
        flash("Pushing FB Marketplace draft…");
        const fr = await fetch(`/api/shop/products/${d.productId}/fb-draft`, {
          method: "POST",
        });
        const fd = await fr.json();
        if (!fr.ok) throw new Error(fd.detail || fd.error || "fb-draft failed");
        flash(`FB draft created${fd.draftUrl ? "" : " (no URL returned)"}.`);
      }
      load();
    } catch (e) {
      flash(`Error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(deal: Deal, undo = false) {
    setBusyId(deal.id);
    try {
      await fetch(`/api/shop/deals/${deal.id}/dismiss`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo }),
      });
      load();
    } catch (e) {
      flash(`Error: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">🛒 Deal Scanner</h1>
          <p className="mt-1 text-sm text-white/50">
            {mode === "markdowns"
              ? "Home Depot markdowns & clearance, scored for resale. Source a find to a draft product, then push it to Ruthann's Treasure Haul."
              : "Community-reported $0.01 penny leads. Verify in-store — penny prices never show online. Source: PennyCentral."}
          </p>
        </div>
        {mode === "markdowns" && (
          <button
            onClick={runScan}
            disabled={scanning}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Run scan now"}
          </button>
        )}
      </div>

      {/* Mode switch */}
      <div className="mt-4 inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
        {(["markdowns", "penny"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
              mode === m ? "bg-white text-black" : "text-white/60 hover:text-white"
            }`}
          >
            {m === "markdowns" ? "Markdowns" : "Penny List ($0.01)"}
          </button>
        ))}
      </div>

      {toast && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {toast}
        </div>
      )}

      {mode === "penny" && (
        <PennyList
          items={penny}
          total={pennyTotal}
          loading={pennyLoading}
          nearOnly={pennyNearOnly}
          onToggleNear={() => setPennyNearOnly((v) => !v)}
          onRefresh={loadPenny}
        />
      )}

      {mode === "markdowns" && (
      <>
      <div className="mt-5 flex gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
              status === s
                ? "bg-white text-black"
                : "bg-white/[0.06] text-white/60 hover:bg-white/10"
            }`}
          >
            {s}
            {counts[s] != null && s !== "all" ? ` (${counts[s]})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase text-white/40">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Discount</th>
              <th className="px-3 py-2">eBay net</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-white/40">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && deals.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-white/40">
                  No deals here yet. Hit “Run scan now”.
                </td>
              </tr>
            )}
            {deals.map((d) => (
              <tr key={d.id} className="border-t border-white/5 align-top">
                <td className="px-3 py-3">
                  <div className="flex gap-3">
                    {d.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.imageUrl}
                        alt=""
                        className="h-12 w-12 flex-none rounded object-contain bg-white/5"
                      />
                    ) : (
                      <div className="h-12 w-12 flex-none rounded bg-white/5" />
                    )}
                    <div className="min-w-0">
                      <a
                        href={d.productUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 font-medium text-white/90 hover:text-emerald-300"
                      >
                        {d.title}
                      </a>
                      <div className="mt-0.5 text-xs text-white/40">
                        {d.retailerLabel}
                        {d.storeName ? ` · ${d.storeName}` : ""}
                        {d.inStockQty ? ` · ${d.inStockQty} in stock` : ""}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="font-semibold">${d.buyPrice.toFixed(0)}</span>
                  {d.originalPrice && (
                    <span className="ml-1 text-xs text-white/40 line-through">
                      ${d.originalPrice.toFixed(0)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {d.discountPct != null ? (
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                        d.discountPct >= 40
                          ? "bg-rose-500/20 text-rose-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {d.discountPct}% off
                    </span>
                  ) : (
                    <span className="text-white/30">—</span>
                  )}
                  {d.promoType && (
                    <div className="mt-0.5 text-[10px] text-white/30">{d.promoType}</div>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-xs">
                  {d.resaleNetMedian != null ? (
                    <>
                      <div>${d.resaleNetMedian.toFixed(0)}</div>
                      <div className="text-white/30">
                        {d.marginPct != null ? `${d.marginPct}% margin` : ""} ·{" "}
                        {d.resaleSamples} comps
                      </div>
                    </>
                  ) : (
                    <span className="text-white/30">not comped</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {d.status !== "dismissed" && (
                      <>
                        <button
                          onClick={() => source(d, false)}
                          disabled={busyId === d.id}
                          className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20 disabled:opacity-40"
                        >
                          {d.productId ? "Re-source" : "Source"}
                        </button>
                        <button
                          onClick={() => source(d, true)}
                          disabled={busyId === d.id}
                          className="rounded bg-emerald-600/80 px-2 py-1 text-xs font-medium hover:bg-emerald-500 disabled:opacity-40"
                        >
                          Source + FB draft
                        </button>
                      </>
                    )}
                    {d.status === "dismissed" ? (
                      <button
                        onClick={() => dismiss(d, true)}
                        disabled={busyId === d.id}
                        className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20 disabled:opacity-40"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        onClick={() => dismiss(d)}
                        disabled={busyId === d.id}
                        className="rounded px-2 py-1 text-xs text-white/40 hover:text-white/70 disabled:opacity-40"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}

function PennyList({
  items,
  total,
  loading,
  nearOnly,
  onToggleNear,
  onRefresh,
}: {
  items: PennyItem[];
  total: number;
  loading: boolean;
  nearOnly: boolean;
  onToggleNear: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-white/50">
          {loading ? "Loading…" : `${items.length}${nearOnly ? "" : ` of ${total}`} penny leads`}
        </span>
        <label className="flex items-center gap-1.5 text-white/60">
          <input type="checkbox" checked={nearOnly} onChange={onToggleNear} />
          KC area only (MO/KS)
        </label>
        <button
          onClick={onRefresh}
          className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
        >
          Refresh
        </button>
      </div>
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2 text-xs text-amber-200/80">
        These are crowd-sourced <b>leads</b>, not guarantees. A penny price only
        rings up at the register and is store-specific — note the SKU/UPC and scan
        it at self-checkout. Scan the item&apos;s UPC, not the yellow clearance tag.
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-xs uppercase text-white/40">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Retail</th>
              <th className="px-3 py-2">SKU / UPC</th>
              <th className="px-3 py-2">Near you</th>
              <th className="px-3 py-2">Reports</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-white/40">
                  {nearOnly ? "No penny leads reported near KC right now." : "No penny leads right now."}
                </td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.sku} className="border-t border-white/5 align-top">
                <td className="px-3 py-3">
                  <div className="flex gap-3">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-12 w-12 flex-none rounded object-contain bg-white/5" />
                    ) : (
                      <div className="h-12 w-12 flex-none rounded bg-white/5" />
                    )}
                    <div className="min-w-0">
                      <a
                        href={p.homeDepotUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 font-medium text-white/90 hover:text-amber-300"
                      >
                        {p.name}
                      </a>
                      <div className="mt-0.5 text-xs text-white/40">
                        {p.brand || ""}
                        {p.tier ? ` · ${p.tier}` : ""}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {p.retailPrice != null ? (
                    <>
                      <span className="text-white/40 line-through">${p.retailPrice.toFixed(0)}</span>
                      <span className="ml-1 font-bold text-amber-300">→ $0.01</span>
                    </>
                  ) : (
                    <span className="font-bold text-amber-300">$0.01</span>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-xs text-white/60">
                  <div>SKU {p.sku}</div>
                  {p.upc && <div className="text-white/30">UPC {p.upc}</div>}
                </td>
                <td className="px-3 py-3 text-xs">
                  {p.nearbyCount > 0 ? (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-semibold text-emerald-300">
                      {p.nearbyCount} MO/KS
                    </span>
                  ) : p.paCount > 0 ? (
                    <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-sky-300">{p.paCount} PA</span>
                  ) : (
                    <span className="text-white/30">—</span>
                  )}
                  {p.nearbyCities.length > 0 && (
                    <div className="mt-0.5 text-white/40">{p.nearbyCities.slice(0, 3).join(", ")}</div>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-xs text-white/40">
                  {p.totalStores} stores
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
