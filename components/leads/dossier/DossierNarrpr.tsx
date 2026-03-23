"use client";

import type { PluginOutput } from "./types";

export default function DossierNarrpr({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const narrpr = pluginData["narrpr-import"];
  if (!narrpr?.success || narrpr.data?.hasNarrprData !== true) return null;

  const rvm = narrpr.data.narrprRvm as
    | { value: number; confidence: number; low?: number; high?: number }
    | undefined;
  const mortgage = narrpr.data.narrprMortgage as
    | { lender: string; amount: number; type: string }
    | undefined;
  const tapestry = narrpr.data.esriTapestry as
    | {
        segment: string;
        segmentCode: string;
        lifeMode: string;
        urbanization: string;
      }
    | undefined;
  const distress = narrpr.data.narrprDistress as
    | { nodDate?: string; auctionDate?: string }
    | undefined;
  const importCount = narrpr.data.importCount as number | undefined;

  return (
    <div className="space-y-3">
      {/* RVM */}
      {rvm && (
        <div className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-3">
          <h4 className="text-xs font-medium text-orange-300/70 mb-2">
            RVM (Realtors Valuation Model)
          </h4>
          <div className="flex items-center gap-4">
            {rvm.low && (
              <span className="text-white/40 text-sm">
                ${(rvm.low || 0).toLocaleString()}
              </span>
            )}
            <span className="text-lg font-bold text-orange-400">
              ${(rvm.value || 0).toLocaleString()}
            </span>
            {rvm.high && (
              <span className="text-white/40 text-sm">
                ${(rvm.high || 0).toLocaleString()}
              </span>
            )}
            <span className="text-xs text-white/20 ml-auto">
              Confidence: {Math.round((rvm.confidence || 0) * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Mortgage */}
      {mortgage && (
        <div className="rounded-lg bg-white/[0.03] p-3">
          <h4 className="text-xs font-medium text-white/50 mb-1">
            Mortgage (Actual)
          </h4>
          <p className="text-sm text-white/80">
            ${(mortgage.amount || 0).toLocaleString()} {mortgage.type} from{" "}
            {mortgage.lender}
          </p>
        </div>
      )}

      {/* Tapestry Demographics */}
      {tapestry && (
        <div className="rounded-lg bg-white/[0.03] p-3">
          <h4 className="text-xs font-medium text-white/50 mb-1">
            Esri Tapestry Demographics
          </h4>
          <p className="text-sm text-white/80">
            {tapestry.segment}
            <span className="text-white/30 ml-2">({tapestry.segmentCode})</span>
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            {tapestry.lifeMode} | {tapestry.urbanization}
          </p>
        </div>
      )}

      {/* Distress */}
      {distress && (
        <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3">
          <h4 className="text-xs font-medium text-red-300/70 mb-1">
            Distress Signals
          </h4>
          {distress.nodDate && (
            <p className="text-xs text-red-200/70">NOD: {distress.nodDate}</p>
          )}
          {distress.auctionDate && (
            <p className="text-xs text-red-200/70">
              Auction: {distress.auctionDate}
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-white/20">
        Source: NARRPR (Realtors Property Resource) | {importCount} import(s)
      </p>
    </div>
  );
}
