"use client";

import { useState, useEffect, useCallback } from "react";
import AddressConfirm from "./AddressConfirm";
import EquityCard from "./EquityCard";

interface SnapData {
  id: string;
  status: string;
  photoUrl: string;
  exifGps: { lat: number; lng: number } | null;
  resolvedAddress: {
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    county: string | null;
  } | null;
  estimatedEquity: number | null;
  equityBreakdown: Record<string, unknown> | null;
  listing: {
    id: string;
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    propertyType: string | null;
    listPrice: number | null;
    photoUrls: string[];
    enrichment: {
      buyScore: number;
      taxBurdenRating: string | null;
      estimatedAnnualTax: number | null;
      countyName: string | null;
    } | null;
  } | null;
  dossier: {
    jobId: string;
    status: string;
    progress: number;
    currentStep: string | null;
    stepsCompleted: string[];
    stepsFailed: string[];
    result: {
      owners: unknown;
      entityType: string | null;
      entityName: string | null;
      courtCases: unknown;
      liens: unknown;
      bankruptcies: unknown;
      socialProfiles: unknown;
      motivationScore: number | null;
      motivationFlags: string[];
      financialData: unknown;
      streetViewUrl: string | null;
      satelliteUrl: string | null;
    } | null;
  } | null;
  createdAt: string;
}

interface Owner {
  name: string;
  role: string;
  phone?: string;
  email?: string;
  facebook?: string;
  linkedin?: string;
  age?: number;
  confidence: number;
}

interface SocialProfile {
  platform: string;
  url: string;
  name: string;
  confidence: number;
}

export default function SnapResults({ snapId }: { snapId: string }) {
  const [data, setData] = useState<SnapData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/snap/${snapId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Will retry
    } finally {
      setLoading(false);
    }
  }, [snapId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll while processing
  useEffect(() => {
    if (!data) return;
    const processing = ["pending", "geocoding", "geocoded", "researching"];
    if (!processing.includes(data.status)) return;

    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [data, fetchData]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-red-300 text-center py-8">Snap not found</p>;
  }

  const owners = (data.dossier?.result?.owners || []) as Owner[];
  const socials = (data.dossier?.result?.socialProfiles || []) as SocialProfile[];
  const courtCases = (data.dossier?.result?.courtCases || []) as Array<Record<string, unknown>>;
  const liens = (data.dossier?.result?.liens || []) as Array<Record<string, unknown>>;
  const motivationScore = data.dossier?.result?.motivationScore;
  const motivationFlags = data.dossier?.result?.motivationFlags || [];

  return (
    <div className="space-y-6">
      {/* Photo + Address Header */}
      <div className="flex gap-4 items-start">
        {data.photoUrl && (
          <img
            src={data.photoUrl}
            alt="Snapped property"
            className="w-24 h-24 rounded-xl object-cover border border-white/10 flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          {data.status === "needs_address" ? (
            <AddressConfirm
              snapId={snapId}
              detectedAddress={data.resolvedAddress}
              onConfirmed={fetchData}
            />
          ) : data.resolvedAddress ? (
            <div>
              <p className="text-xl font-bold text-white/90 truncate">
                {data.resolvedAddress.address}
              </p>
              <p className="text-sm text-white/50">
                {[data.resolvedAddress.city, data.resolvedAddress.state, data.resolvedAddress.zip]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {data.exifGps && (
                <p className="text-xs text-white/20 mt-1">
                  GPS: {data.exifGps.lat.toFixed(5)}, {data.exifGps.lng.toFixed(5)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-white/40">Detecting address...</p>
          )}
        </div>
      </div>

      {/* Progress Bar (while researching) */}
      {(data.status === "researching" || data.status === "geocoding" || data.status === "geocoded") && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-white/60">
              {data.status === "geocoding" ? "Detecting location..." : "Researching property..."}
            </p>
            {data.dossier && (
              <span className="text-xs text-white/40">{data.dossier.progress}%</span>
            )}
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-500"
              style={{ width: `${data.dossier?.progress || 10}%` }}
            />
          </div>
          {data.dossier?.currentStep && (
            <p className="text-xs text-white/30 mt-2">
              Current: {data.dossier.currentStep}
            </p>
          )}
        </div>
      )}

      {/* Quick Stats Bar (when complete) */}
      {data.status === "complete" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Motivation Score */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <p className="text-xs text-white/40 mb-1">Motivation</p>
            <p className={`text-2xl font-bold ${
              (motivationScore ?? 0) >= 50 ? "text-red-400" :
              (motivationScore ?? 0) >= 25 ? "text-yellow-400" : "text-green-400"
            }`}>
              {motivationScore ?? "—"}
            </p>
          </div>

          {/* Owner Count */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <p className="text-xs text-white/40 mb-1">Owners</p>
            <p className="text-2xl font-bold text-white/80">{owners.length || "—"}</p>
          </div>

          {/* Court Cases */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <p className="text-xs text-white/40 mb-1">Court Cases</p>
            <p className={`text-2xl font-bold ${courtCases.length > 0 ? "text-orange-400" : "text-white/80"}`}>
              {courtCases.length}
            </p>
          </div>

          {/* Social Profiles */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center">
            <p className="text-xs text-white/40 mb-1">Socials</p>
            <p className="text-2xl font-bold text-blue-400">{socials.length}</p>
          </div>
        </div>
      )}

      {/* Equity Card */}
      {data.status === "complete" && (
        <EquityCard
          equity={data.estimatedEquity}
          breakdown={data.equityBreakdown as Parameters<typeof EquityCard>[0]["breakdown"]}
        />
      )}

      {/* Motivation Flags */}
      {motivationFlags.length > 0 && (
        <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-4">
          <h3 className="text-sm font-medium text-red-300/80 mb-2">Motivation Flags</h3>
          <div className="flex flex-wrap gap-2">
            {motivationFlags.map((flag) => (
              <span
                key={flag}
                className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-medium text-red-300"
              >
                {flag.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Owners */}
      {owners.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <h3 className="text-sm font-medium text-white/40 mb-3">Property Owners</h3>
          <div className="space-y-3">
            {owners.map((owner, i) => (
              <div key={i} className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-white/90">{owner.name}</p>
                  <p className="text-xs text-white/40">
                    {owner.role}{owner.age ? ` · age ${owner.age}` : ""}
                  </p>
                  {owner.phone && (
                    <a href={`tel:${owner.phone}`} className="text-sm text-purple-300 hover:underline">
                      {owner.phone}
                    </a>
                  )}
                  {owner.email && (
                    <a href={`mailto:${owner.email}`} className="text-sm text-purple-300 hover:underline block">
                      {owner.email}
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  {owner.facebook && (
                    <a href={owner.facebook} target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300 text-xs">FB</a>
                  )}
                  {owner.linkedin && (
                    <a href={owner.linkedin} target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300 text-xs">LI</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Social Profiles */}
      {socials.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
          <h3 className="text-sm font-medium text-white/40 mb-3">Social Profiles</h3>
          <div className="space-y-2">
            {socials.map((profile, i) => (
              <a
                key={i}
                href={profile.url}
                target="_blank"
                rel="noopener"
                className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10 transition-colors"
              >
                <div>
                  <span className="text-sm text-white/80">{profile.name}</span>
                  <span className="text-xs text-white/30 ml-2">{profile.platform}</span>
                </div>
                <span className="text-xs text-white/20">
                  {Math.round(profile.confidence * 100)}% match
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Court Cases */}
      {courtCases.length > 0 && (
        <div className="rounded-xl bg-orange-500/5 border border-orange-500/10 p-4">
          <h3 className="text-sm font-medium text-orange-300/80 mb-3">Court Records</h3>
          <div className="space-y-2">
            {courtCases.map((c, i) => (
              <div key={i} className="rounded-lg bg-white/5 px-3 py-2">
                <div className="flex justify-between">
                  <span className="text-sm text-white/80 capitalize">
                    {String(c.type || "").replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-white/30">{String(c.filedDate || "")}</span>
                </div>
                <p className="text-xs text-white/40">{String(c.caseNumber || "")} — {String(c.court || "")}</p>
                <p className="text-xs text-white/30">{String(c.status || "")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liens */}
      {liens.length > 0 && (
        <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/10 p-4">
          <h3 className="text-sm font-medium text-yellow-300/80 mb-3">Liens</h3>
          <div className="space-y-2">
            {liens.map((l, i) => (
              <div key={i} className="flex justify-between rounded-lg bg-white/5 px-3 py-2">
                <div>
                  <span className="text-sm text-white/80 capitalize">
                    {String(l.type || "").replace(/_/g, " ")}
                  </span>
                  <span className="text-xs text-white/40 ml-2">{String(l.holder || "")}</span>
                </div>
                <span className="text-sm text-white/60">
                  {l.amount ? `$${Number(l.amount).toLocaleString()}` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Street View */}
      {data.dossier?.result?.streetViewUrl && (
        <div className="rounded-xl overflow-hidden border border-white/10">
          <img
            src={data.dossier.result.streetViewUrl}
            alt="Street view"
            className="w-full h-48 object-cover"
          />
        </div>
      )}

      {/* Full Dossier Link */}
      {data.dossier?.jobId && data.status === "complete" && (
        <a
          href={`/leads/dossier/${data.dossier.jobId}`}
          className="block rounded-xl bg-purple-600/20 border border-purple-500/20 p-4 text-center text-sm text-purple-300 hover:bg-purple-600/30 transition-colors"
        >
          View Full Dossier Report
        </a>
      )}

      {/* Error state */}
      {data.status === "failed" && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
          <p className="text-red-300">Research failed</p>
          <p className="text-xs text-red-300/50 mt-1">
            {(data as unknown as { errorMessage?: string }).errorMessage || "Unknown error"}
          </p>
        </div>
      )}
    </div>
  );
}
