"use client";

import type { Listing, DossierResult, DossierJob } from "./types";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DossierHeader({
  listing,
  result,
  job,
}: {
  listing: Listing;
  result: DossierResult | null;
  job: DossierJob;
}) {
  const l = listing;
  const r = result;
  const lead = l.leads?.[0];

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{l.address}</h2>
          <p className="text-white/40 text-sm">
            {l.city}, {l.state} {l.zip} | MLS# {l.mlsId} | {l.status}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {r?.motivationScore != null && (
            <div className="text-center">
              <span
                className={`text-3xl font-bold tabular-nums ${
                  r.motivationScore >= 60
                    ? "text-red-400"
                    : r.motivationScore >= 40
                      ? "text-orange-400"
                      : "text-yellow-400"
                }`}
              >
                {r.motivationScore}
              </span>
              <div className="text-[0.6rem] text-white/30">MOTIVATION</div>
            </div>
          )}
          <div className="flex gap-2 mt-1">
            {lead && (
              <span className="text-xs text-white/40">
                Sell: <span className="text-white/70">{lead.score}</span>
              </span>
            )}
            {l.enrichment && (
              <span className="text-xs text-white/40">
                Buy: <span className="text-white/70">{l.enrichment.buyScore}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Property details row */}
      <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/60">
        {l.listPrice && (
          <span className="text-white/80 font-medium">
            ${l.listPrice.toLocaleString()}
          </span>
        )}
        {l.originalListPrice && l.listPrice && l.originalListPrice > l.listPrice && (
          <span className="text-red-400 line-through text-xs">
            ${l.originalListPrice.toLocaleString()}
          </span>
        )}
        {l.beds != null && <span>{l.beds} bd</span>}
        {l.baths != null && <span>{l.baths} ba</span>}
        {l.sqft != null && <span>{l.sqft.toLocaleString()} sqft</span>}
        {l.daysOnMarket != null && <span>{l.daysOnMarket} DOM</span>}
        {l.enrichment?.countyName && <span>{l.enrichment.countyName}</span>}
        {l.enrichment?.estimatedAnnualTax && (
          <span>${l.enrichment.estimatedAnnualTax.toLocaleString()}/yr tax</span>
        )}
      </div>

      {/* Motivation flags */}
      {r?.motivationFlags && r.motivationFlags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.motivationFlags.map((flag) => (
            <span
              key={flag}
              className="rounded-full bg-red-500/15 text-red-300 px-2.5 py-0.5 text-xs font-medium"
            >
              {flag.replace(/_/g, " ").toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* Completion status */}
      <div className="mt-3 flex items-center gap-3 text-xs text-white/30">
        <span
          className={`rounded-full px-2 py-0.5 font-medium capitalize ${
            job.status === "complete"
              ? "bg-green-500/20 text-green-300"
              : job.status === "partial"
                ? "bg-yellow-500/20 text-yellow-300"
                : "bg-red-500/20 text-red-300"
          }`}
        >
          {job.status}
        </span>
        <span>{job.stepsCompleted.length} plugins succeeded</span>
        {job.stepsFailed.length > 0 && (
          <span className="text-red-300">{job.stepsFailed.length} failed</span>
        )}
        {job.completedAt && <span>Completed {timeAgo(job.completedAt)}</span>}
      </div>
    </div>
  );
}
