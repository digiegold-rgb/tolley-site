"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ProductRow {
  id: string;
  title: string;
  imageUrl: string | null;
  status: string;
  amazonAsin: string | null;
  goSlug: string | null;
  clicks: {
    amazon: number;
    tiktok: number;
    youtube: number;
    instagram: number;
    facebook: number;
    pinterest: number;
    direct: number;
  };
  total: number;
}

interface LinkRow {
  id: string;
  network: string;
  title: string | null;
  shortCode: string;
  clicks: number;
  conversions: number;
  revenue: number;
  imageUrl: string | null;
}

interface AmazonAssociatesSnapshot {
  capturedAt: string;
  earningsToday: number | null;
  earningsMTD: number | null;
  earningsYTD: number | null;
  clicksToday: number | null;
  clicksMTD: number | null;
  itemsShipped: number | null;
  itemsOrdered: number | null;
  conversionRate: number | null;
}

interface AmazonInfluencerSnapshot {
  capturedAt: string;
  videoViews: number | null;
  storefrontVisits: number | null;
  onsiteEarnings: number | null;
  offsiteEarnings: number | null;
  followerCount: number | null;
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
  reason: string | null;
  activatedAt: string | null;
}

interface StatsResponse {
  totals: {
    amazon: number;
    tiktok: number;
    youtube: number;
    instagram: number;
    facebook: number;
    pinterest: number;
    direct: number;
    goAll: number;
    affiliateLinks: number;
    grand: number;
  };
  affiliateLinks: {
    count: number;
    clicks: number;
    conversions: number;
    revenue: number;
    top: LinkRow[];
  };
  topProducts: ProductRow[];
  amazon?: {
    associates: AmazonAssociatesSnapshot | null;
    influencer: AmazonInfluencerSnapshot | null;
    featureFlags: FeatureFlag[];
  };
}

const SOURCE_META: Record<keyof StatsResponse["totals"], { label: string; emoji: string; accent: string }> = {
  amazon: { label: "Amazon", emoji: "🛒", accent: "text-amber-300" },
  tiktok: { label: "TikTok", emoji: "🎵", accent: "text-pink-300" },
  youtube: { label: "YouTube", emoji: "▶", accent: "text-red-300" },
  instagram: { label: "Instagram", emoji: "📸", accent: "text-fuchsia-300" },
  facebook: { label: "Facebook", emoji: "📘", accent: "text-blue-300" },
  pinterest: { label: "Pinterest", emoji: "📌", accent: "text-rose-300" },
  direct: { label: "Direct", emoji: "🔗", accent: "text-purple-300" },
  goAll: { label: "go/* total", emoji: "", accent: "" },
  affiliateLinks: { label: "Aff links", emoji: "", accent: "" },
  grand: { label: "All", emoji: "", accent: "" },
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function AffiliateStatsCard() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shop/affiliate/stats", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as StatsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/40">
        Loading affiliate stats…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}{" "}
        <button onClick={refresh} className="ml-2 underline">
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { totals, affiliateLinks, topProducts, amazon } = data;
  const amazonAssoc = amazon?.associates ?? null;
  const amazonInfluencer = amazon?.influencer ?? null;
  const tier1On =
    amazon?.featureFlags?.find((f) => f.key === "AMAZON_TIER_1_ENABLED")?.enabled ??
    false;
  const creatorsApiEligible =
    amazon?.featureFlags?.find((f) => f.key === "AMAZON_CREATORS_API_ELIGIBLE")
      ?.enabled ?? false;
  const sourceKeys: (keyof StatsResponse["totals"])[] = [
    "amazon",
    "tiktok",
    "youtube",
    "instagram",
    "facebook",
    "pinterest",
    "direct",
  ];

  return (
    <div className="space-y-4">
      {/* Amazon-side numbers (from dashboard scraper) */}
      {(amazonAssoc || amazonInfluencer) && (
        <div className="rounded-xl border border-[#FF9900]/30 bg-gradient-to-br from-[#FF9900]/10 via-amber-500/5 to-transparent p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#FF9900]">
                🛒 Amazon dashboard (scraped from associates + influencer)
              </p>
              <p className="mt-0.5 text-xs text-white/45">
                {amazonAssoc?.capturedAt
                  ? `Last sync: ${new Date(amazonAssoc.capturedAt).toLocaleString()}`
                  : "No sync yet — worker pending credentials"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-[0.65rem]">
              <span
                className={`rounded-full border px-2 py-0.5 ${
                  tier1On
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 text-white/40"
                }`}
              >
                Tier 1 {tier1On ? "✓ on" : "locked"}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 ${
                  creatorsApiEligible
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 text-white/40"
                }`}
              >
                Creators API {creatorsApiEligible ? "✓ eligible" : "locked"}
              </span>
            </div>
          </div>
          {amazonAssoc && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <BigStat
                label="Earnings today"
                value={amazonAssoc.earningsToday ?? 0}
                accent="text-emerald-300"
                money
              />
              <BigStat
                label="MTD"
                value={amazonAssoc.earningsMTD ?? 0}
                accent="text-emerald-300"
                money
              />
              <BigStat
                label="YTD"
                value={amazonAssoc.earningsYTD ?? 0}
                accent="text-emerald-300"
                money
              />
              <BigStat
                label="Items shipped"
                value={amazonAssoc.itemsShipped ?? 0}
                accent="text-amber-300"
              />
            </div>
          )}
          {amazonInfluencer && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <BigStat
                label="Video views"
                value={amazonInfluencer.videoViews ?? 0}
                accent="text-purple-300"
              />
              <BigStat
                label="Storefront visits"
                value={amazonInfluencer.storefrontVisits ?? 0}
                accent="text-blue-300"
              />
              <BigStat
                label="Onsite earnings"
                value={amazonInfluencer.onsiteEarnings ?? 0}
                accent="text-emerald-300"
                money
              />
              <BigStat
                label="Followers"
                value={amazonInfluencer.followerCount ?? 0}
                accent="text-pink-300"
              />
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-200">
              📊 Affiliate clicks (all-time, on our side)
            </p>
            <p className="mt-0.5 text-xs text-white/45">
              Tracked on Tolley.io — every SiteStripe link &amp; <code>tolley.io/go/CODE</code> redirect.
              Amazon Associates dashboard data is queued as a follow-up scraper.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/55 hover:border-amber-400/40 hover:text-amber-200 disabled:opacity-40"
          >
            {loading ? "…" : "Refresh"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <BigStat label="Total clicks" value={totals.grand} accent="text-white" />
          <BigStat label="Amazon SiteStripe" value={totals.amazon} accent="text-amber-300" />
          <BigStat label="Social /go/" value={totals.goAll} accent="text-purple-300" />
          <BigStat label="Affiliate links" value={totals.affiliateLinks} accent="text-blue-300" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-7">
          {sourceKeys.map((k) => {
            const meta = SOURCE_META[k];
            const value = totals[k] as number;
            return (
              <div
                key={k}
                className="rounded-md border border-white/5 bg-black/30 px-2 py-1.5 text-center"
              >
                <p className="text-[0.6rem] uppercase tracking-wide text-white/40">
                  {meta.emoji} {meta.label}
                </p>
                <p className={`text-sm font-semibold ${meta.accent || "text-white/70"}`}>
                  {fmt(value)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {topProducts.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="mb-3 text-sm font-semibold text-white/85">
            Top products by clicks
            <span className="ml-2 text-xs font-normal text-white/40">
              ({topProducts.length} with traffic)
            </span>
          </p>
          <ul className="space-y-1">
            {topProducts.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/[0.03]"
              >
                <span className="w-5 text-right text-xs text-white/35">
                  {i + 1}
                </span>
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 shrink-0 rounded-md bg-white/5" />
                )}
                <Link
                  href={`/shop/${p.id}`}
                  className="min-w-0 flex-1 truncate text-sm text-white/85 hover:text-purple-300"
                  title={p.title}
                >
                  {p.title}
                </Link>
                <span className="hidden text-[0.7rem] text-white/40 sm:inline">
                  {p.status}
                </span>
                <ClickBreakdown clicks={p.clicks} />
                <span className="w-12 text-right text-sm font-semibold text-amber-300">
                  {fmt(p.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {affiliateLinks.top.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white/85">
              Top affiliate links{" "}
              <span className="ml-2 text-xs font-normal text-white/40">
                ({affiliateLinks.count} active)
              </span>
            </p>
            <p className="text-xs text-white/40">
              {fmt(affiliateLinks.conversions)} conv ·{" "}
              <span className="text-emerald-300">${affiliateLinks.revenue.toFixed(2)}</span>
            </p>
          </div>
          <ul className="space-y-1">
            {affiliateLinks.top.map((l, i) => (
              <li
                key={l.id}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/[0.03]"
              >
                <span className="w-5 text-right text-xs text-white/35">
                  {i + 1}
                </span>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[0.6rem] uppercase text-white/55">
                  {l.network}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                  {l.title || l.shortCode}
                </span>
                <code className="text-[0.65rem] text-white/35">/go/{l.shortCode}</code>
                <span className="w-12 text-right text-sm font-semibold text-blue-300">
                  {fmt(l.clicks)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BigStat({
  label,
  value,
  accent,
  money,
}: {
  label: string;
  value: number;
  accent?: string;
  money?: boolean;
}) {
  const display = money ? `$${value.toFixed(value < 100 ? 2 : 0)}` : fmt(value);
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">
      <p className="text-[0.65rem] uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-bold ${accent ?? "text-white/85"}`}>
        {display}
      </p>
    </div>
  );
}

function ClickBreakdown({
  clicks,
}: {
  clicks: ProductRow["clicks"];
}) {
  const parts: Array<{ k: string; v: number; cls: string }> = [
    { k: "🛒", v: clicks.amazon, cls: "text-amber-300" },
    { k: "🎵", v: clicks.tiktok, cls: "text-pink-300" },
    { k: "▶", v: clicks.youtube, cls: "text-red-300" },
    { k: "📸", v: clicks.instagram, cls: "text-fuchsia-300" },
    { k: "📘", v: clicks.facebook, cls: "text-blue-300" },
    { k: "📌", v: clicks.pinterest, cls: "text-rose-300" },
    { k: "🔗", v: clicks.direct, cls: "text-purple-300" },
  ].filter((p) => p.v > 0);
  if (parts.length === 0) return null;
  return (
    <span className="hidden items-center gap-1.5 text-[0.65rem] text-white/55 md:inline-flex">
      {parts.map((p) => (
        <span key={p.k} className={p.cls}>
          {p.k}
          {p.v}
        </span>
      ))}
    </span>
  );
}
