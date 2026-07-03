"use client";

import { useEffect, useState } from "react";

interface Bucket {
  real: number;
  bot: number;
  bySource: Record<string, { real: number; bot: number }>;
  byBotReason: Record<string, number>;
}

interface ClickQuality {
  period: { days: number };
  total: { real: number; bot: number; sampled: number; botPct: number };
  breakdown: {
    amazon_click: Bucket;
    go_redirect: Bucket;
    affiliate_click: Bucket;
  };
}

const EVENT_LABEL: Record<keyof ClickQuality["breakdown"], string> = {
  amazon_click: "Amazon redirects",
  go_redirect: "/go smart-links",
  affiliate_click: "Other affiliate links",
};

export function ClickQualityCard({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<ClickQuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/shop/affiliate/click-quality?days=${days}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`stats ${res.status}`);
        return (await res.json()) as ClickQuality;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setErr(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "load failed");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (loading) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/40">
        Loading click quality…
      </div>
    );
  }
  if (err || !data) {
    return (
      <div className="rounded-lg border border-red-400/20 bg-red-500/5 p-4 text-xs text-red-200">
        Couldn&apos;t load click quality{err ? ` (${err})` : ""}.
      </div>
    );
  }

  const { real, bot, botPct } = data.total;
  const total = real + bot;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          Affiliate click quality{" "}
          <span className="text-white/40">· last {data.period.days}d</span>
        </h2>
        <span className="text-[0.65rem] uppercase tracking-wide text-white/40">
          {data.total.sampled.toLocaleString()} events sampled
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3">
        <Tile label="Real clicks" value={real} tone="green" />
        <Tile
          label="Bot/DC clicks"
          value={bot}
          tone="amber"
          sub={total > 0 ? `${botPct}% of total` : undefined}
        />
        <Tile label="Total tracked" value={total} tone="neutral" />
      </div>

      <p className="mt-3 text-[0.7rem] leading-snug text-white/50">
        Bot clicks (Amazon link-checker, FB preview crawler, AWS us-west-2 / Boardman OR
        traffic) are excluded from the headline counters. They&apos;re recorded but
        don&apos;t inflate per-product stats.
      </p>

      <div className="mt-4 space-y-2">
        {(Object.keys(data.breakdown) as (keyof typeof data.breakdown)[]).map(
          (key) => {
            const b = data.breakdown[key];
            const subtotal = b.real + b.bot;
            if (subtotal === 0) return null;
            const realPct = Math.round((b.real / subtotal) * 100);
            return (
              <div
                key={key}
                className="rounded border border-white/10 bg-black/20 p-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white/90">{EVENT_LABEL[key]}</span>
                  <span className="text-white/50">
                    {b.real} real · {b.bot} bot
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-emerald-400/80"
                    style={{ width: `${realPct}%` }}
                  />
                </div>
                {Object.entries(b.byBotReason).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[0.65rem] text-white/40">
                    {Object.entries(b.byBotReason).map(([reason, count]) => (
                      <span
                        key={reason}
                        className="rounded bg-white/5 px-1.5 py-0.5"
                      >
                        {reason}: {count}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  tone: "green" | "amber" | "neutral";
}) {
  const color =
    tone === "green"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-white";
  return (
    <div className="rounded border border-white/10 bg-black/20 p-3">
      <div className="text-[0.7rem] uppercase tracking-wide text-white/50">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold ${color}`}>
        {value.toLocaleString()}
      </div>
      {sub && <div className="mt-0.5 text-[0.65rem] text-white/40">{sub}</div>}
    </div>
  );
}
