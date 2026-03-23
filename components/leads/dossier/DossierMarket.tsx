"use client";

import type { PluginOutput } from "./types";

export default function DossierMarket({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const mkt = pluginData["market"];
  if (!mkt?.success) return null;

  const pricePerSqft = mkt.data.pricePerSqft as number | undefined;
  const appreciationRate = mkt.data.appreciationRate as number | undefined;
  const priceReductionPct = mkt.data.priceReductionPct as number | undefined;
  const assessedVsListRatio = mkt.data.assessedVsListRatio as number | undefined;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {pricePerSqft != null && (
          <div className="rounded-lg bg-white/[0.03] p-3 text-center">
            <span className="text-lg font-bold text-white/80">${pricePerSqft}</span>
            <div className="text-[0.6rem] text-white/30">$/SQFT</div>
          </div>
        )}
        {appreciationRate != null && (
          <div className="rounded-lg bg-white/[0.03] p-3 text-center">
            <span
              className={`text-lg font-bold ${
                appreciationRate >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {appreciationRate}%
            </span>
            <div className="text-[0.6rem] text-white/30">ANNUAL APPRECIATION</div>
          </div>
        )}
        {priceReductionPct != null && priceReductionPct > 0 && (
          <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3 text-center">
            <span className="text-lg font-bold text-red-400">
              -{priceReductionPct}%
            </span>
            <div className="text-[0.6rem] text-red-300/40">PRICE REDUCED</div>
          </div>
        )}
        {assessedVsListRatio != null && (
          <div className="rounded-lg bg-white/[0.03] p-3 text-center">
            <span
              className={`text-lg font-bold ${
                assessedVsListRatio > 1.15
                  ? "text-red-400"
                  : assessedVsListRatio < 0.85
                    ? "text-green-400"
                    : "text-white/80"
              }`}
            >
              {assessedVsListRatio}x
            </span>
            <div className="text-[0.6rem] text-white/30">LIST/MARKET RATIO</div>
          </div>
        )}
      </div>
      {mkt.warnings && mkt.warnings.length > 0 && (
        <div className="text-xs text-yellow-300/60">
          {mkt.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
      <div>
        <h4 className="text-xs font-medium text-white/50 mb-2">Market Research</h4>
        <div className="flex flex-wrap gap-2">
          {(mkt.sources || []).map((s, i) => (
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
