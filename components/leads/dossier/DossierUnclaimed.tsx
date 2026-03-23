"use client";

import type { PluginOutput } from "./types";

const sourceLabels: Record<string, string> = {
  "mo-showmemoney": "MO State Treasurer",
  "jackson-surplus": "Jackson Co. Tax Surplus",
  "ks-unclaimed": "KS State Treasurer",
};

export default function DossierUnclaimed({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const uf = pluginData["unclaimed-funds"];
  if (!uf?.success || uf.data?.skipped) return null;

  const funds =
    (uf.data.funds as
      | {
          ownerName: string;
          amount?: number;
          source: string;
          holderName?: string;
          propertyType?: string;
          matchConfidence: number;
        }[]
      | undefined) || [];
  const totalAmount = (uf.data.totalAmount as number) || 0;

  if (funds.length === 0) {
    return (
      <p className="text-white/30 text-sm">
        No unclaimed funds found for{" "}
        {((uf.data.searchedOwners as string[]) || []).join(", ") || "known owners"}.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
        <span className="text-lg font-bold text-emerald-400">
          ${totalAmount.toLocaleString()}
        </span>
        <span className="text-xs text-white/40">
          {funds.length} record{funds.length !== 1 ? "s" : ""} found
        </span>
      </div>

      {/* Individual fund cards */}
      {funds.map((fund, i) => (
        <div key={i} className="rounded-lg bg-white/[0.03] p-3">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-white text-sm">{fund.ownerName}</h4>
              {fund.holderName && (
                <p className="text-xs text-white/40">Held by: {fund.holderName}</p>
              )}
            </div>
            <div className="text-right">
              {fund.amount != null && fund.amount > 0 ? (
                <span className="text-sm font-semibold text-emerald-400">
                  ${fund.amount.toLocaleString()}
                </span>
              ) : (
                <span className="text-xs text-white/30">Amount undisclosed</span>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
              {sourceLabels[fund.source] || fund.source}
            </span>
            {fund.propertyType && (
              <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">
                {fund.propertyType}
              </span>
            )}
            <span className="text-[0.6rem] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">
              {Math.round(fund.matchConfidence * 100)}% match
            </span>
          </div>
        </div>
      ))}

      <p className="text-[0.6rem] text-white/20">
        Searched: {((uf.data.searchedOwners as string[]) || []).join(", ")}
      </p>
    </div>
  );
}
