"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  BackgroundVariant,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";

// ── Types ────────────────────────────────────────────────────

type NodeStatus = "idle" | "active" | "waiting" | "error";
type Category = "data_source" | "ai" | "strategy" | "risk" | "portfolio" | "discovery" | "notification";

interface CryptoNodeData {
  label: string;
  category: Category;
  status: NodeStatus;
  nodeId: string;
  [key: string]: unknown;
}

interface Props {
  liveData: any;
  engineOnline: boolean;
}

// ── Category colors ──────────────────────────────────────────

const CATEGORY_COLORS: Record<Category, string> = {
  data_source: "#3b82f6",
  ai: "#a855f7",
  strategy: "#f59e0b",
  risk: "#ef4444",
  portfolio: "#22c55e",
  discovery: "#06b6d4",
  notification: "#f97316",
};

const CATEGORY_BG: Record<Category, string> = {
  data_source: "rgba(59,130,246,0.08)",
  ai: "rgba(168,85,247,0.08)",
  strategy: "rgba(245,158,11,0.08)",
  risk: "rgba(239,68,68,0.08)",
  portfolio: "rgba(34,197,94,0.08)",
  discovery: "rgba(6,182,212,0.08)",
  notification: "rgba(249,115,22,0.08)",
};

const CATEGORY_LABELS: Record<Category, string> = {
  data_source: "Data Source",
  ai: "AI",
  strategy: "Strategy",
  risk: "Risk",
  portfolio: "Portfolio",
  discovery: "Discovery",
  notification: "Notification",
};

const STATUS_STYLES: Record<NodeStatus, { bg: string; text: string; label: string }> = {
  idle: { bg: "bg-white/10", text: "text-white/50", label: "Idle" },
  active: { bg: "bg-green-500/20", text: "text-green-300 animate-pulse", label: "Active" },
  waiting: { bg: "bg-amber-500/20", text: "text-amber-300", label: "Waiting" },
  error: { bg: "bg-red-500/20", text: "text-red-300", label: "Error" },
};

// ── Strategy ID mapping ──────────────────────────────────────

const STRAT_ID_MAP: Record<string, string> = {
  strat_trend: "trend_following",
  strat_mean_rev: "mean_reversion",
  strat_dca: "dca_dynamic",
  strat_funding: "funding_rate_arb",
  strat_momentum: "momentum_scalper",
  strat_breakout: "breakout",
  strat_ema: "ema_crossover",
  strat_liq_bounce: "liquidation_bounce",
};

// ── Status Derivation ────────────────────────────────────────

function deriveStatus(nodeId: string, liveData: any): NodeStatus {
  if (!liveData) return "idle";

  const ds = liveData.data_sources || {};
  const strats = liveData.strategies || {};
  const prices = liveData.prices || {};

  switch (nodeId) {
    case "gateio_prices": return Object.keys(prices).length > 0 ? "active" : "waiting";
    case "ohlcv_cache": return (liveData.tracked_symbols ?? 0) > 0 ? "active" : "waiting";
    case "coingecko": return "idle";
    case "tv_signals": return (ds.tradingview?.cached_symbols ?? 0) > 0 ? "active" : "waiting";
    case "futures_tickers": return "active";
    case "contract_stats": return "active";
    case "news_rss": return (ds.sentiment?.headlines_count ?? 0) > 0 ? "active" : "waiting";
    case "regime_detector": return liveData.regime && liveData.regime !== "UNKNOWN" ? "active" : "waiting";
    case "ai_predictions": return Object.keys(liveData.predictions || {}).length > 0 ? "active" : "waiting";
    case "sentiment_scorer": return ds.sentiment?.score !== 0 && ds.sentiment?.score != null ? "active" : "idle";
    case "discovery_scan": return ds.dexscreener?.last_scan ? "active" : "idle";
    case "gateio_movers": return "active";
    case "dexscreener": return ds.dexscreener?.last_scan ? "active" : "idle";
    case "pancakeswap": return "idle";
    case "liquidity_check": return "active";
    case "tier4_promote": return (liveData.tier4_degen || []).length > 0 ? "active" : "idle";
    case "risk_check": return liveData.running ? "active" : "error";
    case "kill_switch": return "idle";
    case "funding_rates": return "active";
    case "stop_loss_tp": return "active";
    case "ai_optimizer": return "active";
    case "equity_update": return "active";
    case "daily_summary": return "idle";
    case "telegram_alerts": return "active";
    default:
      if (nodeId.startsWith("strat_")) {
        const name = STRAT_ID_MAP[nodeId];
        if (name && strats[name]) return strats[name].active ? "active" : "idle";
        return "idle";
      }
      return "active";
  }
}

// ── Tooltip content generator ────────────────────────────────

function getTooltipContent(nodeId: string, liveData: any): { label: string; value: string }[] {
  if (!liveData) return [{ label: "Status", value: "Engine offline" }];

  const ds = liveData.data_sources || {};
  const strats = liveData.strategies || {};
  const prices = liveData.prices || {};
  const predictions = liveData.predictions || {};
  const positions = liveData.positions || [];

  const fmt = (n: number | null | undefined, d = 2) => n != null ? n.toFixed(d) : "--";
  const pct = (n: number | null | undefined) => n != null ? `${(n * 100).toFixed(1)}%` : "--";

  switch (nodeId) {
    case "gateio_prices": {
      const syms = Object.keys(prices);
      const sample = syms.slice(0, 3).map(s => `${s}: $${fmt(prices[s]?.price ?? prices[s])}`);
      return [
        { label: "Symbols tracked", value: String(syms.length) },
        { label: "Proxy", value: ds.proxy?.enabled ? `Mullvad (${ds.proxy?.region || "auto"})` : "Direct" },
        ...sample.map((s, i) => ({ label: i === 0 ? "Sample prices" : "", value: s })),
      ];
    }
    case "coingecko":
      return [
        { label: "Status", value: "Fallback (idle unless Gate.io fails)" },
        { label: "Base URL", value: "api.coingecko.com/api/v3" },
      ];
    case "ohlcv_cache":
      return [
        { label: "Cached symbols", value: String(liveData.tracked_symbols ?? 0) },
        { label: "Interval", value: "1h" },
        { label: "Candles/symbol", value: "100" },
        { label: "Stagger delay", value: "0.15s" },
      ];
    case "tv_signals": {
      const tv = ds.tradingview || {};
      return [
        { label: "Cached signals", value: String(tv.cached_symbols ?? 0) },
        { label: "Last update", value: tv.last_update || "--" },
      ];
    }
    case "futures_tickers":
      return [
        { label: "Contract count", value: String(ds.futures?.contract_count ?? "--") },
        { label: "Avg funding rate", value: pct(ds.futures?.avg_funding_rate) },
      ];
    case "contract_stats":
      return [
        { label: "Tier1 symbols", value: String(ds.contract_stats?.tier1_count ?? "--") },
        { label: "BTC L/S ratio", value: fmt(ds.contract_stats?.btc_long_short_ratio) },
        { label: "BTC OI", value: ds.contract_stats?.btc_oi ? `$${(ds.contract_stats.btc_oi / 1e9).toFixed(1)}B` : "--" },
      ];
    case "news_rss":
      return [
        { label: "Headlines", value: String(ds.sentiment?.headlines_count ?? 0) },
        { label: "Latest", value: ds.sentiment?.latest_headline || "--" },
      ];
    case "regime_detector":
      return [
        { label: "Current regime", value: liveData.regime || "UNKNOWN" },
        { label: "Interval", value: "4h" },
        { label: "Model", value: "Qwen3.5-35B" },
      ];
    case "ai_predictions": {
      const preds = Object.entries(predictions).slice(0, 3);
      const items = preds.map(([sym, p]: [string, any]) => ({
        label: sym,
        value: `${p.direction || "?"} ${pct(p.confidence)} → $${fmt(p.target_price ?? p.targetPrice)}`,
      }));
      return [
        { label: "Predictions", value: String(Object.keys(predictions).length) },
        ...items,
      ];
    }
    case "sentiment_scorer":
      return [
        { label: "Score", value: fmt(ds.sentiment?.score) },
        { label: "Headlines analyzed", value: String(ds.sentiment?.headlines_count ?? 0) },
        { label: "Model", value: "Qwen3.5-35B" },
      ];
    case "discovery_scan":
      return [
        { label: "Enabled", value: ds.dexscreener?.enabled !== false ? "Yes" : "No" },
        { label: "Interval", value: "60min" },
        { label: "Last scan", value: ds.dexscreener?.last_scan || "--" },
      ];
    case "gateio_movers":
      return [{ label: "Source", value: "Gate.io top movers API" }];
    case "dexscreener":
      return [
        { label: "Source", value: "DexScreener trending" },
        { label: "Min volume", value: "$50K" },
        { label: "Min liquidity", value: "$100K" },
      ];
    case "pancakeswap":
      return [
        { label: "Status", value: "Monitoring new launches" },
        { label: "Min liquidity", value: "$50K" },
      ];
    case "liquidity_check":
      return [{ label: "Function", value: "Validates volume & liquidity before promotion" }];
    case "tier4_promote": {
      const t4 = liveData.tier4_degen || [];
      return [
        { label: "Tier4 symbols", value: t4.length > 0 ? t4.join(", ") : "None" },
        { label: "Max allowed", value: "10" },
        { label: "Auto-promote", value: "On" },
      ];
    }
    case "risk_check":
      return [
        { label: "Engine running", value: liveData.running ? "Yes" : "No" },
        { label: "Daily loss", value: pct(liveData.daily_loss) },
        { label: "Max drawdown", value: pct(liveData.max_drawdown) },
        { label: "Kill switch", value: liveData.kill_switch_triggered ? "TRIGGERED" : "Armed" },
      ];
    case "kill_switch":
      return [
        { label: "Triggered", value: liveData.kill_switch_triggered ? "YES" : "No" },
        { label: "Threshold", value: "-15% drawdown" },
      ];
    case "funding_rates":
      return [{ label: "Source", value: "Gate.io futures funding rates" }];
    case "stop_loss_tp":
      return [
        { label: "Open positions", value: String(positions.length) },
        { label: "Function", value: "Monitors SL/TP levels for all open positions" },
      ];
    case "ai_optimizer":
      return [
        { label: "Interval", value: "10min" },
        { label: "Model", value: "Qwen3.5-35B" },
        { label: "Function", value: "Tunes strategy params based on recent performance" },
      ];
    case "equity_update":
      return [
        { label: "Equity", value: `$${fmt(liveData.equity)}` },
        { label: "Cash", value: `$${fmt(liveData.cash)}` },
        { label: "Unrealized PnL", value: `$${fmt(liveData.unrealized_pnl)}` },
        { label: "Realized PnL", value: `$${fmt(liveData.realized_pnl)}` },
        { label: "Mode", value: liveData.mode || "paper" },
      ];
    case "daily_summary":
      return [
        { label: "Frequency", value: "Once daily" },
        { label: "Equity at last", value: liveData.equity ? `$${fmt(liveData.equity)}` : "--" },
      ];
    case "telegram_alerts":
      return [
        { label: "Enabled", value: "Yes" },
        { label: "Destination", value: "Telegram" },
      ];
    default:
      if (nodeId.startsWith("strat_")) {
        const name = STRAT_ID_MAP[nodeId];
        const s = name ? strats[name] : null;
        if (!s) return [{ label: "Status", value: "No data" }];
        const items: { label: string; value: string }[] = [
          { label: "Active", value: s.active ? "Yes" : "No" },
          { label: "Trades", value: String(s.total_trades ?? s.trades ?? 0) },
          { label: "Win rate", value: pct(s.win_rate ?? s.winRate) },
        ];
        if (s.config) {
          const cfg = s.config;
          switch (nodeId) {
            case "strat_trend": items.push({ label: "Params", value: `SMA ${cfg.sma_short ?? 20}/${cfg.sma_long ?? 55}, ATR ${cfg.atr_period ?? 14}×${cfg.atr_mult ?? 2.0}` }); break;
            case "strat_mean_rev": items.push({ label: "Params", value: `BB ${cfg.bb_period ?? 20}/${cfg.bb_std ?? 2.5}σ, RSI ${cfg.rsi_period ?? 14}` }); break;
            case "strat_dca": items.push({ label: "Params", value: `${cfg.interval ?? 15}min interval, SMA ${cfg.sma ?? 20}` }); break;
            case "strat_funding": items.push({ label: "Params", value: `Entry threshold: ${pct(cfg.entry_threshold)}` }); break;
            case "strat_momentum": items.push({ label: "Params", value: `RSI ${cfg.rsi ?? 7}, Vol spike ${cfg.vol_mult ?? 1.5}x` }); break;
            case "strat_breakout": items.push({ label: "Params", value: `${cfg.lookback ?? 20}-candle, ATR ${cfg.atr_mult ?? 1.5}x` }); break;
            case "strat_ema": items.push({ label: "Params", value: `Fast ${cfg.fast ?? 5}/Slow ${cfg.slow ?? 13}, MACD ${cfg.macd_fast ?? 12}/${cfg.macd_slow ?? 26}` }); break;
            case "strat_liq_bounce": items.push({ label: "Params", value: `Drop ${cfg.drop_threshold ?? -3}%` }); break;
          }
        }
        return items;
      }
      return [{ label: "Status", value: "Active" }];
  }
}

// ── Node definitions (32 nodes, 8 layers) ────────────────────

const STRATEGY_IDS = [
  "strat_trend", "strat_mean_rev", "strat_dca", "strat_funding",
  "strat_momentum", "strat_breakout", "strat_ema", "strat_liq_bounce",
];

function buildNodes(): Node<CryptoNodeData>[] {
  const n = (id: string, label: string, category: Category): Node<CryptoNodeData> => ({
    id,
    type: "cryptoNode",
    position: { x: 0, y: 0 },
    data: { label, category, status: "idle", nodeId: id },
  });

  return [
    // Layer 1 — Data Ingestion
    n("gateio_prices", "Gate.io Spot Prices", "data_source"),
    n("coingecko", "CoinGecko Fallback", "data_source"),
    n("ohlcv_cache", "OHLCV Cache", "data_source"),
    // Layer 2 — Supplementary Data
    n("tv_signals", "TradingView Analysis", "data_source"),
    n("futures_tickers", "Futures Tickers", "data_source"),
    n("contract_stats", "Contract Stats", "data_source"),
    n("news_rss", "CoinTelegraph RSS", "data_source"),
    // Layer 3 — AI Processing
    n("regime_detector", "AI Regime Detection", "ai"),
    n("ai_predictions", "AI Predictions", "ai"),
    n("sentiment_scorer", "AI Sentiment Scorer", "ai"),
    // Layer 4 — Discovery
    n("discovery_scan", "Discovery Scan", "discovery"),
    n("gateio_movers", "Gate.io Top Movers", "discovery"),
    n("dexscreener", "DexScreener Trending", "discovery"),
    n("pancakeswap", "PancakeSwap Launches", "discovery"),
    n("liquidity_check", "Liquidity Validation", "discovery"),
    n("tier4_promote", "Tier4 Auto-Promote", "discovery"),
    // Layer 5 — Risk Gate
    n("risk_check", "Portfolio Risk Check", "risk"),
    n("kill_switch", "Kill Switch", "risk"),
    n("funding_rates", "Funding Rate Update", "risk"),
    // Layer 6 — Strategy Execution
    n("strat_trend", "Trend Following", "strategy"),
    n("strat_mean_rev", "Mean Reversion", "strategy"),
    n("strat_dca", "DCA Dynamic", "strategy"),
    n("strat_funding", "Funding Rate Arb", "strategy"),
    n("strat_momentum", "Momentum Scalper", "strategy"),
    n("strat_breakout", "Breakout", "strategy"),
    n("strat_ema", "EMA Crossover", "strategy"),
    n("strat_liq_bounce", "Liquidation Bounce", "strategy"),
    // Layer 7 — Execution & Portfolio
    n("stop_loss_tp", "Stop Loss / Take Profit", "portfolio"),
    n("ai_optimizer", "AI Optimizer", "ai"),
    n("equity_update", "Equity & Snapshot", "portfolio"),
    // Layer 8 — Output
    n("daily_summary", "Daily Summary", "notification"),
    n("telegram_alerts", "Telegram Alerts", "notification"),
  ];
}

// ── Edge definitions (~55 edges) ─────────────────────────────

function buildEdges(): Edge[] {
  const e = (id: string, source: string, target: string, cat: Category, dashed = false): Edge => ({
    id,
    source,
    target,
    animated: true,
    style: {
      stroke: CATEGORY_COLORS[cat],
      strokeDasharray: dashed ? "5 5" : undefined,
    },
  });

  const edges: Edge[] = [
    // Data flow
    e("gateio-ohlcv", "gateio_prices", "ohlcv_cache", "data_source"),
    e("gateio-regime", "gateio_prices", "regime_detector", "data_source"),
    e("coingecko-gateio", "coingecko", "gateio_prices", "data_source", true),
    e("ohlcv-regime", "ohlcv_cache", "regime_detector", "data_source"),
    e("ohlcv-predictions", "ohlcv_cache", "ai_predictions", "data_source"),

    // Supplementary → AI/Risk
    e("news-sentiment", "news_rss", "sentiment_scorer", "data_source"),
    e("futures-contract", "futures_tickers", "contract_stats", "data_source"),
    e("futures-funding", "futures_tickers", "funding_rates", "data_source"),
    e("contract-strat_funding", "contract_stats", "strat_funding", "data_source"),
    e("contract-strat_liq", "contract_stats", "strat_liq_bounce", "data_source"),
    e("sentiment-strat_momentum", "sentiment_scorer", "strat_momentum", "ai"),

    // Discovery chain
    e("disc-movers", "discovery_scan", "gateio_movers", "discovery"),
    e("disc-dex", "discovery_scan", "dexscreener", "discovery"),
    e("disc-pancake", "discovery_scan", "pancakeswap", "discovery"),
    e("movers-liq", "gateio_movers", "liquidity_check", "discovery"),
    e("dex-liq", "dexscreener", "liquidity_check", "discovery"),
    e("pancake-liq", "pancakeswap", "liquidity_check", "discovery"),
    e("liq-tier4", "liquidity_check", "tier4_promote", "discovery"),
    e("tier4-telegram", "tier4_promote", "telegram_alerts", "discovery"),

    // Risk gate
    e("regime-risk", "regime_detector", "risk_check", "ai"),
    e("risk-kill", "risk_check", "kill_switch", "risk"),
    e("funding-strat_funding2", "funding_rates", "strat_funding", "risk"),
  ];

  // OHLCV → all 8 strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`ohlcv-${sid}`, "ohlcv_cache", sid, "data_source"));
  }

  // TV signals → all 8 strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`tv-${sid}`, "tv_signals", sid, "data_source"));
  }

  // Regime → all 8 strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`regime-${sid}`, "regime_detector", sid, "ai"));
  }

  // AI predictions → all 8 strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`pred-${sid}`, "ai_predictions", sid, "ai"));
  }

  // Risk check → all 8 strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`risk-${sid}`, "risk_check", sid, "risk"));
  }

  // All 8 strategies → stop_loss_tp + equity_update
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`${sid}-sl`, sid, "stop_loss_tp", "strategy"));
    edges.push(e(`${sid}-eq`, sid, "equity_update", "strategy"));
  }

  // AI optimizer → all 8 strategies (dashed feedback)
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`opt-${sid}`, "ai_optimizer", sid, "ai", true));
  }

  // Output chain
  edges.push(
    e("sl-telegram", "stop_loss_tp", "telegram_alerts", "portfolio"),
    e("eq-daily", "equity_update", "daily_summary", "portfolio"),
    e("daily-telegram", "daily_summary", "telegram_alerts", "notification"),
  );

  return edges;
}

// ── Dagre layout ─────────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;

function layoutNodes(nodes: Node<CryptoNodeData>[], edges: Edge[]): Node<CryptoNodeData>[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 35, ranksep: 80, marginx: 20, marginy: 20 });
  for (const node of nodes) g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const edge of edges) g.setEdge(edge.source, edge.target);
  Dagre.layout(g);
  return nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });
}

// ── Hover Tooltip ────────────────────────────────────────────

function HoverTooltip({ nodeId, liveData }: { nodeId: string; liveData: any }) {
  const content = getTooltipContent(nodeId, liveData);
  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-[300px] bg-gray-900/95 border border-white/10 backdrop-blur-md rounded-xl shadow-2xl p-3 pointer-events-none">
      <div className="space-y-1.5">
        {content.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {item.label && (
              <span className="text-white/40 shrink-0 min-w-[90px]">{item.label}</span>
            )}
            <span className="text-white/80 break-all">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Custom Crypto Node ───────────────────────────────────────

function CryptoWorkflowNode({ data }: NodeProps<Node<CryptoNodeData>>) {
  const [hovered, setHovered] = useState(false);
  const color = CATEGORY_COLORS[data.category];
  const bg = CATEGORY_BG[data.category];
  const badge = STATUS_STYLES[data.status];
  // Access liveData from the extra field we put on data
  const liveData = (data as any)._liveData;

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Top} className="!bg-white/30 !border-white/40 !w-2.5 !h-2.5" />
      <div
        className="rounded-lg shadow-lg backdrop-blur-sm border border-white/10 transition-all hover:border-white/20"
        style={{ background: bg, borderLeft: `3px solid ${color}`, minWidth: NODE_WIDTH }}
      >
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-white truncate">{data.label}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium whitespace-nowrap ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[0.55rem] font-medium uppercase tracking-wider"
              style={{ color, background: `${color}20` }}
            >
              {CATEGORY_LABELS[data.category]}
            </span>
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white/30 !border-white/40 !w-2.5 !h-2.5" />
      {hovered && <HoverTooltip nodeId={data.nodeId} liveData={liveData} />}
    </div>
  );
}

// ── Node types map ───────────────────────────────────────────

const nodeTypes = { cryptoNode: CryptoWorkflowNode };

// ── Legend ────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="absolute top-4 right-4 z-10 bg-gray-900/90 border border-white/10 backdrop-blur-md rounded-xl p-3 shadow-lg">
      <div className="text-[0.65rem] text-white/40 uppercase tracking-wider mb-2 font-medium">Categories</div>
      <div className="space-y-1.5">
        {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([cat, label]) => (
          <div key={cat} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ background: CATEGORY_COLORS[cat] }} />
            <span className="text-xs text-white/60">{label}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5 mt-2 pt-2">
        <div className="text-[0.65rem] text-white/40 uppercase tracking-wider mb-1.5 font-medium">Status</div>
        <div className="space-y-1">
          {(Object.entries(STATUS_STYLES) as [NodeStatus, typeof STATUS_STYLES.idle][]).map(([key, s]) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`rounded-full px-1.5 py-0.5 text-[0.5rem] font-medium ${s.bg} ${s.text}`}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Inner component (needs ReactFlow context) ────────────────

function CryptoWorkflowInner({ liveData, engineOnline }: Props) {
  const initialNodes = useMemo(() => buildNodes(), []);
  const initialEdges = useMemo(() => buildEdges(), []);

  // Apply Dagre layout
  const laidOutNodes = useMemo(
    () => layoutNodes(initialNodes, initialEdges),
    [initialNodes, initialEdges],
  );

  // Derive statuses from live data and inject liveData ref for tooltips
  const nodesWithStatus = useMemo(() => {
    return laidOutNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        status: engineOnline ? deriveStatus(node.id, liveData) : "idle" as NodeStatus,
        _liveData: liveData,
      },
    }));
  }, [laidOutNodes, liveData, engineOnline]);

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithStatus);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when liveData changes
  useMemo(() => {
    setNodes(nodesWithStatus);
  }, [nodesWithStatus, setNodes]);

  const onInit = useCallback((instance: any) => {
    setTimeout(() => instance.fitView({ padding: 0.1 }), 100);
  }, []);

  return (
    <div className="relative w-full h-[700px] rounded-xl border border-white/5 overflow-hidden bg-black/20">
      <Legend />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.03)" />
        <Controls
          showInteractive={false}
          className="!bg-gray-900/80 !border-white/10 !rounded-lg [&>button]:!bg-transparent [&>button]:!border-white/5 [&>button]:!text-white/50 [&>button:hover]:!bg-white/10"
        />
        <MiniMap
          nodeColor={(n: any) => CATEGORY_COLORS[n.data?.category as Category] || "#888"}
          maskColor="rgba(0,0,0,0.7)"
          className="!bg-gray-900/80 !border-white/10 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}

// ── Exported wrapper ─────────────────────────────────────────

export default function CryptoWorkflow({ liveData, engineOnline }: Props) {
  return (
    <ReactFlowProvider>
      <CryptoWorkflowInner liveData={liveData} engineOnline={engineOnline} />
    </ReactFlowProvider>
  );
}
