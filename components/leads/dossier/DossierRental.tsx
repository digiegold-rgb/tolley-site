"use client";

import type { PluginOutput } from "./types";

export default function DossierRental({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const rental = pluginData["rental"];
  if (!rental?.success) return null;

  const estimatedRent = rental.data.estimatedRent as
    | { low: number; mid: number; high: number }
    | undefined;
  const rentalIndicators = (rental.data.rentalIndicators as string[]) || [];
  const evictions =
    (rental.data.evictions as
      | { caseNumber: string; date: string; status: string }[]
      | undefined) || [];

  return (
    <div className="space-y-3">
      {estimatedRent && (
        <div className="rounded-lg bg-white/[0.03] p-3">
          <h4 className="text-xs font-medium text-white/50 mb-2">
            Estimated Rent (KC Metro)
          </h4>
          <div className="flex items-center gap-4">
            <span className="text-white/40 text-sm">${estimatedRent.low}</span>
            <span className="text-lg font-bold text-green-400">
              ${estimatedRent.mid}/mo
            </span>
            <span className="text-white/40 text-sm">${estimatedRent.high}</span>
          </div>
          <p className="text-[0.6rem] text-white/20 mt-1">
            Rough estimate based on beds/baths/sqft. Check Rentometer/Zillow for
            accuracy.
          </p>
        </div>
      )}
      {rentalIndicators.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-yellow-300/70 mb-1">
            Rental Indicators
          </h4>
          {rentalIndicators.map((ind, i) => (
            <p key={i} className="text-xs text-yellow-200/60">
              {ind}
            </p>
          ))}
        </div>
      )}
      {evictions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-red-300/70 mb-1">Eviction Cases</h4>
          {evictions.map((ev, i) => (
            <div
              key={i}
              className="rounded-lg bg-red-500/5 border border-red-500/10 p-2 text-xs text-red-200/70"
            >
              Case# {ev.caseNumber} | Filed: {ev.date} | {ev.status}
            </div>
          ))}
        </div>
      )}
      <div>
        <h4 className="text-xs font-medium text-white/50 mb-2">Rental Research</h4>
        <div className="flex flex-wrap gap-2">
          {(rental.sources || []).map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10"
            >
              {s.label.replace(/ — .*/, "")}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
