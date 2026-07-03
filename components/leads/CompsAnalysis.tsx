"use client";

import { useState, useMemo } from "react";

type Listing = {
  id: string;
  address: string;
  city: string | null;
  zip: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  daysOnMarket: number | null;
  status: string;
  propertyType: string | null;
  photoUrls: string[];
  enrichment: {
    buyScore: number;
    estimatedAnnualTax: number | null;
    taxBurdenRating: string | null;
    countyName: string | null;
  } | null;
};

const STATUS_COLORS: Record<string, string> = {
  Active: "text-blue-300",
  Closed: "text-emerald-300",
  Expired: "text-red-300",
  Withdrawn: "text-yellow-300",
};

const PROPERTY_TYPES = [
  "All",
  "Single Family",
  "Condo",
  "Townhouse",
  "Multi-Family",
  "Land",
];

function fmt(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return "-";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function CompsAnalysis({ listings }: { listings: Listing[] }) {
  const [zip, setZip] = useState("");
  const [propertyType, setPropertyType] = useState("All");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [beds, setBeds] = useState("Any");
  const [minSqft, setMinSqft] = useState("");
  const [maxSqft, setMaxSqft] = useState("");

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (zip && l.zip !== zip) return false;
      if (propertyType !== "All" && l.propertyType !== propertyType) return false;
      if (minPrice && (l.listPrice ?? 0) < Number(minPrice)) return false;
      if (maxPrice && (l.listPrice ?? 0) > Number(maxPrice)) return false;
      if (beds !== "Any" && l.beds !== Number(beds)) return false;
      if (minSqft && (l.sqft ?? 0) < Number(minSqft)) return false;
      if (maxSqft && (l.sqft ?? 0) > Number(maxSqft)) return false;
      return true;
    });
  }, [listings, zip, propertyType, minPrice, maxPrice, beds, minSqft, maxSqft]);

  const stats = useMemo(() => {
    const prices = filtered
      .map((l) => l.listPrice)
      .filter((p): p is number => p != null);
    const sqfts = filtered
      .map((l) => l.sqft)
      .filter((s): s is number => s != null && s > 0);
    const doms = filtered
      .map((l) => l.daysOnMarket)
      .filter((d): d is number => d != null);

    const ppsf = filtered
      .filter((l) => l.listPrice && l.sqft && l.sqft > 0)
      .map((l) => l.listPrice! / l.sqft!);

    const avgPrice =
      prices.length > 0
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : 0;
    const avgDom =
      doms.length > 0 ? doms.reduce((a, b) => a + b, 0) / doms.length : 0;

    return {
      count: filtered.length,
      avgPrice,
      medianPpsf: median(ppsf),
      avgDom,
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Comp Analysis</h1>

      {/* Zip filter */}
      <div>
        <input
          type="text"
          placeholder="Filter by ZIP code"
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-white/20 w-48"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-white/40 mb-1">Property Type</label>
          <select
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#06050a]">
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Min Price</label>
          <input
            type="number"
            placeholder="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm w-28 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Max Price</label>
          <input
            type="number"
            placeholder="Any"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm w-28 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Beds</label>
          <select
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/20"
          >
            <option value="Any" className="bg-[#06050a]">Any</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n} className="bg-[#06050a]">
                {n}+
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Min Sqft</label>
          <input
            type="number"
            placeholder="0"
            value={minSqft}
            onChange={(e) => setMinSqft(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm w-28 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Max Sqft</label>
          <input
            type="number"
            placeholder="Any"
            value={maxSqft}
            onChange={(e) => setMaxSqft(e.target.value)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-sm w-28 focus:outline-none focus:ring-1 focus:ring-white/20"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Listings", value: fmt(stats.count) },
          { label: "Avg Price", value: fmtPrice(stats.avgPrice) },
          { label: "Median $/Sqft", value: fmtPrice(stats.medianPpsf) },
          { label: "Avg DOM", value: fmt(Math.round(stats.avgDom)) },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-white/10 bg-white/5 p-4"
          >
            <p className="text-xs text-white/40">{card.label}</p>
            <p className="text-xl font-bold text-white mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {["Address", "City", "Price", "$/Sqft", "Beds/Ba", "Sqft", "DOM", "Status", "Tax"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-white/40 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => {
              const ppsf =
                l.listPrice && l.sqft && l.sqft > 0
                  ? l.listPrice / l.sqft
                  : null;
              return (
                <tr
                  key={l.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                    {l.address}
                  </td>
                  <td className="px-4 py-3 text-white/70">{l.city ?? "-"}</td>
                  <td className="px-4 py-3 text-white">{fmtPrice(l.listPrice)}</td>
                  <td className="px-4 py-3 text-white/70">{fmtPrice(ppsf)}</td>
                  <td className="px-4 py-3 text-white/70">
                    {l.beds ?? "-"}/{l.baths ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-white/70">{fmt(l.sqft)}</td>
                  <td className="px-4 py-3 text-white/70">{l.daysOnMarket ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={STATUS_COLORS[l.status] ?? "text-white/40"}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {l.enrichment?.estimatedAnnualTax
                      ? fmtPrice(l.enrichment.estimatedAnnualTax) + "/yr"
                      : "-"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-white/40">
                  No listings match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
