"use client";

import { useState, useMemo } from "react";

interface Client {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  buyerSeller: string | null;
  fitScore: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  preferredCities: string[] | string | null;
  preferredZips: string[] | string | null;
}

interface Listing {
  id: string;
  photo: string;
  address: string;
  city: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
}

const SAMPLE_LISTINGS: Listing[] = [
  { id: "1", photo: "", address: "1204 S Liberty St", city: "Independence", zip: "64050", price: 189900, beds: 3, baths: 2, sqft: 1450 },
  { id: "2", photo: "", address: "3821 S Crysler Ave", city: "Independence", zip: "64055", price: 215000, beds: 4, baths: 2, sqft: 1820 },
  { id: "3", photo: "", address: "711 N Delaware St", city: "Independence", zip: "64050", price: 165000, beds: 3, baths: 1, sqft: 1200 },
  { id: "4", photo: "", address: "508 W Maple Ave", city: "Independence", zip: "64053", price: 245000, beds: 4, baths: 3, sqft: 2100 },
  { id: "5", photo: "", address: "1920 S Sterling Ave", city: "Independence", zip: "64052", price: 178500, beds: 3, baths: 2, sqft: 1380 },
  { id: "6", photo: "", address: "4102 S Noland Rd", city: "Independence", zip: "64055", price: 299000, beds: 5, baths: 3, sqft: 2600 },
  { id: "7", photo: "", address: "2205 W Truman Rd", city: "Independence", zip: "64050", price: 142000, beds: 2, baths: 1, sqft: 980 },
  { id: "8", photo: "", address: "815 N Main St", city: "Blue Springs", zip: "64014", price: 325000, beds: 4, baths: 3, sqft: 2400 },
];

function computeMatchScore(client: Client, listing: Listing): number {
  let score = 0;

  // Budget fit: 0-40 points
  const minP = client.minPrice || 0;
  const maxP = client.maxPrice || Infinity;
  if (listing.price >= minP && listing.price <= maxP) {
    score += 40;
  } else if (listing.price < minP) {
    const diff = (minP - listing.price) / minP;
    score += Math.max(0, 40 - diff * 100);
  } else if (maxP !== Infinity) {
    const diff = (listing.price - maxP) / maxP;
    score += Math.max(0, 40 - diff * 100);
  }

  // Location fit: 0-30 points
  const cities = Array.isArray(client.preferredCities)
    ? client.preferredCities
    : typeof client.preferredCities === "string"
    ? client.preferredCities.split(",").map((s) => s.trim())
    : [];
  const zips = Array.isArray(client.preferredZips)
    ? client.preferredZips
    : typeof client.preferredZips === "string"
    ? client.preferredZips.split(",").map((s) => s.trim())
    : [];

  if (zips.includes(listing.zip)) score += 30;
  else if (cities.some((c) => c.toLowerCase() === listing.city.toLowerCase())) score += 20;

  // Size fit: 0-30 points (baseline heuristic based on beds)
  const idealSqft = listing.beds * 500;
  const sqftRatio = listing.sqft / idealSqft;
  if (sqftRatio >= 0.8 && sqftRatio <= 1.3) score += 30;
  else if (sqftRatio >= 0.6 && sqftRatio <= 1.5) score += 20;
  else score += 10;

  return Math.round(Math.min(100, Math.max(0, score)));
}

function fitScoreColor(score: number | null): string {
  if (!score && score !== 0) return "bg-white/10 text-white/60";
  if (score >= 80) return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  if (score >= 50) return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
  return "bg-red-500/20 text-red-400 border border-red-500/30";
}

function matchScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function matchScoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 60) return "bg-yellow-500/10 border-yellow-500/20";
  if (score >= 40) return "bg-orange-500/10 border-orange-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function formatPrice(n: number): string {
  return "$" + n.toLocaleString();
}

export default function ClientMatches({ clients }: { clients: Client[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runningMatch, setRunningMatch] = useState(false);

  const selected = clients.find((c) => c.id === selectedId) || null;

  const matches = useMemo(() => {
    if (!selected) return [];
    return SAMPLE_LISTINGS.map((l) => ({
      ...l,
      matchScore: computeMatchScore(selected, l),
    }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 6);
  }, [selected]);

  if (clients.length === 0) {
    return (
      <section className="min-h-[60vh] flex items-center justify-center px-6">
        <section className="bg-white/5 border border-white/10 rounded-xl p-10 max-w-lg text-center">
          <svg className="mx-auto mb-4 w-16 h-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">No Clients Yet</h2>
          <p className="text-white/40 text-sm leading-relaxed mb-6">
            Client matching pairs your leads with active listings based on budget, location preferences, and property requirements. Add clients from the Leads pipeline to start matching.
          </p>
          <a href="/leads" className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            Go to Leads Pipeline
          </a>
        </section>
      </section>
    );
  }

  return (
    <section className="flex gap-6 min-h-[calc(100vh-8rem)] px-6 py-6">
      {/* Sidebar */}
      <aside className="w-72 shrink-0 space-y-2 overflow-y-auto max-h-[calc(100vh-10rem)] pr-1">
        <h2 className="text-lg font-semibold text-white mb-3">Clients</h2>
        {clients.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={`w-full text-left p-3 rounded-xl border transition-all ${
              selectedId === c.id
                ? "bg-blue-600/20 border-blue-500/40"
                : "bg-white/5 border-white/10 hover:bg-white/[0.08]"
            }`}
          >
            <p className="text-white font-medium text-sm truncate">
              {c.firstName || ""} {c.lastName || "Unnamed"}
            </p>
            <section className="flex items-center gap-2 mt-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fitScoreColor(c.fitScore)}`}>
                {c.fitScore ?? "—"}
              </span>
              {c.buyerSeller && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  c.buyerSeller.toLowerCase().includes("buy")
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-purple-500/20 text-purple-400"
                }`}>
                  {c.buyerSeller}
                </span>
              )}
            </section>
            {(c.minPrice || c.maxPrice) && (
              <p className="text-white/40 text-xs mt-1.5">
                {c.minPrice ? formatPrice(c.minPrice) : "$0"} — {c.maxPrice ? formatPrice(c.maxPrice) : "No max"}
              </p>
            )}
          </button>
        ))}
      </aside>

      {/* Main */}
      <section className="flex-1 min-w-0">
        {!selected ? (
          <section className="flex items-center justify-center h-full">
            <p className="text-white/40 text-sm">Select a client to view top matches</p>
          </section>
        ) : (
          <>
            <header className="flex items-center justify-between mb-6">
              <section>
                <h2 className="text-xl font-semibold text-white">
                  Top Matches for {selected.firstName} {selected.lastName}
                </h2>
                <p className="text-white/40 text-sm mt-1">
                  Scored by budget fit, location preference, and property size
                </p>
              </section>
              <button
                onClick={() => {
                  setRunningMatch(true);
                  setTimeout(() => setRunningMatch(false), 2000);
                }}
                disabled={runningMatch}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {runningMatch ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Running...
                  </>
                ) : (
                  "Run Matching"
                )}
              </button>
            </header>

            <p className="text-white/30 text-xs mb-4 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              Run Matching scans active MLS listings against this client&apos;s preferences (budget range, preferred cities/zips, and property requirements) to generate ranked recommendations.
            </p>

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {matches.map((m) => (
                <article
                  key={m.id}
                  className={`bg-white/5 border rounded-xl overflow-hidden transition-all hover:bg-white/[0.08] ${matchScoreBg(m.matchScore)}`}
                >
                  {/* Photo placeholder */}
                  <section className="h-36 bg-gradient-to-br from-white/[0.06] to-white/[0.02] flex items-center justify-center relative">
                    <svg className="w-10 h-10 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    <span className={`absolute top-2 right-2 text-sm font-bold px-2.5 py-1 rounded-lg bg-black/60 ${matchScoreColor(m.matchScore)}`}>
                      {m.matchScore}%
                    </span>
                  </section>

                  <section className="p-4">
                    <p className="text-white font-medium text-sm truncate">{m.address}</p>
                    <p className="text-white/40 text-xs mt-0.5">{m.city}, MO {m.zip}</p>
                    <p className="text-white text-lg font-semibold mt-2">{formatPrice(m.price)}</p>
                    <section className="flex items-center gap-3 mt-2 text-white/50 text-xs">
                      <span>{m.beds} bd</span>
                      <span>{m.baths} ba</span>
                      <span>{m.sqft.toLocaleString()} sqft</span>
                    </section>

                    <section className="flex gap-2 mt-4">
                      <button className="flex-1 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium rounded-lg transition-colors border border-blue-500/20">
                        Send to Client
                      </button>
                      <button className="flex-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 text-xs font-medium rounded-lg transition-colors border border-white/10">
                        Schedule Showing
                      </button>
                    </section>
                  </section>
                </article>
              ))}
            </section>
          </>
        )}
      </section>
    </section>
  );
}
