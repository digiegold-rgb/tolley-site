"use client";

import { useEffect, useState } from "react";

interface Health {
  brandPage: { postsLast7Days: number; pageId: string; pageUrl: string };
  lifetime: {
    goClicksFacebook: number;
    goClicksDirect: number;
    goClicksTikTok: number;
    goClicksYouTube: number;
    goClicksInstagram: number;
    goClicksPinterest: number;
    amazonClicks: number;
    amazonAttributedProducts: number;
  };
  subtags: { brand_fb: string | null; gbp: string | null; master: string };
}

export function EcosystemHealth() {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/shop/analytics/ecosystem-health", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "load failed"));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-xs text-rose-200">
        Ecosystem health unavailable: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/40">
        Loading ecosystem health…
      </div>
    );
  }

  const subtagsConfigured =
    data.subtags.brand_fb !== null && data.subtags.gbp !== null;

  return (
    <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.04] to-amber-500/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">
          🌐 Ecosystem Health
        </h2>
        <a
          href={data.brandPage.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.7rem] text-purple-300 underline"
        >
          Brand Page ↗
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Brand-Page posts (7d)"
          value={data.brandPage.postsLast7Days}
          hint="digest + Sat top picks + Sun Amazon picks"
        />
        <Stat
          label="Facebook /go clicks"
          value={data.lifetime.goClicksFacebook}
          hint="lifetime · includes brand_fb"
        />
        <Stat
          label="Direct /go clicks"
          value={data.lifetime.goClicksDirect}
          hint="lifetime · includes Google Maps"
        />
        <Stat
          label="Amazon click-throughs"
          value={data.lifetime.amazonClicks}
          hint={`lifetime · ${data.lifetime.amazonAttributedProducts} products with ASINs`}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="TikTok /go" value={data.lifetime.goClicksTikTok} hint="lifetime" />
        <Stat label="YouTube /go" value={data.lifetime.goClicksYouTube} hint="lifetime" />
        <Stat label="Instagram /go" value={data.lifetime.goClicksInstagram} hint="lifetime" />
        <Stat label="Pinterest /go" value={data.lifetime.goClicksPinterest} hint="lifetime" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/5 pt-3 text-[0.7rem] text-white/40">
        <span>
          <span className="text-white/60">Master tag:</span>{" "}
          <code className="text-amber-200">{data.subtags.master}</code>
        </span>
        {data.subtags.brand_fb ? (
          <span>
            <span className="text-white/60">brand_fb:</span>{" "}
            <code className="text-emerald-200">{data.subtags.brand_fb}</code>
          </span>
        ) : null}
        {data.subtags.gbp ? (
          <span>
            <span className="text-white/60">gbp:</span>{" "}
            <code className="text-emerald-200">{data.subtags.gbp}</code>
          </span>
        ) : null}
        {!subtagsConfigured ? (
          <span className="text-amber-300">
            ⚠️ register <code>tolley-brand-fb-20</code> + <code>tolley-gbp-20</code> in
            Associates Central, then add to <code>AMAZON_SUBTAGS_JSON</code> on Vercel
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="text-[0.7rem] uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white tabular-nums">
        {value.toLocaleString()}
      </div>
      {hint ? <div className="mt-0.5 text-[0.65rem] text-white/30">{hint}</div> : null}
    </div>
  );
}
