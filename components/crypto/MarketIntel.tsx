"use client";

import { useState, useEffect } from "react";

interface MarketOverview {
  total_usdt_pairs: number;
  total_volume_24h: number;
  gainers: number;
  losers: number;
  avg_change_pct: number;
  market_sentiment: string;
  avg_funding_rate: number;
  top_volume: { symbol: string; last: number; volume_24h: number; change_pct: number }[];
  high_funding: { symbol: string; rate_pct: number }[];
  futures_contracts: number;
}

interface GainersLosers {
  gainers: { symbol: string; last: number; volume_24h: number; change_pct: number }[];
  losers: { symbol: string; last: number; volume_24h: number; change_pct: number }[];
}

interface TVSignal {
  symbol: string;
  recommendation: string;
  buy: number;
  sell: number;
  neutral: number;
  rsi: number | null;
  macd: number | null;
}

interface DiscoveryData {
  candidates: any[];
  tier4_symbols: string[];
}

interface SentimentData {
  score: number;
  headlines: { title: string; published: string }[];
}

type SubTab = "overview" | "movers" | "signals" | "discovery" | "sentiment";

export default function MarketIntel() {
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [gainersLosers, setGainersLosers] = useState<GainersLosers | null>(null);
  const [tvSignals, setTvSignals] = useState<Record<string, TVSignal>>({});
  const [discovery, setDiscovery] = useState<DiscoveryData | null>(null);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData(subTab);
    const interval = setInterval(() => fetchData(subTab), 30000);
    return () => clearInterval(interval);
  }, [subTab]);

  async function fetchData(tab: SubTab) {
    try {
      setLoading(true);
      if (tab === "overview") {
        const res = await fetch("/api/crypto/market?view=overview");
        if (res.ok) setOverview(await res.json());
      } else if (tab === "movers") {
        const res = await fetch("/api/crypto/market?view=gainers");
        if (res.ok) setGainersLosers(await res.json());
      } else if (tab === "signals") {
        const res = await fetch("/api/crypto/market?view=tv");
        if (res.ok) {
          const data = await res.json();
          setTvSignals(data.signals || {});
        }
      } else if (tab === "discovery") {
        const res = await fetch("/api/crypto/market?view=discovery");
        if (res.ok) setDiscovery(await res.json());
      } else if (tab === "sentiment") {
        const res = await fetch("/api/crypto/market?view=sentiment");
        if (res.ok) setSentiment(await res.json());
      }
    } catch {}
    setLoading(false);
  }

  const subtabs: { key: SubTab; label: string }[] = [
    { key: "overview", label: "Market Overview" },
    { key: "movers", label: "Gainers / Losers" },
    { key: "signals", label: "TV Signals" },
    { key: "discovery", label: "Discovery" },
    { key: "sentiment", label: "Sentiment" },
  ];

  const sentimentColor = (s: string) =>
    s === "bullish" ? "text-green-400" : s === "bearish" ? "text-red-400" : "text-amber-400";

  const changeColor = (v: number) =>
    v > 0 ? "text-green-400" : v < 0 ? "text-red-400" : "text-white/60";

  const recColor = (r: string) => {
    if (r === "BUY" || r === "STRONG_BUY") return "text-green-400 bg-green-500/10";
    if (r === "SELL" || r === "STRONG_SELL") return "text-red-400 bg-red-500/10";
    return "text-amber-400 bg-amber-500/10";
  };

  const fmt = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap">
        {subtabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              subTab === t.key
                ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                : "text-white/40 hover:text-white/60 border border-white/5"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !overview && !gainersLosers ? (
        <div className="crypto-card text-center text-white/40 py-12">Loading market data...</div>
      ) : (
        <>
          {/* Overview */}
          {subTab === "overview" && overview && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="crypto-card">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Sentiment</div>
                  <div className={`text-lg font-bold mt-1 ${sentimentColor(overview.market_sentiment)}`}>
                    {overview.market_sentiment.toUpperCase()}
                  </div>
                </div>
                <div className="crypto-card">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">24h Volume</div>
                  <div className="text-lg font-bold mt-1 text-white">{fmt(overview.total_volume_24h)}</div>
                </div>
                <div className="crypto-card">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Gainers / Losers</div>
                  <div className="text-lg font-bold mt-1">
                    <span className="text-green-400">{overview.gainers}</span>
                    <span className="text-white/20 mx-1">/</span>
                    <span className="text-red-400">{overview.losers}</span>
                  </div>
                </div>
                <div className="crypto-card">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider">Avg Funding</div>
                  <div className={`text-lg font-bold mt-1 ${changeColor(overview.avg_funding_rate)}`}>
                    {overview.avg_funding_rate.toFixed(4)}%
                  </div>
                </div>
              </div>

              {/* Top volume + high funding */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="crypto-card">
                  <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Top Volume</h3>
                  <div className="space-y-2">
                    {overview.top_volume.map((t) => (
                      <div key={t.symbol} className="flex justify-between items-center">
                        <span className="text-sm text-white font-mono">{t.symbol.replace("_USDT", "")}</span>
                        <div className="flex gap-4 items-center">
                          <span className="text-xs text-white/50">{fmt(t.volume_24h)}</span>
                          <span className={`text-xs font-medium w-16 text-right ${changeColor(t.change_pct)}`}>
                            {t.change_pct > 0 ? "+" : ""}{t.change_pct.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="crypto-card">
                  <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">Extreme Funding Rates</h3>
                  <div className="space-y-2">
                    {overview.high_funding.map((f) => (
                      <div key={f.symbol} className="flex justify-between items-center">
                        <span className="text-sm text-white font-mono">{f.symbol.replace("_USDT", "")}</span>
                        <span className={`text-sm font-medium ${changeColor(f.rate_pct)}`}>
                          {f.rate_pct > 0 ? "+" : ""}{f.rate_pct.toFixed(4)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="crypto-card">
                <div className="flex justify-between text-xs text-white/30">
                  <span>{overview.total_usdt_pairs} active USDT pairs</span>
                  <span>{overview.futures_contracts} futures contracts</span>
                  <span>Avg change: {overview.avg_change_pct > 0 ? "+" : ""}{overview.avg_change_pct}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Gainers / Losers */}
          {subTab === "movers" && gainersLosers && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="crypto-card">
                <h3 className="text-xs text-green-400/60 uppercase tracking-wider mb-3">Top Gainers</h3>
                <div className="space-y-1.5">
                  {gainersLosers.gainers.map((t, i) => (
                    <div key={t.symbol} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/20 w-4">{i + 1}</span>
                        <span className="text-sm text-white font-mono">{t.symbol.replace("_USDT", "")}</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <span className="text-xs text-white/40">{fmt(t.volume_24h)}</span>
                        <span className="text-sm font-bold text-green-400 w-20 text-right">
                          +{t.change_pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="crypto-card">
                <h3 className="text-xs text-red-400/60 uppercase tracking-wider mb-3">Top Losers</h3>
                <div className="space-y-1.5">
                  {gainersLosers.losers.map((t, i) => (
                    <div key={t.symbol} className="flex justify-between items-center py-1 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/20 w-4">{i + 1}</span>
                        <span className="text-sm text-white font-mono">{t.symbol.replace("_USDT", "")}</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <span className="text-xs text-white/40">{fmt(t.volume_24h)}</span>
                        <span className="text-sm font-bold text-red-400 w-20 text-right">
                          {t.change_pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TV Signals */}
          {subTab === "signals" && (
            <div className="crypto-card">
              <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                TradingView Technical Analysis ({Object.keys(tvSignals).length} symbols)
              </h3>
              {Object.keys(tvSignals).length === 0 ? (
                <p className="text-white/30 text-sm">No TV signals cached yet. Signals update every 5 minutes.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {Object.entries(tvSignals).map(([sym, sig]) => (
                    <div key={sym} className="border border-white/5 rounded-lg p-2">
                      <div className="text-xs text-white font-mono mb-1">{sym.replace("_USDT", "")}</div>
                      <div className={`text-xs font-bold px-1.5 py-0.5 rounded inline-block ${recColor(sig.recommendation)}`}>
                        {sig.recommendation}
                      </div>
                      <div className="flex gap-2 mt-1.5 text-[10px] text-white/40">
                        <span className="text-green-400/60">B:{sig.buy}</span>
                        <span className="text-red-400/60">S:{sig.sell}</span>
                        <span>N:{sig.neutral}</span>
                      </div>
                      {sig.rsi != null && (
                        <div className="text-[10px] text-white/30 mt-0.5">RSI: {sig.rsi.toFixed(0)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Discovery */}
          {subTab === "discovery" && (
            <div className="space-y-4">
              {discovery?.tier4_symbols && discovery.tier4_symbols.length > 0 && (
                <div className="crypto-card">
                  <h3 className="text-xs text-amber-400/60 uppercase tracking-wider mb-3">Tier 4 Degen Symbols</h3>
                  <div className="flex flex-wrap gap-2">
                    {discovery.tier4_symbols.map((s) => (
                      <span key={s} className="text-xs font-mono bg-amber-500/10 text-amber-400 px-2 py-1 rounded border border-amber-500/20">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="crypto-card">
                <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                  Discovery Candidates ({discovery?.candidates?.length || 0})
                </h3>
                {!discovery?.candidates?.length ? (
                  <p className="text-white/30 text-sm">No candidates yet. Discovery runs every 60 minutes.</p>
                ) : (
                  <div className="space-y-2">
                    {discovery.candidates.map((c: any, i: number) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                        <div>
                          <span className="text-sm text-white font-mono">{c.symbol}</span>
                          <span className="text-[10px] text-white/30 ml-2">{c.source}</span>
                        </div>
                        <div className="flex gap-3 items-center text-xs">
                          <span className="text-white/40">Vol: {fmt(c.volume_24h || c.volume_usd || 0)}</span>
                          <span className="text-white/40">Liq: {fmt(c.liquidity_usd || 0)}</span>
                          {c.price_change_24h != null && (
                            <span className={changeColor(c.price_change_24h)}>
                              {c.price_change_24h > 0 ? "+" : ""}{c.price_change_24h.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sentiment */}
          {subTab === "sentiment" && (
            <div className="space-y-4">
              <div className="crypto-card">
                <h3 className="text-xs text-white/40 uppercase tracking-wider mb-2">News Sentiment Score</h3>
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${
                    (sentiment?.score ?? 0) > 0.3 ? "text-green-400" :
                    (sentiment?.score ?? 0) < -0.3 ? "text-red-400" : "text-amber-400"
                  }`}>
                    {(sentiment?.score ?? 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-white/40">
                    <div>Range: -1.0 (bearish) to +1.0 (bullish)</div>
                    <div>Source: CoinTelegraph RSS + Qwen3.5 AI</div>
                  </div>
                </div>
                {/* Sentiment bar */}
                <div className="mt-3 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (sentiment?.score ?? 0) > 0 ? "bg-green-500" : "bg-red-500"
                    }`}
                    style={{ width: `${Math.abs(sentiment?.score ?? 0) * 50}%`, marginLeft: (sentiment?.score ?? 0) >= 0 ? "50%" : `${50 - Math.abs(sentiment?.score ?? 0) * 50}%` }}
                  />
                </div>
              </div>
              <div className="crypto-card">
                <h3 className="text-xs text-white/40 uppercase tracking-wider mb-3">
                  Latest Headlines ({sentiment?.headlines?.length || 0})
                </h3>
                {!sentiment?.headlines?.length ? (
                  <p className="text-white/30 text-sm">No headlines yet. Sentiment updates every 15 minutes.</p>
                ) : (
                  <div className="space-y-2">
                    {sentiment.headlines.map((h, i) => (
                      <div key={i} className="py-1.5 border-b border-white/5 last:border-0">
                        <div className="text-sm text-white/80">{h.title}</div>
                        {h.published && (
                          <div className="text-[10px] text-white/30 mt-0.5">{h.published}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
