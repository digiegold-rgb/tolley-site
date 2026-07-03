"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

interface DailyPoint {
  date: string;
  views: number;
  visitors: number;
  productViews: number;
  buyClicks: number;
}

interface Visitor {
  source?: string;
  count: number;
}

interface TopProduct {
  id: string;
  title: string;
  imageUrl: string | null;
  price: number | null;
  status: string | null;
  views: number;
  clicks: number;
  clicksByDest: Record<string, number>;
  ctr: number;
}

interface VisitorData {
  period: { days: number };
  filters: {
    bots: number;
    self: number;
    admin: number;
    skipIpsConfigured: number;
  };
  overview: {
    visitors: number;
    prevVisitors: number;
    pageViews: number;
    prevPageViews: number;
    productViews: number;
    buyClicks: number;
    prevBuyClicks: number;
    sales: number;
  };
  funnel: {
    visitors: number;
    productViews: number;
    buyClicks: number;
    sales: number;
    visitorToView: number;
    viewToClick: number;
    clickToSale: number;
  };
  daily: DailyPoint[];
  referrers: Visitor[];
  topPaths: { path: string; count: number }[];
  topCountries: { code: string; count: number }[];
  topCities: { name: string; count: number }[];
  topProducts: TopProduct[];
  clicksByDest: { dest: string; count: number }[];
}

function pctChange(curr: number, prev: number): { label: string; positive: boolean } | null {
  if (prev === 0 && curr === 0) return null;
  if (prev === 0) return { label: "new", positive: true };
  const delta = ((curr - prev) / prev) * 100;
  return { label: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`, positive: delta >= 0 };
}

export function VisitorAnalytics({ days }: { days: number }) {
  const [data, setData] = useState<VisitorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/shop/analytics/visitors?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [days]);

  if (loading) {
    return <p className="mt-6 text-sm text-white/40">Loading visitor data…</p>;
  }
  if (!data || !data.overview) {
    return <p className="mt-6 text-sm text-red-400">Failed to load visitor data.</p>;
  }

  const visitorChange = pctChange(data.overview.visitors, data.overview.prevVisitors);
  const buyChange = pctChange(data.overview.buyClicks, data.overview.prevBuyClicks);

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.views));

  return (
    <div className="space-y-6">
      {/* Filter transparency line */}
      <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-2 text-[0.7rem] text-emerald-200/80">
        <span className="font-medium">Self-excluded:</span>{" "}
        {data.filters.skipIpsConfigured > 0
          ? `${data.filters.skipIpsConfigured} IPs in ANALYTICS_SKIP_IPS`
          : "no skip-IPs configured"}
        <span className="text-white/30"> · </span>
        Dropped this window:{" "}
        <span className="text-white/70">
          {data.filters.self} self,{" "}
          {data.filters.admin} admin-path,{" "}
          {data.filters.bots} bot
        </span>
        <span className="text-white/30"> · </span>
        Numbers below count only public-storefront visits from non-self IPs.
      </div>

      {/* Topline */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Unique visitors"
          value={data.overview.visitors.toLocaleString()}
          change={visitorChange}
          color="text-blue-300"
        />
        <Stat
          label="Page views"
          value={data.overview.pageViews.toLocaleString()}
          change={pctChange(data.overview.pageViews, data.overview.prevPageViews)}
        />
        <Stat
          label="Buy clicks"
          value={data.overview.buyClicks.toLocaleString()}
          change={buyChange}
          color="text-amber-300"
        />
        <Stat
          label="Stripe sales"
          value={data.overview.sales.toLocaleString()}
          color="text-emerald-300"
        />
      </div>

      {/* Funnel */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white/80">Conversion funnel</h3>
        <p className="mt-1 text-[0.7rem] text-white/40">
          Last {data.period.days} days. Each step shows count + drop-off rate.
        </p>
        <div className="mt-4 space-y-2">
          <FunnelStep label="Visitors" count={data.funnel.visitors} max={data.funnel.visitors} accent="bg-blue-500/30" />
          <FunnelStep
            label="Viewed a product"
            count={data.funnel.productViews}
            max={data.funnel.visitors}
            accent="bg-purple-500/40"
            sub={`${data.funnel.visitorToView}% of visitors`}
          />
          <FunnelStep
            label="Clicked Buy"
            count={data.funnel.buyClicks}
            max={data.funnel.visitors}
            accent="bg-amber-500/40"
            sub={`${data.funnel.viewToClick}% of viewers`}
          />
          <FunnelStep
            label="Stripe sale"
            count={data.funnel.sales}
            max={data.funnel.visitors}
            accent="bg-emerald-500/40"
            sub={`${data.funnel.clickToSale}% of clickers`}
          />
        </div>
      </div>

      {/* Daily series sparkline */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white/80">Daily traffic</h3>
        <div className="mt-3 flex items-end gap-1 overflow-x-auto pb-1" style={{ height: 90 }}>
          {data.daily.map((d) => {
            const h = Math.max(2, Math.round((d.views / maxDaily) * 80));
            const visH = d.views > 0 ? Math.max(2, Math.round((d.visitors / Math.max(1, d.views)) * h)) : 0;
            return (
              <div
                key={d.date}
                className="flex w-3 flex-shrink-0 flex-col justify-end"
                title={`${d.date}: ${d.views} views, ${d.visitors} visitors, ${d.productViews} product views, ${d.buyClicks} buy clicks`}
              >
                <div className="relative w-full bg-blue-500/30" style={{ height: h }}>
                  <div className="absolute bottom-0 left-0 right-0 bg-blue-400" style={{ height: visH }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-3 text-[0.65rem] text-white/40">
          <span>
            <span className="inline-block h-2 w-2 rounded-sm bg-blue-400" /> Visitors
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-sm bg-blue-500/30" /> Page views
          </span>
        </div>
      </div>

      {/* Side-by-side: Referrers + Geography */}
      <div className="grid gap-3 md:grid-cols-2">
        <Panel title="Top referrers">
          {data.referrers.length === 0 ? (
            <p className="text-xs text-white/40">No referrers yet.</p>
          ) : (
            <BarList items={data.referrers.map((r) => ({ label: r.source ?? "—", value: r.count }))} />
          )}
        </Panel>
        <Panel title="Geography">
          {data.topCountries.length === 0 && data.topCities.length === 0 ? (
            <p className="text-xs text-white/40">No geo data yet.</p>
          ) : (
            <>
              {data.topCountries.length > 0 && (
                <div>
                  <p className="text-[0.65rem] uppercase tracking-wide text-white/30">Countries</p>
                  <BarList items={data.topCountries.map((c) => ({ label: c.code, value: c.count }))} />
                </div>
              )}
              {data.topCities.length > 0 && (
                <div className="mt-3">
                  <p className="text-[0.65rem] uppercase tracking-wide text-white/30">Cities</p>
                  <BarList items={data.topCities.slice(0, 5).map((c) => ({ label: c.name, value: c.count }))} />
                </div>
              )}
            </>
          )}
        </Panel>
      </div>

      {/* Top viewed products */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white/80">Top viewed products</h3>
          <p className="text-[0.65rem] text-white/40">CTR = clicks / views</p>
        </div>
        {data.topProducts.length === 0 ? (
          <p className="mt-3 text-xs text-white/40">
            No product views yet — events start logging when shoppers open a
            product on /shop. Come back here in a day.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {data.topProducts.map((p) => (
              <Link
                key={p.id}
                href={`/shop?product=${p.id}`}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5 transition hover:bg-white/[0.05]"
              >
                {p.imageUrl ? (
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded">
                    <Image src={p.imageUrl} alt="" fill className="object-cover" sizes="40px" />
                  </div>
                ) : (
                  <div className="h-10 w-10 flex-shrink-0 rounded bg-white/5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-white">{p.title}</p>
                  <p className="text-[0.6rem] text-white/40">
                    {p.status} · {p.price ? `$${p.price}` : "no price"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[0.7rem]">
                  <span className="text-white/70">{p.views} views</span>
                  <span className="text-amber-300">{p.clicks} clicks</span>
                  <span className="w-12 text-right text-white/50">{p.ctr}% CTR</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Click destinations */}
      {data.clicksByDest.length > 0 && (
        <Panel title="Where buy clicks went">
          <BarList
            items={data.clicksByDest.map((d) => ({ label: prettyDest(d.dest), value: d.count }))}
          />
        </Panel>
      )}
    </div>
  );
}

function prettyDest(d: string) {
  switch (d) {
    case "stripe":
      return "Stripe checkout";
    case "amazon_direct":
      return "Amazon (direct)";
    case "amazon_search":
      return "Amazon (search fallback)";
    case "facebook":
      return "Facebook message";
    default:
      return d;
  }
}

function Stat({
  label,
  value,
  change,
  color,
}: {
  label: string;
  value: string;
  change?: { label: string; positive: boolean } | null;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-white/40">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color || "text-white"}`}>{value}</p>
      {change && (
        <p className={`mt-0.5 text-[0.65rem] ${change.positive ? "text-emerald-400" : "text-red-400"}`}>
          {change.label} vs prev
        </p>
      )}
    </div>
  );
}

function FunnelStep({
  label,
  count,
  max,
  accent,
  sub,
}: {
  label: string;
  count: number;
  max: number;
  accent: string;
  sub?: string;
}) {
  const w = max === 0 ? 0 : Math.min(100, Math.round((count / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="text-white">
          {count.toLocaleString()}
          {sub && <span className="ml-2 text-[0.65rem] text-white/40">{sub}</span>}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div className={`h-full ${accent}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-white/80">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-1">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-2">
          <span className="w-32 flex-shrink-0 truncate text-[0.7rem] text-white/60">{it.label}</span>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-white/[0.04]">
            <div
              className="h-full bg-purple-500/30"
              style={{ width: `${(it.value / max) * 100}%` }}
            />
            <span className="absolute inset-0 flex items-center px-2 text-[0.65rem] text-white">
              {it.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
