"use client";

import { useState } from "react";
import { PLATFORMS, type Platform } from "@/lib/shop/types";
import { computeNetAfterFees, computePlatformFees, PLATFORM_FEES } from "@/lib/shop/fees";

interface CrossPostModalProps {
  product: {
    id: string;
    title: string;
    targetPrice: number | null;
    totalCogs: number | null;
    listings: { platform: string; status: string }[];
  };
  onClose: () => void;
  onSuccess: () => void;
}

interface PlatformSelection {
  platform: Platform;
  enabled: boolean;
  price: string;
  externalUrl: string;
}

export function CrossPostModal({ product, onClose, onSuccess }: CrossPostModalProps) {
  const existingPlatforms = new Set(product.listings.map((l) => l.platform));
  const defaultPrice = product.targetPrice?.toString() || "";

  const [selections, setSelections] = useState<PlatformSelection[]>(
    PLATFORMS.map((p) => ({
      platform: p.value,
      enabled: false,
      price: defaultPrice,
      externalUrl: "",
    }))
  );
  const [posting, setPosting] = useState(false);

  function togglePlatform(platform: Platform) {
    setSelections((prev) =>
      prev.map((s) =>
        s.platform === platform ? { ...s, enabled: !s.enabled } : s
      )
    );
  }

  function updateSelection(platform: Platform, field: "price" | "externalUrl", value: string) {
    setSelections((prev) =>
      prev.map((s) =>
        s.platform === platform ? { ...s, [field]: value } : s
      )
    );
  }

  async function handleSubmit() {
    const selected = selections
      .filter((s) => s.enabled && s.price)
      .map((s) => ({
        platform: s.platform,
        price: parseFloat(s.price),
        externalUrl: s.externalUrl || undefined,
      }));

    if (!selected.length) return;
    setPosting(true);

    try {
      const res = await fetch(`/api/shop/products/${product.id}/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platforms: selected }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      onSuccess();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
    setPosting(false);
  }

  const cogs = product.totalCogs || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0c0b14] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Cross-Post</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/60 text-lg">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-white/40 truncate">{product.title}</p>

        <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {PLATFORMS.map((p) => {
            const sel = selections.find((s) => s.platform === p.value)!;
            const alreadyListed = existingPlatforms.has(p.value);
            const priceNum = parseFloat(sel.price) || 0;
            const fees = computePlatformFees(priceNum, p.value);
            const net = computeNetAfterFees(priceNum, p.value);
            const profit = net - cogs;

            return (
              <div
                key={p.value}
                className={`rounded-xl border p-3 transition ${
                  sel.enabled
                    ? "border-purple-500/30 bg-purple-500/5"
                    : "border-white/8 bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => togglePlatform(p.value)}
                    className="flex items-center gap-2"
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border text-xs ${
                        sel.enabled
                          ? "border-purple-500 bg-purple-500 text-white"
                          : "border-white/20"
                      }`}
                    >
                      {sel.enabled ? "✓" : ""}
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: p.color }}
                    >
                      {p.label}
                    </span>
                    {alreadyListed && (
                      <span className="text-[0.6rem] text-white/30">
                        (already listed)
                      </span>
                    )}
                  </button>
                  <span className="text-[0.6rem] text-white/20">
                    {PLATFORM_FEES[p.value].label}
                  </span>
                </div>

                {sel.enabled && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={sel.price}
                        onChange={(e) => updateSelection(p.value, "price", e.target.value)}
                        className="shop-input flex-1 rounded-lg px-3 py-2 text-sm"
                      />
                      {p.value !== "shop" && (
                        <input
                          type="url"
                          placeholder="Listing URL (paste after posting)"
                          value={sel.externalUrl}
                          onChange={(e) => updateSelection(p.value, "externalUrl", e.target.value)}
                          className="shop-input flex-[2] rounded-lg px-3 py-2 text-sm"
                        />
                      )}
                    </div>
                    {priceNum > 0 && (
                      <div className="flex gap-4 text-xs">
                        <span className="text-white/30">
                          Fees: <span className="text-red-400">-${fees.toFixed(2)}</span>
                        </span>
                        <span className="text-white/30">
                          Net: <span className="text-white/60">${net.toFixed(2)}</span>
                        </span>
                        {cogs > 0 && (
                          <span className="text-white/30">
                            Profit:{" "}
                            <span className={profit >= 0 ? "text-green-400" : "text-red-400"}>
                              ${profit.toFixed(2)}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={posting || !selections.some((s) => s.enabled && s.price)}
            className="shop-btn-primary flex-1 rounded-lg py-3 text-sm"
          >
            {posting
              ? "Posting..."
              : `List on ${selections.filter((s) => s.enabled).length} platform${selections.filter((s) => s.enabled).length !== 1 ? "s" : ""}`}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/15 px-4 py-3 text-sm text-white/50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
