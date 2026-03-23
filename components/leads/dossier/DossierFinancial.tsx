"use client";

import type { PluginOutput } from "./types";

export default function DossierFinancial({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const fa = pluginData["financial-analysis"];
  if (!fa?.success || fa.data?.estimatedEquity == null) return null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg bg-white/[0.03] p-3 text-center">
          <span className="text-lg font-bold text-green-400">
            ${((fa.data.estimatedEquity as number) || 0).toLocaleString()}
          </span>
          <div className="text-[0.6rem] text-white/30">EST. EQUITY</div>
        </div>
        {(fa.data.equityPercent as number) != null && (
          <div className="rounded-lg bg-white/[0.03] p-3 text-center">
            <span className="text-lg font-bold text-white/80">
              {fa.data.equityPercent as number}%
            </span>
            <div className="text-[0.6rem] text-white/30">EQUITY %</div>
          </div>
        )}
        {(fa.data.marketValue as number) != null && (
          <div className="rounded-lg bg-white/[0.03] p-3 text-center">
            <span className="text-lg font-bold text-white/80">
              ${((fa.data.marketValue as number) || 0).toLocaleString()}
            </span>
            <div className="text-[0.6rem] text-white/30">
              MARKET VALUE
              {String(fa.data.marketValueSource || "").includes("NARRPR") && (
                <span className="ml-1 text-orange-300">NARRPR</span>
              )}
            </div>
          </div>
        )}
      </div>
      {(fa.data.mortgageEstimate as number) != null && (
        <p className="text-xs text-white/40">
          Est. mortgage balance: $
          {((fa.data.mortgageEstimate as number) || 0).toLocaleString()}
          <span className="text-white/20 ml-2">
            ({fa.data.mortgageMethod as string})
          </span>
          {String(fa.data.mortgageMethod || "").includes("NARRPR") && (
            <span className="ml-1 text-xs rounded-full bg-orange-500/20 text-orange-300 px-1.5 py-0.5">
              NARRPR
            </span>
          )}
        </p>
      )}
      <p className="text-xs text-white/20">
        Source: {fa.data.marketValueSource as string} | Confidence:{" "}
        {fa.data.confidence as string}
      </p>
    </div>
  );
}
