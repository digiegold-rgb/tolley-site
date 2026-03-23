import type { Node, Edge } from "@xyflow/react";

// ── Types (inline, mirrors WorkflowBase exports)
type NodeStatus = "idle" | "active" | "waiting" | "error";
type Category =
  | "data_source"
  | "ai"
  | "strategy"
  | "risk"
  | "portfolio"
  | "discovery"
  | "notification"
  | "engine";

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

// ── Strategy key mapping
const STRAT_MAP: Record<string, string> = {
  strat_prob_arb: "probability_arb",
  strat_event: "event_momentum",
  strat_mean_rev: "mean_reversion",
};

const STRATEGY_IDS = Object.keys(STRAT_MAP);

// ── Helpers
function makeNode(
  id: string,
  label: string,
  category: Category
): Node<WorkflowNodeData> {
  return {
    id,
    type: "workflowNode",
    position: { x: 0, y: 0 },
    data: { label, category, status: "idle", nodeId: id },
  };
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  cat: Category,
  dashed = false
): Edge {
  return {
    id,
    source,
    target,
    animated: true,
    style: {
      stroke: CATEGORY_COLORS[cat],
      strokeDasharray: dashed ? "5 5" : undefined,
    },
  };
}

// ── Workflow Config ─────────────────────────────────────────────────────
export const polymarketWorkflow: WorkflowConfig = {
  // ── Nodes (14) ──────────────────────────────────────────────────────
  buildNodes() {
    return [
      // Layer 1 — Data
      makeNode("polymarket_api", "Polymarket API", "data_source"),
      makeNode("ohlcv_cache", "Price History", "data_source"),

      // Layer 2 — Discovery
      makeNode("market_scanner", "Market Scanner", "discovery"),
      makeNode("active_markets", "Active Markets", "discovery"),

      // Layer 3 — AI
      makeNode("regime_detector", "AI Regime Detection", "ai"),

      // Layer 4 — MiroFish
      makeNode("mirofish", "MiroFish Signals", "ai"),

      // Layer 5 — Risk
      makeNode("risk_check", "Portfolio Risk Check", "risk"),

      // Layer 6 — Strategies
      makeNode("strat_prob_arb", "Probability Arb", "strategy"),
      makeNode("strat_event", "Event Momentum", "strategy"),
      makeNode("strat_mean_rev", "Mean Reversion", "strategy"),

      // Layer 7 — Portfolio
      makeNode("stop_loss_tp", "Stop Loss / Take Profit", "portfolio"),
      makeNode("equity_update", "Equity & Snapshot", "portfolio"),

      // Layer 8 — Output
      makeNode("telegram_alerts", "Telegram Alerts", "notification"),
    ];
  },

  // ── Edges ───────────────────────────────────────────────────────────
  buildEdges() {
    const edges: Edge[] = [
      // Data flow
      makeEdge("e-api-ohlcv", "polymarket_api", "ohlcv_cache", "data_source"),
      makeEdge("e-api-regime", "polymarket_api", "regime_detector", "data_source"),

      // Discovery flow
      makeEdge("e-scanner-active", "market_scanner", "active_markets", "discovery"),
      makeEdge("e-active-api", "active_markets", "polymarket_api", "discovery"),

      // AI → Risk
      makeEdge("e-regime-risk", "regime_detector", "risk_check", "ai"),
    ];

    // ohlcv_cache → all strategies
    for (const sid of STRATEGY_IDS) {
      edges.push(makeEdge(`e-ohlcv-${sid}`, "ohlcv_cache", sid, "data_source"));
    }

    // regime_detector → all strategies
    for (const sid of STRATEGY_IDS) {
      edges.push(makeEdge(`e-regime-${sid}`, "regime_detector", sid, "ai"));
    }

    // mirofish → all strategies (dashed)
    for (const sid of STRATEGY_IDS) {
      edges.push(makeEdge(`e-miro-${sid}`, "mirofish", sid, "ai", true));
    }

    // risk_check → all strategies
    for (const sid of STRATEGY_IDS) {
      edges.push(makeEdge(`e-risk-${sid}`, "risk_check", sid, "risk"));
    }

    // all strategies → stop_loss_tp & equity_update
    for (const sid of STRATEGY_IDS) {
      edges.push(makeEdge(`e-${sid}-sl`, sid, "stop_loss_tp", "strategy"));
      edges.push(makeEdge(`e-${sid}-eq`, sid, "equity_update", "strategy"));
    }

    // Portfolio → Alerts
    edges.push(makeEdge("e-sl-tg", "stop_loss_tp", "telegram_alerts", "portfolio"));
    edges.push(makeEdge("e-eq-tg", "equity_update", "telegram_alerts", "portfolio"));

    return edges;
  },

  // ── Status derivation ───────────────────────────────────────────────
  deriveStatus(nodeId: string, liveData: any): NodeStatus {
    if (!liveData) return "idle";

    switch (nodeId) {
      case "polymarket_api": {
        const prices = liveData.prices ?? liveData.market_prices;
        if (prices && typeof prices === "object" && Object.keys(prices).length > 0)
          return "active";
        return "idle";
      }

      case "ohlcv_cache": {
        const prices = liveData.prices ?? liveData.market_prices;
        return prices && Object.keys(prices).length > 0 ? "active" : "idle";
      }

      case "market_scanner": {
        return liveData.market_info?.last_scan ? "active" : "idle";
      }

      case "active_markets": {
        const tracked = liveData.market_info?.tracked_markets;
        return tracked && tracked > 0 ? "active" : "idle";
      }

      case "regime_detector": {
        const regime = liveData.regime ?? liveData.market_regime;
        return regime && regime !== "UNKNOWN" ? "active" : "idle";
      }

      case "mirofish": {
        return liveData.mirofish_signals || liveData.simulation_active
          ? "active"
          : "idle";
      }

      case "risk_check": {
        return liveData.running || liveData.risk_active ? "active" : "idle";
      }

      case "stop_loss_tp": {
        const positions = liveData.open_positions ?? liveData.positions;
        return positions && positions > 0 ? "active" : "idle";
      }

      case "equity_update": {
        return liveData.equity != null && liveData.equity > 0 ? "active" : "idle";
      }

      case "telegram_alerts": {
        return liveData.alerts_sent || liveData.telegram_connected
          ? "active"
          : "idle";
      }

      default: {
        // Strategy nodes
        const mapped = STRAT_MAP[nodeId];
        if (mapped) {
          const strats = liveData.strategies;
          if (strats && strats[mapped]) {
            const s = strats[mapped];
            if (s.error) return "error";
            if (s.active === false) return "waiting";
            return "active";
          }
          return "idle";
        }
        return "idle";
      }
    }
  },

  // ── Tooltips ────────────────────────────────────────────────────────
  getTooltip(nodeId: string, liveData: any): { label: string; value: string }[] {
    if (!liveData) return [{ label: "", value: "Engine offline" }];

    switch (nodeId) {
      case "polymarket_api": {
        const prices = liveData.prices ?? liveData.market_prices ?? {};
        const count = Object.keys(prices).length;
        return [
          { label: "Markets", value: `${count} tracked` },
          { label: "Source", value: "Polymarket API" },
          { label: "Port", value: "8953" },
        ];
      }

      case "ohlcv_cache": {
        const prices = liveData.prices ?? liveData.market_prices ?? {};
        return [
          { label: "Markets", value: `${Object.keys(prices).length} cached` },
          { label: "Data", value: "OHLCV top 20 markets" },
        ];
      }

      case "market_scanner": {
        const info = liveData.market_info;
        return [
          { label: "Last Scan", value: info?.last_scan ?? "Never" },
          { label: "Frequency", value: "Hourly" },
          { label: "Volume Filter", value: "> 1,000" },
          { label: "Price Filter", value: "0.05 - 0.95" },
        ];
      }

      case "active_markets": {
        const info = liveData.market_info;
        return [
          { label: "Tracked", value: `${info?.tracked_markets ?? 0} markets` },
          { label: "Discovered", value: `${info?.discovered_total ?? 0} total` },
          { label: "High Volume", value: `${info?.high_volume ?? 0}` },
        ];
      }

      case "regime_detector": {
        const regime = liveData.regime ?? liveData.market_regime ?? "UNKNOWN";
        return [
          { label: "Regime", value: regime },
          { label: "Model", value: "AI Regime Detection" },
          {
            label: "Confidence",
            value: liveData.regime_confidence
              ? `${(liveData.regime_confidence * 100).toFixed(1)}%`
              : "N/A",
          },
        ];
      }

      case "mirofish": {
        return [
          { label: "Type", value: "Simulation Signals" },
          {
            label: "Active",
            value: liveData.mirofish_signals || liveData.simulation_active
              ? "Yes"
              : "No",
          },
          {
            label: "Signals",
            value: `${liveData.mirofish_signal_count ?? 0}`,
          },
        ];
      }

      case "risk_check": {
        return [
          { label: "Status", value: liveData.running ? "Running" : "Idle" },
          {
            label: "Max Position",
            value: liveData.risk_limits?.max_position
              ? `$${liveData.risk_limits.max_position}`
              : "N/A",
          },
          {
            label: "Max Drawdown",
            value: liveData.risk_limits?.max_drawdown
              ? `${(liveData.risk_limits.max_drawdown * 100).toFixed(1)}%`
              : "N/A",
          },
          {
            label: "Exposure",
            value: liveData.risk_limits?.current_exposure
              ? `$${liveData.risk_limits.current_exposure.toFixed(2)}`
              : "N/A",
          },
        ];
      }

      case "stop_loss_tp": {
        const positions = liveData.open_positions ?? liveData.positions ?? 0;
        return [
          { label: "Open Positions", value: `${positions}` },
          { label: "SL Active", value: positions > 0 ? "Yes" : "No" },
          { label: "TP Active", value: positions > 0 ? "Yes" : "No" },
        ];
      }

      case "equity_update": {
        return [
          {
            label: "Equity",
            value: liveData.equity != null ? `$${liveData.equity.toFixed(2)}` : "N/A",
          },
          {
            label: "Cash",
            value: liveData.cash != null ? `$${liveData.cash.toFixed(2)}` : "N/A",
          },
          {
            label: "PnL",
            value: liveData.realized_pnl != null
              ? `$${liveData.realized_pnl.toFixed(2)}`
              : "N/A",
          },
        ];
      }

      case "telegram_alerts": {
        return [
          {
            label: "Connected",
            value: liveData.telegram_connected ? "Yes" : "No",
          },
          {
            label: "Alerts Sent",
            value: `${liveData.alerts_sent ?? 0}`,
          },
        ];
      }

      default: {
        // Strategy nodes
        const mapped = STRAT_MAP[nodeId];
        if (mapped) {
          const s = liveData.strategies?.[mapped];
          if (!s) return [{ label: "", value: "No data" }];
          return [
            {
              label: "Status",
              value: s.error ? "Error" : s.active === false ? "Disabled" : "Active",
            },
            { label: "Trades", value: `${s.trades ?? 0}` },
            {
              label: "Win Rate",
              value: s.win_rate != null ? `${(s.win_rate * 100).toFixed(1)}%` : "N/A",
            },
            {
              label: "PnL",
              value: s.pnl != null ? `$${s.pnl.toFixed(2)}` : "N/A",
            },
            {
              label: "Sharpe",
              value: s.sharpe != null ? s.sharpe.toFixed(2) : "N/A",
            },
          ];
        }
        return [{ label: "", value: "Unknown node" }];
      }
    }
  },
};
