"use client";

import { useState, useMemo } from "react";

interface Enrichment {
  buyScore: number;
  buyScoreFactors: unknown;
  nearestSchoolName: string | null;
  nearestSchoolDist: number | null;
  schoolsWithin3mi: number | null;
  nearestHospitalName: string | null;
  nearestHospitalDist: number | null;
  nearestFireStationDist: number | null;
  nearestParkName: string | null;
  nearestParkDist: number | null;
  parksWithin2mi: number | null;
  nearestGroceryName: string | null;
  nearestGroceryDist: number | null;
  nearestAirportName: string | null;
  nearestAirportDist: number | null;
  restaurantsWithin1mi: number | null;
  nearestCourthouseName: string | null;
  nearestCourthouseDist: number | null;
  nearestLibraryName: string | null;
  nearestLibraryDist: number | null;
  librariesWithin3mi: number | null;
  countyName: string | null;
  countyState: string | null;
  estimatedAnnualTax: number | null;
  estimatedMonthlyTax: number | null;
  effectiveTaxRate: number | null;
  taxBurdenRating: string | null;
}

interface LeadListing {
  id: string;
  mlsId: string;
  address: string;
  city: string | null;
  zip: string | null;
  listPrice: number | null;
  originalListPrice: number | null;
  daysOnMarket: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  status: string;
  listingUrl: string | null;
  photoUrls: string[];
  listAgentName: string | null;
  listOfficeName: string | null;
  propertyType: string | null;
  enrichment: Enrichment | null;
}

interface Lead {
  id: string;
  score: number;
  status: string;
  source: string | null;
  notes: string | null;
  referredTo: string | null;
  referralStatus: string | null;
  referralFee: number | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  contactedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  listing: LeadListing | null;
}

interface Filters {
  status: string;
  minScore: number;
  maxScore: number;
  minBuyScore: number;
  maxBuyScore: number;
  city: string;
  zip: string;
  minPrice: string;
  maxPrice: string;
  minBeds: string;
  minBaths: string;
  minSqft: string;
  maxSqft: string;
  minDom: string;
  maxDom: string;
  taxBurden: string;
  source: string;
  county: string;
  propertyType: string;
  absenteeOnly: boolean;
  vacantOnly: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300",
  contacted: "bg-yellow-500/20 text-yellow-300",
  interested: "bg-green-500/20 text-green-300",
  referred: "bg-purple-500/20 text-purple-300",
  closed: "bg-emerald-500/20 text-emerald-300",
  dead: "bg-red-500/20 text-red-300",
};

const TAX_COLORS: Record<string, string> = {
  low: "text-green-400",
  moderate: "text-yellow-400",
  high: "text-orange-400",
  very_high: "text-red-400",
};

const STATUSES = ["new", "contacted", "interested", "referred", "closed", "dead"];

const DEFAULT_FILTERS: Filters = {
  status: "all",
  minScore: 0,
  maxScore: 100,
  minBuyScore: 0,
  maxBuyScore: 100,
  city: "all",
  zip: "all",
  minPrice: "",
  maxPrice: "",
  minBeds: "",
  minBaths: "",
  minSqft: "",
  maxSqft: "",
  minDom: "",
  maxDom: "",
  taxBurden: "all",
  source: "all",
  county: "all",
  propertyType: "all",
  absenteeOnly: false,
  vacantOnly: false,
};

export default function LeadsDashboard({ leads }: { leads: Lead[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [researching, setResearching] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ ownerName: string; ownerPhone: string; ownerEmail: string }>({ ownerName: "", ownerPhone: "", ownerEmail: "" });

  // Derive unique values for dropdowns
  const uniqueValues = useMemo(() => {
    const cities = new Set<string>();
    const zips = new Set<string>();
    const sources = new Set<string>();
    const counties = new Set<string>();
    const propertyTypes = new Set<string>();
    const taxBurdens = new Set<string>();

    for (const lead of leads) {
      if (lead.listing?.city) cities.add(lead.listing.city);
      if (lead.listing?.zip) zips.add(lead.listing.zip);
      if (lead.source) sources.add(lead.source);
      if (lead.listing?.enrichment?.countyName) counties.add(lead.listing.enrichment.countyName);
      if (lead.listing?.propertyType) propertyTypes.add(lead.listing.propertyType);
      if (lead.listing?.enrichment?.taxBurdenRating) taxBurdens.add(lead.listing.enrichment.taxBurdenRating);
    }

    return {
      cities: [...cities].sort(),
      zips: [...zips].sort(),
      sources: [...sources].sort(),
      counties: [...counties].sort(),
      propertyTypes: [...propertyTypes].sort(),
      taxBurdens: [...taxBurdens].sort(),
    };
  }, [leads]);

  // Apply all filters
  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const f = filters;
      const l = lead.listing;
      const e = l?.enrichment;

      if (f.status !== "all" && lead.status !== f.status) return false;
      if (lead.score < f.minScore || lead.score > f.maxScore) return false;
      if (e && (e.buyScore < f.minBuyScore || e.buyScore > f.maxBuyScore)) return false;
      if (f.city !== "all" && l?.city !== f.city) return false;
      if (f.zip !== "all" && l?.zip !== f.zip) return false;
      if (f.minPrice && l?.listPrice != null && l.listPrice < Number(f.minPrice)) return false;
      if (f.maxPrice && l?.listPrice != null && l.listPrice > Number(f.maxPrice)) return false;
      if (f.minBeds && l?.beds != null && l.beds < Number(f.minBeds)) return false;
      if (f.minBaths && l?.baths != null && l.baths < Number(f.minBaths)) return false;
      if (f.minSqft && l?.sqft != null && l.sqft < Number(f.minSqft)) return false;
      if (f.maxSqft && l?.sqft != null && l.sqft > Number(f.maxSqft)) return false;
      if (f.minDom && l?.daysOnMarket != null && l.daysOnMarket < Number(f.minDom)) return false;
      if (f.maxDom && l?.daysOnMarket != null && l.daysOnMarket > Number(f.maxDom)) return false;
      if (f.taxBurden !== "all" && e?.taxBurdenRating !== f.taxBurden) return false;
      if (f.source !== "all" && lead.source !== f.source) return false;
      if (f.county !== "all" && e?.countyName !== f.county) return false;
      if (f.propertyType !== "all" && l?.propertyType !== f.propertyType) return false;
      if (f.absenteeOnly && !lead.source?.startsWith("regrid_absentee")) return false;
      if (f.vacantOnly && !lead.source?.startsWith("regrid_vacant")) return false;

      return true;
    });
  }, [leads, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    const d = DEFAULT_FILTERS;
    if (filters.status !== d.status) count++;
    if (filters.minScore !== d.minScore || filters.maxScore !== d.maxScore) count++;
    if (filters.minBuyScore !== d.minBuyScore || filters.maxBuyScore !== d.maxBuyScore) count++;
    if (filters.city !== d.city) count++;
    if (filters.zip !== d.zip) count++;
    if (filters.minPrice || filters.maxPrice) count++;
    if (filters.minBeds) count++;
    if (filters.minBaths) count++;
    if (filters.minSqft || filters.maxSqft) count++;
    if (filters.minDom || filters.maxDom) count++;
    if (filters.taxBurden !== d.taxBurden) count++;
    if (filters.source !== d.source) count++;
    if (filters.county !== d.county) count++;
    if (filters.propertyType !== d.propertyType) count++;
    if (filters.absenteeOnly) count++;
    if (filters.vacantOnly) count++;
    return count;
  }, [filters]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function updateLead(id: string, data: Record<string, unknown>) {
    setUpdating(id);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...data }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const err = await res.json();
        alert(err.error || "Update failed");
      }
    } finally {
      setUpdating(null);
    }
  }

  async function requestDossier(listingId: string) {
    if (!listingId) return;
    setResearching(listingId);
    try {
      const res = await fetch("/api/leads/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingIds: [listingId] }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.jobs?.length > 0) {
          // Kick off processing in the background (don't await — it can take a while)
          fetch("/api/leads/dossier/process", { method: "POST" }).catch(() => {});
        }
        // Navigate regardless — show existing jobs if already queued
        window.location.href = "/leads/dossier";
      } else {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        console.error("Dossier queue failed:", res.status, err);
        alert(err.error || `Failed to queue research (${res.status})`);
      }
    } catch (e) {
      console.error("Dossier request error:", e);
      alert("Research request failed — check console");
    } finally {
      setResearching(null);
    }
  }

  function scoreColor(score: number) {
    if (score >= 60) return "text-red-400";
    if (score >= 40) return "text-orange-400";
    if (score >= 25) return "text-yellow-400";
    return "text-white/50";
  }

  function miFromKm(km: number) {
    return (km * 0.621).toFixed(1);
  }

  const selectCls =
    "rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/70 focus:outline-none focus:border-purple-500/50";
  const inputCls =
    "rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white/70 w-full focus:outline-none focus:border-purple-500/50";

  return (
    <div>
      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilter("status", "all")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            filters.status === "all"
              ? "bg-white/20 text-white"
              : "bg-white/5 text-white/50"
          }`}
        >
          All ({leads.length})
        </button>
        {STATUSES.map((s) => {
          const count = leads.filter((l) => l.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter("status", s)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                filters.status === s
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/50"
              }`}
            >
              {s} ({count})
            </button>
          );
        })}
      </div>

      {/* Filter Toggle + Active Count */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white/80 hover:bg-white/10 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-purple-500/30 text-purple-300 px-1.5 text-[0.6rem] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            onClick={resetFilters}
            className="text-xs text-red-400/70 hover:text-red-400"
          >
            Clear all
          </button>
        )}
        <span className="text-xs text-white/30 ml-auto">
          {filtered.length} of {leads.length} leads
        </span>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 mb-6 space-y-4">
          {/* Row 1: Scores */}
          <div>
            <div className="text-[0.65rem] font-medium text-white/40 uppercase tracking-wider mb-2">Scores</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Sell Score Min</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.minScore || ""}
                  onChange={(e) => setFilter("minScore", Number(e.target.value) || 0)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Sell Score Max</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.maxScore === 100 ? "" : filters.maxScore}
                  onChange={(e) => setFilter("maxScore", Number(e.target.value) || 100)}
                  placeholder="100"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Buy Score Min</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.minBuyScore || ""}
                  onChange={(e) => setFilter("minBuyScore", Number(e.target.value) || 0)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Buy Score Max</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={filters.maxBuyScore === 100 ? "" : filters.maxBuyScore}
                  onChange={(e) => setFilter("maxBuyScore", Number(e.target.value) || 100)}
                  placeholder="100"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Location */}
          <div>
            <div className="text-[0.65rem] font-medium text-white/40 uppercase tracking-wider mb-2">Location</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">City</label>
                <select
                  value={filters.city}
                  onChange={(e) => setFilter("city", e.target.value)}
                  className={selectCls + " w-full"}
                >
                  <option value="all">All cities</option>
                  {uniqueValues.cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Zip</label>
                <select
                  value={filters.zip}
                  onChange={(e) => setFilter("zip", e.target.value)}
                  className={selectCls + " w-full"}
                >
                  <option value="all">All zips</option>
                  {uniqueValues.zips.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">County</label>
                <select
                  value={filters.county}
                  onChange={(e) => setFilter("county", e.target.value)}
                  className={selectCls + " w-full"}
                >
                  <option value="all">All counties</option>
                  {uniqueValues.counties.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Source</label>
                <select
                  value={filters.source}
                  onChange={(e) => setFilter("source", e.target.value)}
                  className={selectCls + " w-full"}
                >
                  <option value="all">All sources</option>
                  {uniqueValues.sources.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Row 2b: Regrid Filters */}
          <div>
            <div className="text-[0.65rem] font-medium text-white/40 uppercase tracking-wider mb-2">Parcel Flags</div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.absenteeOnly}
                  onChange={(e) => setFilter("absenteeOnly", e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-orange-500 focus:ring-orange-500/30"
                />
                Absentee Owner
              </label>
              <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.vacantOnly}
                  onChange={(e) => setFilter("vacantOnly", e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-red-500 focus:ring-red-500/30"
                />
                USPS Vacant
              </label>
            </div>
          </div>

          {/* Row 3: Property Details */}
          <div>
            <div className="text-[0.65rem] font-medium text-white/40 uppercase tracking-wider mb-2">Property</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Type</label>
                <select
                  value={filters.propertyType}
                  onChange={(e) => setFilter("propertyType", e.target.value)}
                  className={selectCls + " w-full"}
                >
                  <option value="all">All types</option>
                  {uniqueValues.propertyTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Min Price</label>
                <input
                  type="number"
                  value={filters.minPrice}
                  onChange={(e) => setFilter("minPrice", e.target.value)}
                  placeholder="Any"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Max Price</label>
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => setFilter("maxPrice", e.target.value)}
                  placeholder="Any"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Min Beds</label>
                <input
                  type="number"
                  min={0}
                  value={filters.minBeds}
                  onChange={(e) => setFilter("minBeds", e.target.value)}
                  placeholder="Any"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Min Baths</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={filters.minBaths}
                  onChange={(e) => setFilter("minBaths", e.target.value)}
                  placeholder="Any"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Tax Burden</label>
                <select
                  value={filters.taxBurden}
                  onChange={(e) => setFilter("taxBurden", e.target.value)}
                  className={selectCls + " w-full"}
                >
                  <option value="all">Any</option>
                  {uniqueValues.taxBurdens.map((t) => (
                    <option key={t} value={t}>{t.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Row 4: Size & DOM */}
          <div>
            <div className="text-[0.65rem] font-medium text-white/40 uppercase tracking-wider mb-2">Size & Days on Market</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Min Sqft</label>
                <input
                  type="number"
                  value={filters.minSqft}
                  onChange={(e) => setFilter("minSqft", e.target.value)}
                  placeholder="Any"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Max Sqft</label>
                <input
                  type="number"
                  value={filters.maxSqft}
                  onChange={(e) => setFilter("maxSqft", e.target.value)}
                  placeholder="Any"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Min DOM</label>
                <input
                  type="number"
                  min={0}
                  value={filters.minDom}
                  onChange={(e) => setFilter("minDom", e.target.value)}
                  placeholder="Any"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[0.6rem] text-white/30 block mb-1">Max DOM</label>
                <input
                  type="number"
                  min={0}
                  value={filters.maxDom}
                  onChange={(e) => setFilter("maxDom", e.target.value)}
                  placeholder="Any"
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead cards */}
      <div className="space-y-3">
        {filtered.map((lead) => {
          const e = lead.listing?.enrichment;
          const isExpanded = expanded.has(lead.id);

          return (
            <div
              key={lead.id}
              className="rounded-xl bg-white/5 border border-white/10 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Score + Address */}
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center min-w-[48px]">
                      <span
                        className={`text-2xl font-bold tabular-nums leading-none ${scoreColor(
                          lead.score
                        )}`}
                      >
                        {lead.score}
                      </span>
                      <span className="text-[0.55rem] text-white/30 mt-0.5">SELL</span>
                      {e && (
                        <>
                          <span
                            className={`text-lg font-bold tabular-nums leading-none mt-1 ${
                              e.buyScore >= 60
                                ? "text-green-400"
                                : e.buyScore >= 40
                                  ? "text-blue-400"
                                  : "text-white/40"
                            }`}
                          >
                            {e.buyScore}
                          </span>
                          <span className="text-[0.55rem] text-white/30">BUY</span>
                        </>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {lead.listing?.address || "Unknown address"}
                      </h3>
                      <p className="text-xs text-white/40">
                        MLS# {lead.listing?.mlsId} |{" "}
                        {lead.listing?.city || ""}{" "}
                        {lead.listing?.zip || ""}
                        {lead.listing?.propertyType && (
                          <span className="text-white/30"> | {lead.listing.propertyType}</span>
                        )}
                        {e?.countyName && (
                          <span className="text-white/30">
                            {" "}| {e.countyName}, {e.countyState}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/60">
                    {lead.listing?.listPrice && (
                      <span className="font-medium text-white/80">
                        ${lead.listing.listPrice.toLocaleString()}
                      </span>
                    )}
                    {lead.listing?.originalListPrice &&
                      lead.listing.listPrice &&
                      lead.listing.originalListPrice >
                        lead.listing.listPrice && (
                        <span className="text-red-400 line-through text-xs">
                          $
                          {lead.listing.originalListPrice.toLocaleString()}
                        </span>
                      )}
                    {lead.listing?.beds != null && (
                      <span>{lead.listing.beds} bd</span>
                    )}
                    {lead.listing?.baths != null && (
                      <span>{lead.listing.baths} ba</span>
                    )}
                    {lead.listing?.sqft != null && (
                      <span>{lead.listing.sqft.toLocaleString()} sqft</span>
                    )}
                    {lead.listing?.daysOnMarket != null && (
                      <span>{lead.listing.daysOnMarket} DOM</span>
                    )}
                    {e?.estimatedMonthlyTax != null && (
                      <span className={TAX_COLORS[e.taxBurdenRating || ""] || "text-white/50"}>
                        ~${e.estimatedMonthlyTax.toLocaleString()}/mo tax
                      </span>
                    )}
                  </div>

                  {/* Notes / Signals */}
                  {lead.notes && (
                    <p className="mt-1 text-xs text-white/40">
                      Signals: {lead.notes}
                    </p>
                  )}

                  {/* Referral info */}
                  {lead.referredTo && (
                    <p className="mt-1 text-xs text-purple-300">
                      Referred to: {lead.referredTo}
                      {lead.referralFee
                        ? ` | Fee: $${lead.referralFee.toLocaleString()}`
                        : ""}
                      {lead.referralStatus
                        ? ` | Status: ${lead.referralStatus}`
                        : ""}
                    </p>
                  )}

                  {/* Expand/Collapse for enrichment details */}
                  {e && (
                    <button
                      onClick={() => toggleExpand(lead.id)}
                      className="mt-2 text-[0.65rem] text-blue-400 hover:text-blue-300"
                    >
                      {isExpanded ? "Hide details" : "Show details"}
                    </button>
                  )}

                  {/* Enrichment panel (expandable) */}
                  {e && isExpanded && (
                    <div className="mt-2 rounded-lg bg-white/[0.03] p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white/50">
                          Buy Score:
                        </span>
                        <span
                          className={`text-sm font-bold tabular-nums ${
                            e.buyScore >= 60
                              ? "text-green-400"
                              : e.buyScore >= 40
                                ? "text-blue-400"
                                : "text-white/50"
                          }`}
                        >
                          {e.buyScore}/100
                        </span>
                      </div>

                      {e.countyName && (
                        <div className="rounded bg-white/[0.03] p-2">
                          <div className="text-[0.65rem] font-medium text-white/50 mb-1">
                            County & Tax
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-white/40">
                            <span>{e.countyName}, {e.countyState}</span>
                            {e.estimatedAnnualTax != null && (
                              <span>
                                Est. Tax: <span className={TAX_COLORS[e.taxBurdenRating || ""] || ""}>
                                  ${e.estimatedAnnualTax.toLocaleString()}/yr
                                </span>
                                {" "}(${e.estimatedMonthlyTax?.toLocaleString()}/mo)
                              </span>
                            )}
                            {e.effectiveTaxRate != null && (
                              <span>
                                Effective Rate: <span className={TAX_COLORS[e.taxBurdenRating || ""] || ""}>
                                  {e.effectiveTaxRate}%
                                </span>
                                {" "}({e.taxBurdenRating?.replace("_", " ")})
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[0.65rem] text-white/40">
                        {e.nearestSchoolName && (
                          <span>
                            School: {e.nearestSchoolName} (
                            {miFromKm(e.nearestSchoolDist!)} mi)
                            {e.schoolsWithin3mi
                              ? ` +${e.schoolsWithin3mi} nearby`
                              : ""}
                          </span>
                        )}
                        {e.nearestHospitalName && (
                          <span>
                            Hospital: {e.nearestHospitalName} (
                            {miFromKm(e.nearestHospitalDist!)} mi)
                          </span>
                        )}
                        {e.nearestParkName && (
                          <span>
                            Park: {e.nearestParkName} (
                            {miFromKm(e.nearestParkDist!)} mi)
                          </span>
                        )}
                        {e.nearestGroceryName && (
                          <span>
                            Grocery: {e.nearestGroceryName} (
                            {miFromKm(e.nearestGroceryDist!)} mi)
                          </span>
                        )}
                        {e.nearestFireStationDist != null && (
                          <span>
                            Fire: {miFromKm(e.nearestFireStationDist)} mi
                          </span>
                        )}
                        {e.nearestAirportName && (
                          <span>
                            Airport: {e.nearestAirportName} (
                            {miFromKm(e.nearestAirportDist!)} mi)
                          </span>
                        )}
                        {e.restaurantsWithin1mi != null &&
                          e.restaurantsWithin1mi > 0 && (
                          <span>
                            Dining: {e.restaurantsWithin1mi} within 1mi
                          </span>
                        )}
                        {e.nearestLibraryName && (
                          <span>
                            Library: {e.nearestLibraryName} (
                            {miFromKm(e.nearestLibraryDist!)} mi)
                            {e.librariesWithin3mi
                              ? ` +${e.librariesWithin3mi} nearby`
                              : ""}
                          </span>
                        )}
                        {e.nearestCourthouseName && (
                          <span>
                            Courthouse: {e.nearestCourthouseName} (
                            {miFromKm(e.nearestCourthouseDist!)} mi)
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Agent info */}
                  {lead.listing?.listAgentName && (
                    <p className="mt-1 text-xs text-white/30">
                      List agent: {lead.listing.listAgentName}
                      {lead.listing.listOfficeName && ` @ ${lead.listing.listOfficeName}`}
                    </p>
                  )}
                </div>

                {/* Right side: status + actions */}
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      STATUS_COLORS[lead.status] || "bg-white/10 text-white/50"
                    }`}
                  >
                    {lead.status}
                  </span>

                  {lead.listing?.listingUrl && (
                    <a
                      href={lead.listing.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline"
                    >
                      View listing
                    </a>
                  )}

                  {/* Deep Research button */}
                  {lead.listing && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        requestDossier(lead.listing!.id);
                      }}
                      disabled={researching === lead.listing.id}
                      className="text-xs rounded bg-purple-600/30 text-purple-300 px-2 py-1 hover:bg-purple-600/50 disabled:opacity-50"
                    >
                      {researching === lead.listing.id ? "Queuing..." : "Research"}
                    </button>
                  )}

                  {/* Owner Info inline edit */}
                  {editingLead === lead.id ? (
                    <div className="flex flex-col gap-1.5 w-44">
                      <input
                        type="text"
                        placeholder="Owner name"
                        value={editValues.ownerName}
                        onChange={(e) => setEditValues((v) => ({ ...v, ownerName: e.target.value }))}
                        className={inputCls + " !w-full"}
                      />
                      <input
                        type="tel"
                        placeholder="Phone"
                        value={editValues.ownerPhone}
                        onChange={(e) => setEditValues((v) => ({ ...v, ownerPhone: e.target.value }))}
                        className={inputCls + " !w-full"}
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={editValues.ownerEmail}
                        onChange={(e) => setEditValues((v) => ({ ...v, ownerEmail: e.target.value }))}
                        className={inputCls + " !w-full"}
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            updateLead(lead.id, {
                              ownerName: editValues.ownerName || null,
                              ownerPhone: editValues.ownerPhone || null,
                              ownerEmail: editValues.ownerEmail || null,
                            });
                            setEditingLead(null);
                          }}
                          disabled={updating === lead.id}
                          className="flex-1 text-xs rounded bg-green-600/30 text-green-300 px-2 py-1 hover:bg-green-600/50 disabled:opacity-50"
                        >
                          {updating === lead.id ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingLead(null)}
                          className="text-xs rounded bg-white/10 text-white/50 px-2 py-1 hover:bg-white/20"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingLead(lead.id);
                        setEditValues({
                          ownerName: lead.ownerName || "",
                          ownerPhone: lead.ownerPhone || "",
                          ownerEmail: lead.ownerEmail || "",
                        });
                      }}
                      className="text-xs rounded bg-white/10 text-white/50 px-2 py-1 hover:bg-white/20 hover:text-white/70"
                    >
                      {lead.ownerName || lead.ownerPhone || lead.ownerEmail ? "Edit Owner" : "Add Owner"}
                    </button>
                  )}

                  {/* Owner display (when not editing) */}
                  {editingLead !== lead.id && (lead.ownerName || lead.ownerPhone || lead.ownerEmail) && (
                    <div className="text-[0.65rem] text-white/40 text-right max-w-[11rem] truncate">
                      {lead.ownerName && <div>{lead.ownerName}</div>}
                      {lead.ownerPhone && <div>{lead.ownerPhone}</div>}
                      {lead.ownerEmail && <div className="truncate">{lead.ownerEmail}</div>}
                    </div>
                  )}

                  {/* Status change dropdown */}
                  <select
                    className="rounded bg-white/10 px-2 py-1 text-xs text-white/70 border border-white/10"
                    value=""
                    disabled={updating === lead.id}
                    onChange={(e) => {
                      if (e.target.value) {
                        updateLead(lead.id, { status: e.target.value });
                      }
                    }}
                  >
                    <option value="">Move to...</option>
                    {STATUSES.filter((s) => s !== lead.status).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-white/30">
            No leads matching filters
          </div>
        )}
      </div>
    </div>
  );
}
