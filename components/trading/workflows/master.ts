import type { Node, Edge } from "@xyflow/react";

// ── Types (inline per spec, mirrors WorkflowBase)
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

// ── Helpers
function node(id: string, label: string, category: Category): Node<WorkflowNodeData> {
  return {
    id,
    type: "workflowNode",
    position: { x: 0, y: 0 },
    data: { label, category, status: "idle", nodeId: id },
  };
}

function edge(id: string, source: string, target: string, cat: Category, dashed = false): Edge {
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

// ── Engine node IDs
const ENGINE_IDS = [
  "crypto_engine",
  "stocks_conservative",
  "stocks_aggressive",
  "polymarket_engine",
] as const;

// ── Formatters
function fmt(n: number | undefined | null, prefix = ""): string {
  if (n == null) return "—";
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtInt(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

// ── Workflow Config
export const masterWorkflow: WorkflowConfig = {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  NODES — 12 total across 5 layers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  buildNodes: () => [
    // Layer 1 — Capital
    node("capital_router", "Capital Router", "portfolio"),
    node("market_data", "Market Data Feeds", "data_source"),

    // Layer 2 — AI Core
    node("ai_model", "Qwen3.5-35B (vLLM)", "ai"),
    node("regime_detection", "Multi-Asset Regime", "ai"),

    // Layer 3 — Engines
    node("crypto_engine", "Crypto Engine", "engine"),
    node("stocks_conservative", "Stocks Conservative", "engine"),
    node("stocks_aggressive", "Stocks Aggressive", "engine"),
    node("polymarket_engine", "Polymarket", "engine"),

    // Layer 4 — Simulation
    node("mirofish", "MiroFish Simulation", "ai"),

    // Layer 5 — Output
    node("portfolio_tracker", "Portfolio Tracker", "portfolio"),
    node("dashboard_alerts", "Dashboard Alerts", "notification"),
    node("dashboard", "Trading Dashboard", "data_source"),
  ],

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  EDGES — interconnections between layers
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  buildEdges: () => {
    const edges: Edge[] = [];
    let idx = 0;
    const e = (src: string, tgt: string, cat: Category, dashed = false) => {
      edges.push(edge(`e${idx++}`, src, tgt, cat, dashed));
    };

    // Capital Router → all 4 engines
    for (const eng of ENGINE_IDS) e("capital_router", eng, "portfolio");

    // Market Data → all 4 engines
    for (const eng of ENGINE_IDS) e("market_data", eng, "data_source");

    // AI Model → Regime Detection
    e("ai_model", "regime_detection", "ai");

    // AI Model → all 4 engines (dashed — inference calls)
    for (const eng of ENGINE_IDS) e("ai_model", eng, "ai", true);

    // Regime Detection → all 4 engines
    for (const eng of ENGINE_IDS) e("regime_detection", eng, "ai");

    // All 4 engines → MiroFish
    for (const eng of ENGINE_IDS) e(eng, "mirofish", "strategy");

    // MiroFish → all 4 engines (dashed — feedback signals)
    for (const eng of ENGINE_IDS) e("mirofish", eng, "ai", true);

    // All 4 engines → Portfolio Tracker
    for (const eng of ENGINE_IDS) e(eng, "portfolio_tracker", "portfolio");

    // All 4 engines → Dashboard Alerts
    for (const eng of ENGINE_IDS) e(eng, "dashboard_alerts", "notification");

    // Portfolio Tracker → Dashboard
    e("portfolio_tracker", "dashboard", "portfolio");

    // Portfolio Tracker → Capital Router (dashed — rebalance feedback)
    e("portfolio_tracker", "capital_router", "portfolio", true);

    return edges;
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  STATUS DERIVATION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  deriveStatus: (nodeId: string, liveData: any): NodeStatus => {
    const engines = liveData?.engines ?? {};

    switch (nodeId) {
      case "capital_router":
      case "market_data":
      case "ai_model":
      case "regime_detection":
      case "portfolio_tracker":
      case "dashboard_alerts":
      case "dashboard":
        return "active";

      case "crypto_engine":
        return engines.crypto?.online ? "active" : "idle";
      case "stocks_conservative":
        return engines.stocks_conservative?.online ? "active" : "idle";
      case "stocks_aggressive":
        return engines.stocks_aggressive?.online ? "active" : "idle";
      case "polymarket_engine":
        return engines.polymarket?.online ? "active" : "idle";

      case "mirofish":
        return liveData?.mirofish_online ? "active" : "idle";

      default:
        return "idle";
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  TOOLTIPS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  getTooltip: (nodeId: string, liveData: any): { label: string; value: string }[] => {
    const engines = liveData?.engines ?? {};

    // Helper for engine tooltips
    const engineTip = (eng: any, port: number, symbols: string, strategies: string) => [
      { label: "Port", value: String(port) },
      { label: "Equity", value: fmt(eng?.equity, "$") },
      { label: "P&L", value: fmt(eng?.pnl, "$") },
      { label: "Positions", value: fmtInt(eng?.positions) },
      { label: "Trades", value: fmtInt(eng?.trades) },
      { label: "Regime", value: eng?.regime ?? "—" },
      { label: "Mode", value: eng?.mode ?? "—" },
      { label: "Symbols", value: symbols },
      { label: "Strategies", value: strategies },
    ];

    switch (nodeId) {
      case "capital_router": {
        const totalAum = Object.values(engines).reduce(
          (sum: number, eng: any) => sum + (eng?.equity ?? 0), 0
        );
        return [
          { label: "Port", value: "8960" },
          { label: "Total AUM", value: fmt(totalAum, "$") },
          { label: "Engines", value: String(Object.keys(engines).length) },
          { label: "Role", value: "AI-powered allocation across engines" },
        ];
      }

      case "market_data":
        return [
          { label: "Sources", value: "YFinance, Gate.io, Polymarket, CoinGecko" },
          { label: "Status", value: "Streaming" },
        ];

      case "ai_model":
        return [
          { label: "Model", value: "Qwen3.5-35B-A3B-FP8" },
          { label: "Runtime", value: "vLLM on DGX Spark" },
          { label: "Port", value: "8355" },
        ];

      case "regime_detection":
        return [
          { label: "Role", value: "Multi-asset regime classification" },
          { label: "Assets", value: "Crypto, Stocks, Events" },
          { label: "Output", value: "Bull / Bear / Sideways / Crisis" },
        ];

      case "crypto_engine":
        return engineTip(engines.crypto, 8950, "68 symbols", "8 strategies");

      case "stocks_conservative":
        return engineTip(engines.stocks_conservative, 8951, "55 symbols", "6 strategies");

      case "stocks_aggressive":
        return engineTip(engines.stocks_aggressive, 8952, "29 symbols", "4 strategies");

      case "polymarket_engine":
        return engineTip(engines.polymarket, 8953, "Dynamic markets", "3 strategies");

      case "mirofish": {
        const sims = liveData?.mirofish_sims;
        return [
          { label: "Port", value: "8954" },
          { label: "Type", value: "Multi-agent Monte Carlo" },
          { label: "Simulations", value: sims != null ? fmtInt(sims) : "—" },
          { label: "Role", value: "Forward-looking scenario analysis" },
        ];
      }

      case "portfolio_tracker": {
        const totalEquity = Object.values(engines).reduce(
          (sum: number, eng: any) => sum + (eng?.equity ?? 0), 0
        );
        const totalPnl = Object.values(engines).reduce(
          (sum: number, eng: any) => sum + (eng?.pnl ?? 0), 0
        );
        return [
          { label: "Aggregated Equity", value: fmt(totalEquity, "$") },
          { label: "Aggregated P&L", value: fmt(totalPnl, "$") },
          { label: "Engines Tracked", value: String(Object.keys(engines).length) },
        ];
      }

      case "dashboard_alerts":
        return [
          { label: "Destination", value: "tolley.io/trading (Alerts tab)" },
          { label: "Alerts", value: "Trades, regime shifts, risk, AI optimizer" },
          { label: "Retention", value: "7 days" },
        ];

      case "dashboard":
        return [
          { label: "URL", value: "tolley.io/trading" },
          { label: "Shows", value: "Live equity, P&L, positions, workflows" },
        ];

      default:
        return [{ label: "Node", value: nodeId }];
    }
  },
};
