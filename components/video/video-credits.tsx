"use client";

import { useState, useEffect } from "react";
import { CREDIT_PACKS, SUBSCRIPTION_PLANS } from "@/lib/video";

interface CreditData {
  balance: number;
  totalUsed: number;
  totalPurchased: number;
  subscriptionTier: string | null;
  monthlyAllotment: number;
  rolloverCredits: number;
  packsPurchased: number;
}

export function VideoCredits({ onBalanceChange }: { onBalanceChange?: (balance: number) => void }) {
  const [data, setData] = useState<CreditData | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [tab, setTab] = useState<"packs" | "subscribe">("packs");

  useEffect(() => {
    fetch("/api/video/credits")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        onBalanceChange?.(d.balance);
      })
      .catch(() => {});
  }, [onBalanceChange]);

  async function handlePurchase(type: "pack" | "subscription", id: string) {
    setPurchasing(id);
    try {
      const res = await fetch("/api/video/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "pack" ? { type: "pack", packId: id } : { type: "subscription", planId: id },
        ),
      });
      const { url, error } = await res.json();
      if (url) window.location.href = url;
      else alert(error || "Purchase failed");
    } catch {
      alert("Network error");
    } finally {
      setPurchasing(null);
    }
  }

  const showUpsell = data && data.packsPurchased >= 3 && !data.subscriptionTier;

  return (
    <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-b from-purple-500/[0.06] to-transparent p-6">
      {/* Balance header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-purple-300/70">Video Credits</p>
          <p className="mt-1 text-4xl font-black text-white">{data?.balance ?? "..."}</p>
        </div>
        {data?.subscriptionTier && (
          <span className="rounded-full border border-purple-400/30 bg-purple-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-300">
            {data.subscriptionTier} plan
          </span>
        )}
      </div>

      {/* Usage bar */}
      {data && data.totalPurchased > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500">
            <span>{data.totalUsed} used</span>
            <span>{data.totalPurchased} purchased</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-violet-500 transition-all"
              style={{ width: `${Math.min(100, (data.totalUsed / data.totalPurchased) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Upsell banner */}
      {showUpsell && (
        <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          You&apos;ve bought {data.packsPurchased} packs. Subscribe for $49/mo and get 20% more credits — cancel anytime.
        </div>
      )}

      {/* Tab switcher */}
      <div className="mt-5 flex gap-2">
        <button
          onClick={() => setTab("packs")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition ${
            tab === "packs"
              ? "bg-purple-500/20 text-purple-200"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Buy Credits
        </button>
        <button
          onClick={() => setTab("subscribe")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold transition ${
            tab === "subscribe"
              ? "bg-purple-500/20 text-purple-200"
              : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Subscribe &amp; Save 20%
        </button>
      </div>

      {/* Credit packs */}
      {tab === "packs" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 transition hover:border-purple-400/30"
            >
              <p className="text-lg font-black text-white">{pack.name}</p>
              <p className="mt-1 text-2xl font-black text-purple-300">
                {pack.credits} <span className="text-sm font-normal text-slate-400">credits</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                ${(pack.priceCents / 100).toFixed(0)} &middot; ${(pack.perCreditCents / 100).toFixed(2)}/credit
              </p>
              <button
                onClick={() => handlePurchase("pack", pack.id)}
                disabled={purchasing === pack.id}
                className="mt-3 w-full rounded-lg bg-purple-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-purple-400 disabled:opacity-50"
              >
                {purchasing === pack.id ? "..." : `Buy for $${(pack.priceCents / 100).toFixed(0)}`}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Subscriptions */}
      {tab === "subscribe" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-xl border p-4 transition ${
                plan.id === "pro"
                  ? "border-purple-400/40 bg-purple-500/10"
                  : "border-slate-700 bg-slate-800/40 hover:border-purple-400/30"
              }`}
            >
              {plan.id === "pro" && (
                <span className="mb-2 inline-block rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  Most Popular
                </span>
              )}
              <p className="text-lg font-black text-white">{plan.name}</p>
              <p className="mt-1 text-2xl font-black text-purple-300">
                {plan.credits} <span className="text-sm font-normal text-slate-400">credits/mo</span>
              </p>
              <p className="mt-1 text-sm text-slate-500">
                ${(plan.priceCents / 100).toFixed(0)}/mo &middot; ${(plan.perCreditCents / 100).toFixed(2)}/credit
              </p>
              <button
                onClick={() => handlePurchase("subscription", plan.id)}
                disabled={purchasing === plan.id || data?.subscriptionTier === plan.id}
                className="mt-3 w-full rounded-lg bg-purple-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-purple-400 disabled:opacity-50"
              >
                {data?.subscriptionTier === plan.id
                  ? "Current Plan"
                  : purchasing === plan.id
                    ? "..."
                    : `Subscribe $${(plan.priceCents / 100).toFixed(0)}/mo`}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Subscription info */}
      {data?.subscriptionTier && (
        <div className="mt-4 rounded-lg border border-purple-400/15 bg-purple-400/[0.04] px-4 py-3 text-sm text-slate-400">
          <span className="font-bold text-purple-300">{data.subscriptionTier}</span> plan &middot;{" "}
          {data.monthlyAllotment} credits/month
          {data.rolloverCredits > 0 && (
            <span> &middot; {data.rolloverCredits} rolled over</span>
          )}
        </div>
      )}
    </div>
  );
}
