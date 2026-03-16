"use client";

import { useState } from "react";
import { PLATFORMS, type Platform } from "@/lib/shop/types";
import { computeNetAfterFees, computePlatformFees, PLATFORM_FEES } from "@/lib/shop/fees";

export function ProfitCalculator({ cogs: initialCogs }: { cogs?: number }) {
  const [price, setPrice] = useState("");
  const [cogs, setCogs] = useState(initialCogs?.toString() || "");

  const priceNum = parseFloat(price) || 0;
  const cogsNum = parseFloat(cogs) || 0;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-sm font-semibold text-white/60">Profit Calculator</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/30">Sale Price</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="shop-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
            placeholder="$0.00"
          />
        </div>
        <div>
          <label className="text-xs text-white/30">COGS</label>
          <input
            type="number"
            value={cogs}
            onChange={(e) => setCogs(e.target.value)}
            className="shop-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
            placeholder="$0.00"
          />
        </div>
      </div>

      {priceNum > 0 && (
        <div className="mt-4 space-y-1.5">
          {PLATFORMS.map((p) => {
            const fees = computePlatformFees(priceNum, p.value as Platform);
            const net = computeNetAfterFees(priceNum, p.value as Platform);
            const profit = net - cogsNum;
            const roi = cogsNum > 0 ? ((profit / cogsNum) * 100).toFixed(1) : "—";

            return (
              <div key={p.value} className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-xs text-white/50">{p.label}</span>
                  <span className="text-[0.6rem] text-white/20">
                    {PLATFORM_FEES[p.value as Platform].label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-white/30">-${fees.toFixed(2)}</span>
                  <span className={profit >= 0 ? "text-green-400" : "text-red-400"}>
                    ${profit.toFixed(2)}
                  </span>
                  <span className="text-white/20 w-12 text-right">{roi}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
