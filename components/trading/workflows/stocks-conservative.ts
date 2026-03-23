import type { Node, Edge } from "@xyflow/react";
import {
  makeNode,
  makeEdge,
  type WorkflowConfig,
  type NodeStatus,
  type Category,
  CATEGORY_COLORS,
} from "../WorkflowBase";

// ── Strategy ID mapping ──────────────────────────────────────

const STRAT_MAP: Record<string, string> = {
  strat_momentum: "momentum",
  strat_mean_rev: "mean_reversion",
  strat_etf_rot: "etf_rotation",
  strat_value_dip: "value_dip",
  strat_earnings: "earnings_drift",
  strat_news: "news_catalyst",
};

const STRATEGY_IDS = Object.keys(STRAT_MAP);

// ── Node definitions (26 nodes, 8 layers) ────────────────────

function buildNodes() {
  return [
    // Layer 1 — Data Ingestion
    makeNode("yfinance_prices", "YFinance Prices", "data_source"),
    makeNode("ohlcv_cache", "OHLCV Cache", "data_source"),

    // Layer 2 — Supplementary Data
    makeNode("tv_signals", "TradingView Analysis", "data_source"),
    makeNode("news_rss", "News RSS Feeds", "data_source"),
    makeNode("cross_asset", "Cross-Asset (VIX/Bonds)", "data_source"),
    makeNode("fred_macro", "FRED Macro Data", "data_source"),
    makeNode("options_flow", "Options Flow Scanner", "data_source"),
    makeNode("sec_insider", "SEC Insider Trading", "data_source"),

    // Layer 3 — AI Processing
    makeNode("regime_detector", "AI Regime Detection", "ai"),
    makeNode("ai_predictions", "AI Predictions", "ai"),
    makeNode("sentiment_scorer", "AI Sentiment Scorer", "ai"),

    // Layer 4 — MiroFish
    makeNode("mirofish", "MiroFish Signals", "ai"),

    // Layer 5 — Risk Gate
    makeNode("risk_check", "Portfolio Risk Check", "risk"),
    makeNode("kill_switch", "Kill Switch", "risk"),
    makeNode("pdt_tracker", "PDT Tracker", "risk"),

    // Layer 6 — Strategy Execution
    makeNode("strat_momentum", "Momentum", "strategy"),
    makeNode("strat_mean_rev", "Mean Reversion", "strategy"),
    makeNode("strat_etf_rot", "ETF Rotation", "strategy"),
    makeNode("strat_value_dip", "Value Dip", "strategy"),
    makeNode("strat_earnings", "Earnings Drift", "strategy"),
    makeNode("strat_news", "News Catalyst", "strategy"),

    // Layer 7 — Execution & Portfolio
    makeNode("stop_loss_tp", "Stop Loss / Take Profit", "portfolio"),
    makeNode("ai_optimizer", "AI Optimizer", "ai"),
    makeNode("equity_update", "Equity & Snapshot", "portfolio"),

    // Layer 8 — Output
    makeNode("daily_summary", "Daily Summary", "notification"),
    makeNode("telegram_alerts", "Telegram Alerts", "notification"),
  ];
}

// ── Edge definitions ─────────────────────────────────────────

function buildEdges(): Edge[] {
  const e = makeEdge;

  const edges: Edge[] = [
    // Layer 1 → Layer 2/3
    e("yf-ohlcv", "yfinance_prices", "ohlcv_cache", "data_source"),
    e("yf-regime", "yfinance_prices", "regime_detector", "data_source"),
    e("ohlcv-regime", "ohlcv_cache", "regime_detector", "data_source"),
    e("ohlcv-pred", "ohlcv_cache", "ai_predictions", "data_source"),

    // Supplementary → AI/Risk
    e("news-sentiment", "news_rss", "sentiment_scorer", "data_source"),
    e("cross-risk", "cross_asset", "risk_check", "data_source"),
    e("cross-regime", "cross_asset", "regime_detector", "data_source"),
    e("fred-regime", "fred_macro", "regime_detector", "data_source"),

    // SEC Insider → specific strategies
    e("sec-earnings", "sec_insider", "strat_earnings", "data_source"),
    e("sec-news", "sec_insider", "strat_news", "data_source"),

    // Sentiment → News Catalyst
    e("sentiment-news", "sentiment_scorer", "strat_news", "ai"),

    // Risk gate
    e("regime-risk", "regime_detector", "risk_check", "ai"),
    e("risk-kill", "risk_check", "kill_switch", "risk"),
  ];

  // Options flow → all strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`options-${sid}`, "options_flow", sid, "data_source"));
  }

  // OHLCV → all strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`ohlcv-${sid}`, "ohlcv_cache", sid, "data_source"));
  }

  // TV signals → all strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`tv-${sid}`, "tv_signals", sid, "data_source"));
  }

  // Regime → all strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`regime-${sid}`, "regime_detector", sid, "ai"));
  }

  // AI predictions → all strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`pred-${sid}`, "ai_predictions", sid, "ai"));
  }

  // MiroFish → all strategies (dashed)
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`miro-${sid}`, "mirofish", sid, "ai", true));
  }

  // Risk check → all strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`risk-${sid}`, "risk_check", sid, "risk"));
  }

  // All strategies → stop_loss_tp + equity_update
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`${sid}-sl`, sid, "stop_loss_tp", "strategy"));
    edges.push(e(`${sid}-eq`, sid, "equity_update", "strategy"));
  }

  // AI optimizer → all strategies (dashed feedback)
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

// ── Status derivation ────────────────────────────────────────

function deriveStatus(nodeId: string, liveData: any): NodeStatus {
  if (!liveData) return "idle";

  const ds = liveData.data_sources || {};
  const strats = liveData.strategies || {};
  const prices = liveData.prices || {};
  const predictions = liveData.predictions || {};

  switch (nodeId) {
    case "yfinance_prices":
      return Object.keys(prices).length > 0 ? "active" : "waiting";
    case "ohlcv_cache":
      return (liveData.tracked_symbols ?? 0) > 0 ? "active" : "waiting";
    case "tv_signals":
      return (ds.tradingview?.cached_symbols ?? 0) > 0 ? "active" : "waiting";
    case "news_rss":
      return (liveData.sentiment?.headline_count ?? 0) > 0 ? "active" : "waiting";
    case "cross_asset":
      return liveData.cross_asset?.fresh ? "active" : "waiting";
    case "fred_macro":
      return liveData.macro?.fresh ? "active" : "waiting";
    case "options_flow":
      return liveData.options_flow?.fresh ? "active" : "waiting";
    case "sec_insider":
      return liveData.insider_data?.fresh ? "active" : "waiting";
    case "regime_detector":
      return liveData.regime && liveData.regime !== "UNKNOWN" ? "active" : "waiting";
    case "ai_predictions":
      return Object.keys(predictions).length > 0 ? "active" : "waiting";
    case "sentiment_scorer":
      return liveData.sentiment?.score != null && liveData.sentiment.score !== 0 ? "active" : "idle";
    case "mirofish":
      return Object.keys(liveData.mirofish || {}).length > 0 ? "active" : "waiting";
    case "risk_check":
      return liveData.running ? "active" : "error";
    case "kill_switch":
      return liveData.kill_switch_triggered ? "error" : "idle";
    case "pdt_tracker":
      return "active";
    case "stop_loss_tp":
      return "active";
    case "ai_optimizer":
      return "active";
    case "equity_update":
      return "active";
    case "daily_summary":
      return "idle";
    case "telegram_alerts":
      return "active";
    default:
      if (nodeId.startsWith("strat_")) {
        const name = STRAT_MAP[nodeId];
        if (name && strats[name]) return strats[name].active ? "active" : "idle";
        return "idle";
      }
      return "active";
  }
}

// ── Tooltip content ──────────────────────────────────────────

function getTooltip(nodeId: string, liveData: any): { label: string; value: string }[] {
  if (!liveData) return [{ label: "Status", value: "Engine offline" }];

  const ds = liveData.data_sources || {};
  const strats = liveData.strategies || {};
  const prices = liveData.prices || {};
  const predictions = liveData.predictions || {};
  const positions = liveData.positions || [];

  const fmt = (n: number | null | undefined, d = 2) => n != null ? n.toFixed(d) : "--";
  const pct = (n: number | null | undefined) => n != null ? `${(n * 100).toFixed(1)}%` : "--";

  switch (nodeId) {
    case "yfinance_prices": {
      const syms = Object.keys(prices);
      const sample = syms.slice(0, 3).map(s => `${s}: $${fmt(prices[s]?.price ?? prices[s])}`);
      return [
        { label: "Symbols tracked", value: String(syms.length) },
        { label: "Source", value: "YFinance (bulk)" },
        ...sample.map((s, i) => ({ label: i === 0 ? "Sample prices" : "", value: s })),
      ];
    }
    case "ohlcv_cache":
      return [
        { label: "Cached symbols", value: String(liveData.tracked_symbols ?? 0) },
        { label: "Interval", value: "1d / 1h" },
        { label: "Source", value: "YFinance OHLCV" },
      ];
    case "tv_signals": {
      const tv = ds.tradingview || {};
      return [
        { label: "Cached signals", value: String(tv.cached_symbols ?? 0) },
        { label: "Last update", value: tv.last_update || "--" },
        { label: "Source", value: "TradingView Analysis" },
      ];
    }
    case "news_rss":
      return [
        { label: "Headlines", value: String(liveData.sentiment?.headline_count ?? 0) },
        { label: "Latest", value: liveData.sentiment?.latest_headline || "--" },
        { label: "Source", value: "RSS aggregator" },
      ];
    case "cross_asset": {
      const ca = liveData.cross_asset || {};
      return [
        { label: "VIX", value: ca.vix_level != null ? ca.vix_level.toFixed(1) : "--" },
        { label: "VIX spike", value: ca.vix_spike ? "YES" : "No" },
        { label: "Risk regime", value: ca.risk_regime?.replace(/_/g, " ") || "--" },
        { label: "Fresh", value: ca.fresh ? "Yes" : "Stale" },
      ];
    }
    case "fred_macro": {
      const macro = liveData.macro || {};
      return [
        { label: "Economic phase", value: macro.economic_phase || "--" },
        { label: "Yield curve", value: macro.yield_curve_inverted ? "Inverted" : "Normal" },
        { label: "Fresh", value: macro.fresh ? "Yes" : "Stale" },
        { label: "Source", value: "FRED API" },
      ];
    }
    case "options_flow": {
      const of_ = liveData.options_flow || {};
      return [
        { label: "Market bias", value: of_.market_bias || "--" },
        { label: "Symbols scanned", value: String(of_.symbols_scanned ?? 0) },
        { label: "Fresh", value: of_.fresh ? "Yes" : "Stale" },
        { label: "Source", value: "Unusual activity scanner" },
      ];
    }
    case "sec_insider": {
      const ins = liveData.insider_data || {};
      return [
        { label: "Cluster buys", value: String(ins.cluster_buys ?? 0) },
        { label: "Total scanned", value: String(ins.total_scanned ?? 0) },
        { label: "Fresh", value: ins.fresh ? "Yes" : "Stale" },
        { label: "Source", value: "SEC EDGAR filings" },
      ];
    }
    case "regime_detector":
      return [
        { label: "Current regime", value: liveData.regime || "UNKNOWN" },
        { label: "Interval", value: "Every 4h" },
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
        { label: "Score", value: fmt(liveData.sentiment?.score) },
        { label: "Headlines analyzed", value: String(liveData.sentiment?.headline_count ?? 0) },
        { label: "Model", value: "Qwen3.5-35B" },
      ];
    case "mirofish": {
      const mf = liveData.mirofish || {};
      const keys = Object.keys(mf);
      return [
        { label: "Signals", value: String(keys.length) },
        { label: "Source", value: "MiroFish :8954" },
        { label: "Interval", value: "Every 5 min" },
        ...(keys.length > 0
          ? keys.slice(0, 3).map(k => ({ label: k, value: String(mf[k]?.signal ?? mf[k]) }))
          : []),
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
        { label: "Threshold", value: "-10% drawdown" },
        { label: "Function", value: "Halts all trading if triggered" },
      ];
    case "pdt_tracker":
      return [
        { label: "Day trades (5d)", value: String(liveData.pdt_count ?? "--") },
        { label: "Limit", value: "3 per 5 rolling days" },
        { label: "Function", value: "Prevents pattern day trade violations" },
      ];
    case "stop_loss_tp":
      return [
        { label: "Open positions", value: String(positions.length) },
        { label: "Function", value: "Monitors SL/TP levels for all open positions" },
      ];
    case "ai_optimizer":
      return [
        { label: "Interval", value: "Every 30 min" },
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
        { label: "Frequency", value: "Once daily (market close)" },
        { label: "Equity at last", value: liveData.equity ? `$${fmt(liveData.equity)}` : "--" },
      ];
    case "telegram_alerts":
      return [
        { label: "Enabled", value: "Yes" },
        { label: "Destination", value: "Telegram" },
        { label: "Events", value: "Trades, SL/TP hits, kill switch" },
      ];
    default:
      if (nodeId.startsWith("strat_")) {
        const name = STRAT_MAP[nodeId];
        const s = name ? strats[name] : null;
        if (!s) return [{ label: "Status", value: "No data" }];
        return [
          { label: "Active", value: s.active ? "Yes" : "No" },
          { label: "Trades", value: String(s.total_trades ?? s.trades ?? 0) },
          { label: "Win rate", value: pct(s.win_rate ?? s.winRate) },
          { label: "P&L", value: `$${fmt(s.pnl ?? s.total_pnl)}` },
        ];
      }
      return [{ label: "Status", value: "Active" }];
  }
}

// ── Exported config ──────────────────────────────────────────

export const stocksConservativeWorkflow: WorkflowConfig = {
  buildNodes,
  buildEdges,
  deriveStatus,
  getTooltip,
};
