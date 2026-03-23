import type { Node, Edge } from "@xyflow/react";

// ── Types (inline per workflow convention) ────────────────────
type NodeStatus = "idle" | "active" | "waiting" | "error";
type Category = "data_source" | "ai" | "strategy" | "risk" | "portfolio" | "discovery" | "notification" | "engine";

interface WorkflowNodeData {
  label: string;
  category: Category;
  status: NodeStatus;
  nodeId: string;
  [key: string]: unknown;
}

interface WorkflowConfig {
  buildNodes: () => Node<WorkflowNodeData>[];
  buildEdges: () => Edge[];
  deriveStatus: (nodeId: string, liveData: any) => NodeStatus;
  getTooltip: (nodeId: string, liveData: any) => { label: string; value: string }[];
}

const CATEGORY_COLORS: Record<Category, string> = {
  data_source: "#3b82f6",
  ai: "#a855f7",
  strategy: "#f59e0b",
  risk: "#ef4444",
  portfolio: "#22c55e",
  discovery: "#06b6d4",
  notification: "#f97316",
  engine: "#8b5cf6",
};

// ── Strategy ID mapping ──────────────────────────────────────

const STRAT_MAP: Record<string, string> = {
  strat_oil: "oil_momentum",
  strat_penny: "penny_breakout",
  strat_leveraged: "leveraged_mean_rev",
  strat_volatility: "volatility_trade",
};

const STRATEGY_IDS = Object.keys(STRAT_MAP);

// ── Node definitions (22 nodes, 8 layers) ─────────────────────

function buildNodes(): Node<WorkflowNodeData>[] {
  const n = (id: string, label: string, category: Category): Node<WorkflowNodeData> => ({
    id,
    type: "workflowNode",
    position: { x: 0, y: 0 },
    data: { label, category, status: "idle", nodeId: id },
  });

  return [
    // Layer 1 — Data Ingestion
    n("yfinance_prices", "YFinance Prices", "data_source"),
    n("ohlcv_cache", "OHLCV Cache", "data_source"),

    // Layer 2 — Supplementary Data
    n("tv_signals", "TradingView Analysis", "data_source"),
    n("news_rss", "News RSS Feeds", "data_source"),
    n("cross_asset", "Cross-Asset (VIX/Bonds)", "data_source"),
    n("fred_macro", "FRED Macro Data", "data_source"),
    n("options_flow", "Options Flow Scanner", "data_source"),
    n("sec_insider", "SEC Insider Trading", "data_source"),

    // Layer 3 — AI Processing
    n("regime_detector", "AI Regime Detection", "ai"),
    n("sentiment_scorer", "AI Sentiment Scorer", "ai"),

    // Layer 4 — MiroFish
    n("mirofish", "MiroFish Signals", "ai"),

    // Layer 5 — Risk Gate
    n("risk_check", "Portfolio Risk Check", "risk"),
    n("kill_switch", "Kill Switch", "risk"),

    // Layer 6 — Strategy Execution
    n("strat_oil", "Oil Momentum", "strategy"),
    n("strat_penny", "Penny Breakout", "strategy"),
    n("strat_leveraged", "Leveraged Mean Rev", "strategy"),
    n("strat_volatility", "Volatility Trade", "strategy"),

    // Layer 7 — Execution & Portfolio
    n("stop_loss_tp", "Stop Loss / Take Profit", "portfolio"),
    n("ai_optimizer", "AI Optimizer", "ai"),
    n("equity_update", "Equity & Snapshot", "portfolio"),

    // Layer 8 — Output
    n("daily_summary", "Daily Summary", "notification"),
    n("telegram_alerts", "Telegram Alerts", "notification"),
  ];
}

// ── Edge definitions ──────────────────────────────────────────

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
    // Data flow — Layer 1
    e("yfinance-ohlcv", "yfinance_prices", "ohlcv_cache", "data_source"),
    e("yfinance-regime", "yfinance_prices", "regime_detector", "data_source"),

    // Supplementary → AI
    e("ohlcv-regime", "ohlcv_cache", "regime_detector", "data_source"),
    e("news-sentiment", "news_rss", "sentiment_scorer", "data_source"),
    e("cross-regime", "cross_asset", "regime_detector", "data_source"),
    e("fred-regime", "fred_macro", "regime_detector", "data_source"),
    e("sec-sentiment", "sec_insider", "sentiment_scorer", "data_source"),

    // Risk gate
    e("regime-risk", "regime_detector", "risk_check", "ai"),
    e("sentiment-risk", "sentiment_scorer", "risk_check", "ai"),
    e("risk-kill", "risk_check", "kill_switch", "risk"),

    // MiroFish → sentiment
    e("mirofish-sentiment", "mirofish", "sentiment_scorer", "ai"),
  ];

  // OHLCV → all 4 strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`ohlcv-${sid}`, "ohlcv_cache", sid, "data_source"));
  }

  // TV signals → all 4 strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`tv-${sid}`, "tv_signals", sid, "data_source"));
  }

  // Options flow → all 4 strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`options-${sid}`, "options_flow", sid, "data_source"));
  }

  // Regime → all 4 strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`regime-${sid}`, "regime_detector", sid, "ai"));
  }

  // Risk check → all 4 strategies
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`risk-${sid}`, "risk_check", sid, "risk"));
  }

  // MiroFish → all 4 strategies (dashed advisory)
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`miro-${sid}`, "mirofish", sid, "ai", true));
  }

  // AI optimizer → all 4 strategies (dashed feedback)
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`opt-${sid}`, "ai_optimizer", sid, "ai", true));
  }

  // All 4 strategies → stop_loss_tp + equity_update
  for (const sid of STRATEGY_IDS) {
    edges.push(e(`${sid}-sl`, sid, "stop_loss_tp", "strategy"));
    edges.push(e(`${sid}-eq`, sid, "equity_update", "strategy"));
  }

  // Output chain
  edges.push(
    e("sl-telegram", "stop_loss_tp", "telegram_alerts", "portfolio"),
    e("eq-daily", "equity_update", "daily_summary", "portfolio"),
    e("daily-telegram", "daily_summary", "telegram_alerts", "notification"),
  );

  return edges;
}

// ── Status derivation ─────────────────────────────────────────

function deriveStatus(nodeId: string, liveData: any): NodeStatus {
  if (!liveData) return "idle";

  const ds = liveData.data_sources || {};
  const strats = liveData.strategies || {};
  const prices = liveData.prices || {};

  switch (nodeId) {
    case "yfinance_prices":
      return Object.keys(prices).length > 0 ? "active" : "waiting";
    case "ohlcv_cache":
      return (liveData.tracked_symbols ?? 0) > 0 ? "active" : "waiting";
    case "tv_signals":
      return (ds.tradingview?.cached_symbols ?? 0) > 0 ? "active" : "waiting";
    case "news_rss":
      return (ds.sentiment?.headlines_count ?? 0) > 0 ? "active" : "waiting";
    case "cross_asset":
      return ds.cross_asset?.vix != null ? "active" : "waiting";
    case "fred_macro":
      return ds.fred?.last_update ? "active" : "idle";
    case "options_flow":
      return ds.options_flow?.signals_count ? "active" : "idle";
    case "sec_insider":
      return ds.sec_insider?.filings_count ? "active" : "idle";
    case "regime_detector":
      return liveData.regime && liveData.regime !== "UNKNOWN" ? "active" : "waiting";
    case "sentiment_scorer":
      return ds.sentiment?.score !== 0 && ds.sentiment?.score != null ? "active" : "idle";
    case "mirofish":
      return ds.mirofish?.active ? "active" : "idle";
    case "risk_check":
      return liveData.running ? "active" : "error";
    case "kill_switch":
      return liveData.kill_switch_triggered ? "error" : "idle";
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

// ── Tooltip content generator ─────────────────────────────────

function getTooltip(nodeId: string, liveData: any): { label: string; value: string }[] {
  if (!liveData) return [{ label: "Status", value: "Engine offline" }];

  const ds = liveData.data_sources || {};
  const strats = liveData.strategies || {};
  const prices = liveData.prices || {};
  const positions = liveData.positions || [];

  const fmt = (n: number | null | undefined, d = 2) => n != null ? n.toFixed(d) : "--";
  const pct = (n: number | null | undefined) => n != null ? `${(n * 100).toFixed(1)}%` : "--";

  switch (nodeId) {
    case "yfinance_prices": {
      const syms = Object.keys(prices);
      const sample = syms.slice(0, 3).map(s => `${s}: $${fmt(prices[s]?.price ?? prices[s])}`);
      return [
        { label: "Symbols tracked", value: String(syms.length) },
        { label: "Source", value: "YFinance bulk download" },
        ...sample.map((s, i) => ({ label: i === 0 ? "Sample prices" : "", value: s })),
      ];
    }
    case "ohlcv_cache":
      return [
        { label: "Cached symbols", value: String(liveData.tracked_symbols ?? 0) },
        { label: "Interval", value: "1h" },
        { label: "Candles/symbol", value: "100" },
      ];
    case "tv_signals": {
      const tv = ds.tradingview || {};
      return [
        { label: "Cached signals", value: String(tv.cached_symbols ?? 0) },
        { label: "Last update", value: tv.last_update || "--" },
      ];
    }
    case "news_rss":
      return [
        { label: "Headlines", value: String(ds.sentiment?.headlines_count ?? 0) },
        { label: "Latest", value: ds.sentiment?.latest_headline || "--" },
      ];
    case "cross_asset": {
      const ca = ds.cross_asset || {};
      return [
        { label: "VIX", value: fmt(ca.vix) },
        { label: "10Y yield", value: ca.ten_year ? `${fmt(ca.ten_year)}%` : "--" },
        { label: "DXY", value: fmt(ca.dxy) },
        { label: "Source", value: "YFinance ^VIX, ^TNX, DX-Y.NYB" },
      ];
    }
    case "fred_macro": {
      const fred = ds.fred || {};
      return [
        { label: "Fed Funds Rate", value: fred.fed_funds ? `${fmt(fred.fed_funds)}%` : "--" },
        { label: "CPI YoY", value: fred.cpi_yoy ? `${fmt(fred.cpi_yoy)}%` : "--" },
        { label: "Last update", value: fred.last_update || "--" },
        { label: "Source", value: "FRED API" },
      ];
    }
    case "options_flow": {
      const of_ = ds.options_flow || {};
      return [
        { label: "Signals", value: String(of_.signals_count ?? 0) },
        { label: "Net gamma", value: of_.net_gamma ? `$${fmt(of_.net_gamma / 1e6)}M` : "--" },
        { label: "Put/Call ratio", value: fmt(of_.put_call_ratio) },
      ];
    }
    case "sec_insider": {
      const sec = ds.sec_insider || {};
      return [
        { label: "Recent filings", value: String(sec.filings_count ?? 0) },
        { label: "Net insider buys", value: sec.net_buys ? `$${fmt(sec.net_buys / 1e6)}M` : "--" },
        { label: "Source", value: "SEC EDGAR Form 4" },
      ];
    }
    case "regime_detector":
      return [
        { label: "Current regime", value: liveData.regime || "UNKNOWN" },
        { label: "Interval", value: "4h" },
        { label: "Model", value: "Qwen3.5-35B" },
      ];
    case "sentiment_scorer":
      return [
        { label: "Score", value: fmt(ds.sentiment?.score) },
        { label: "Headlines analyzed", value: String(ds.sentiment?.headlines_count ?? 0) },
        { label: "Model", value: "Qwen3.5-35B" },
      ];
    case "mirofish": {
      const mf = ds.mirofish || {};
      return [
        { label: "Active", value: mf.active ? "Yes" : "No" },
        { label: "Signals", value: String(mf.signal_count ?? 0) },
        { label: "Last signal", value: mf.last_signal || "--" },
        { label: "Function", value: "Simulation-based advisory signals" },
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
        const name = STRAT_MAP[nodeId];
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
            case "strat_oil":
              items.push({ label: "Params", value: `Fast ${cfg.fast_period ?? 10}/Slow ${cfg.slow_period ?? 30}, ATR ${cfg.atr_period ?? 14}x${cfg.atr_mult ?? 2.0}` });
              break;
            case "strat_penny":
              items.push({ label: "Params", value: `Vol mult ${cfg.volume_mult ?? 3.0}x, Breakout ${cfg.breakout_pct ?? 5}%` });
              break;
            case "strat_leveraged":
              items.push({ label: "Params", value: `BB ${cfg.bb_period ?? 20}/${cfg.bb_std ?? 2.5}σ, RSI ${cfg.rsi_period ?? 14}` });
              break;
            case "strat_volatility":
              items.push({ label: "Params", value: `Contango ${cfg.contango_threshold ?? 0.05}, Spike ${cfg.spike_threshold ?? 25}` });
              break;
          }
        }
        return items;
      }
      return [{ label: "Status", value: "Active" }];
  }
}

// ── Export ─────────────────────────────────────────────────────

export const stocksAggressiveWorkflow: WorkflowConfig = {
  buildNodes,
  buildEdges,
  deriveStatus,
  getTooltip,
};
