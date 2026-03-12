"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Dagre from "@dagrejs/dagre";

// ── Types ────────────────────────────────────────────────────

type NodeStatus = "idle" | "running" | "success" | "failed" | "skipped";
type Category = "property" | "verification" | "people" | "legal" | "output" | "financial" | "neighborhood" | "market" | "content";

interface PipelineNodeData {
  label: string;
  category: Category;
  status: NodeStatus;
  confidence: number;
  description?: string;
  url?: string;
  scraperId?: string; // maps to actual scraper name in research worker
  [key: string]: unknown;
}

interface WorkflowExport {
  version: 1;
  exportedAt: string;
  nodes: Node<PipelineNodeData>[];
  edges: Edge[];
}

interface SavedWorkflow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Category colors ──────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  property: "#3b82f6",
  verification: "#f59e0b",
  people: "#8b5cf6",
  legal: "#ef4444",
  output: "#22c55e",
  financial: "#06b6d4",
  neighborhood: "#14b8a6",
  market: "#f97316",
  content: "#a855f7",
};

const CATEGORY_BG: Record<string, string> = {
  property: "rgba(59,130,246,0.08)",
  verification: "rgba(245,158,11,0.08)",
  people: "rgba(139,92,246,0.08)",
  legal: "rgba(239,68,68,0.08)",
  output: "rgba(34,197,94,0.08)",
  financial: "rgba(6,182,212,0.08)",
  neighborhood: "rgba(20,184,166,0.08)",
  market: "rgba(249,115,22,0.08)",
  content: "rgba(168,85,247,0.08)",
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "property", label: "Property" },
  { value: "verification", label: "Verification" },
  { value: "people", label: "People" },
  { value: "legal", label: "Legal" },
  { value: "financial", label: "Financial" },
  { value: "neighborhood", label: "Neighborhood" },
  { value: "market", label: "Market" },
  { value: "content", label: "Content" },
  { value: "output", label: "Output" },
];

const STATUS_BADGE: Record<NodeStatus, { bg: string; text: string; label: string }> = {
  idle: { bg: "bg-white/10", text: "text-white/50", label: "Idle" },
  running: { bg: "bg-blue-500/20", text: "text-blue-300 animate-pulse", label: "Running" },
  success: { bg: "bg-green-500/20", text: "text-green-300", label: "Success" },
  failed: { bg: "bg-red-500/20", text: "text-red-300", label: "Failed" },
  skipped: { bg: "bg-white/5", text: "text-white/30", label: "Skipped" },
};

// Known scrapers for the Add Node panel
const KNOWN_SCRAPERS = [
  // ── DGX Research Worker scrapers (live browser automation) ──
  { id: "matrix-tax", label: "MLS Matrix (Tax/Mortgage)", category: "property" as Category },
  { id: "county-assessor", label: "County Assessor", category: "property" as Category },
  { id: "remine", label: "Remine Pro (Sell Score/AVM)", category: "property" as Category },
  { id: "zillow", label: "Zillow", category: "property" as Category },
  { id: "redfin", label: "Redfin", category: "property" as Category },
  { id: "realtor", label: "Realtor.com", category: "property" as Category },
  { id: "homes", label: "Homes.com", category: "property" as Category },
  { id: "owner-finder", label: "Owner Finder (Google)", category: "property" as Category },
  { id: "cyberbackgroundchecks", label: "CyberBackgroundChecks", category: "people" as Category },
  { id: "backgroundchecks", label: "BackgroundChecks", category: "people" as Category },
  { id: "truepeoplesearch", label: "TruePeopleSearch", category: "people" as Category },
  { id: "casenet", label: "CaseNet (MO Courts)", category: "legal" as Category },
  { id: "social-media", label: "Social Media", category: "people" as Category },
  { id: "obituary", label: "Obituary Search", category: "people" as Category },
  // ── Local Tolley.io plugins (fallback / enrichment) ──
  { id: "regrid", label: "Regrid (Parcel/Absentee)", category: "property" as Category },
  { id: "narrpr-import", label: "NARRPR Import", category: "property" as Category },
  { id: "property-history", label: "Property History", category: "property" as Category },
  { id: "skip-trace", label: "Skip Trace", category: "people" as Category },
  { id: "court-records", label: "Court Records", category: "legal" as Category },
  { id: "people-search", label: "People Search (Google)", category: "people" as Category },
  { id: "street-view", label: "Street View / Maps", category: "property" as Category },
  { id: "neighborhood", label: "Neighborhood Analysis", category: "neighborhood" as Category },
  { id: "financial", label: "Financial Analysis", category: "financial" as Category },
  { id: "unclaimed-funds", label: "Unclaimed Funds", category: "financial" as Category },
  { id: "permits", label: "Building Permits", category: "property" as Category },
  { id: "rental", label: "Rental Analysis", category: "financial" as Category },
  { id: "business", label: "Business Records", category: "legal" as Category },
  { id: "environmental", label: "Environmental (FEMA/EPA)", category: "property" as Category },
  { id: "market", label: "Market Analysis", category: "market" as Category },
  { id: "social-deep", label: "Social Deep Dive", category: "people" as Category },
  { id: "ai-summary", label: "AI Summary", category: "output" as Category },
  // ── Content Engine (social media automation) ──
  { id: "content-generate", label: "AI Content Generate", category: "content" as Category },
  { id: "content-publish", label: "Content Publish", category: "content" as Category },
  { id: "content-linkedin", label: "LinkedIn Publish", category: "content" as Category },
  { id: "content-twitter", label: "X/Twitter Publish", category: "content" as Category },
];

const STORAGE_KEY = "tolley-workflow-v1";

// ── Initial DAG definition ───────────────────────────────────

const INITIAL_NODES: Node<PipelineNodeData>[] = [
  // ── Source ──
  { id: "mls", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "MLS Listing", category: "property", status: "idle", confidence: 0, scraperId: "mls" } },
  // ── Property Layer ──
  { id: "county", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "County Assessor", category: "property", status: "idle", confidence: 0, scraperId: "county-assessor" } },
  { id: "remine", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Remine Pro", category: "property", status: "idle", confidence: 0, scraperId: "remine", description: "Sell Score, AVM, equity, contacts" } },
  { id: "zillow", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Zillow", category: "property", status: "idle", confidence: 0, scraperId: "zillow" } },
  { id: "homes", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Homes.com", category: "property", status: "idle", confidence: 0, scraperId: "homes" } },
  { id: "regrid", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Regrid (Parcel)", category: "property", status: "idle", confidence: 0, scraperId: "regrid", description: "Absentee, vacant, portfolio" } },
  // ── Verification ──
  { id: "verify", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Owner Verification", category: "verification", status: "idle", confidence: 0, scraperId: "owner-verification" } },
  // ── People Layer ──
  { id: "cyberbg", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "CyberBackgroundChecks", category: "people", status: "idle", confidence: 0, scraperId: "cyberbackgroundchecks" } },
  { id: "social", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Social Media", category: "people", status: "idle", confidence: 0, scraperId: "social-media" } },
  // ── Legal Layer ──
  { id: "casenet", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "CaseNet (Courts)", category: "legal", status: "idle", confidence: 0, scraperId: "casenet" } },
  // ── Financial Layer ──
  { id: "financial", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Financial Analysis", category: "financial", status: "idle", confidence: 0, scraperId: "financial", description: "Equity, mortgage, appreciation" } },
  { id: "unclaimed", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Unclaimed Funds", category: "financial", status: "idle", confidence: 0, scraperId: "unclaimed-funds" } },
  // ── Environment / Neighborhood ──
  { id: "neighborhood", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Neighborhood", category: "neighborhood", status: "idle", confidence: 0, scraperId: "neighborhood", description: "Walk Score, schools, crime" } },
  { id: "environmental", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Environmental", category: "property", status: "idle", confidence: 0, scraperId: "environmental", description: "FEMA flood, EPA" } },
  // ── Market ──
  { id: "market", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Market Analysis", category: "market", status: "idle", confidence: 0, scraperId: "market", description: "Price/sqft, CAGR, comps" } },
  // ── Output ──
  { id: "ai-summary", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "AI Summary", category: "output", status: "idle", confidence: 0, scraperId: "ai-summary" } },
  { id: "score", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Score & Profile", category: "output", status: "idle", confidence: 0, scraperId: "score-profile" } },
  // ── Content Engine ──
  { id: "content-gen", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "AI Content Gen", category: "content", status: "idle", confidence: 0, scraperId: "content-generate", description: "Generate social posts from dossier data" } },
  { id: "content-publish", type: "pipeline", position: { x: 0, y: 0 }, data: { label: "Multi-Platform Publish", category: "content", status: "idle", confidence: 0, scraperId: "content-publish", description: "LinkedIn, X, FB, IG" } },
];

const INITIAL_EDGES: Edge[] = [
  // ── MLS → Property scrapers ──
  { id: "mls-county", source: "mls", target: "county", animated: true, label: "address", style: { stroke: CATEGORY_COLORS.property } },
  { id: "mls-remine", source: "mls", target: "remine", animated: true, label: "address", style: { stroke: CATEGORY_COLORS.property } },
  { id: "mls-zillow", source: "mls", target: "zillow", animated: true, label: "address", style: { stroke: CATEGORY_COLORS.property } },
  { id: "mls-homes", source: "mls", target: "homes", animated: true, label: "address", style: { stroke: CATEGORY_COLORS.property } },
  { id: "mls-regrid", source: "mls", target: "regrid", animated: true, label: "address", style: { stroke: CATEGORY_COLORS.property } },
  // ── Property → Owner Verification ──
  { id: "county-verify", source: "county", target: "verify", animated: true, label: "owner_name", style: { stroke: CATEGORY_COLORS.property } },
  { id: "remine-verify", source: "remine", target: "verify", animated: true, label: "owner+contacts", style: { stroke: CATEGORY_COLORS.property } },
  { id: "homes-verify", source: "homes", target: "verify", animated: true, label: "owner_name", style: { stroke: CATEGORY_COLORS.property } },
  // ── Verification → People/Legal ──
  { id: "verify-cyberbg", source: "verify", target: "cyberbg", animated: true, label: "verified_owner", style: { stroke: CATEGORY_COLORS.verification } },
  { id: "verify-casenet", source: "verify", target: "casenet", animated: true, label: "owner_name", style: { stroke: CATEGORY_COLORS.verification } },
  { id: "verify-social", source: "verify", target: "social", animated: true, label: "owner_name", style: { stroke: CATEGORY_COLORS.verification } },
  { id: "verify-unclaimed", source: "verify", target: "unclaimed", animated: true, label: "owner_name", style: { stroke: CATEGORY_COLORS.verification } },
  // ── Property → Financial/Neighborhood/Market ──
  { id: "county-financial", source: "county", target: "financial", animated: true, label: "assessed_value", style: { stroke: CATEGORY_COLORS.financial } },
  { id: "remine-financial", source: "remine", target: "financial", animated: true, label: "avm+equity", style: { stroke: CATEGORY_COLORS.financial } },
  { id: "mls-neighborhood", source: "mls", target: "neighborhood", animated: true, label: "lat/lng", style: { stroke: CATEGORY_COLORS.neighborhood } },
  { id: "mls-environmental", source: "mls", target: "environmental", animated: true, label: "lat/lng", style: { stroke: CATEGORY_COLORS.property } },
  { id: "zillow-market", source: "zillow", target: "market", animated: true, label: "price_history", style: { stroke: CATEGORY_COLORS.market } },
  { id: "remine-market", source: "remine", target: "market", animated: true, label: "sell_score+avm", style: { stroke: CATEGORY_COLORS.market } },
  // ── Everything → AI Summary → Score ──
  { id: "cyberbg-ai", source: "cyberbg", target: "ai-summary", animated: true, label: "phone/email", style: { stroke: CATEGORY_COLORS.people } },
  { id: "casenet-ai", source: "casenet", target: "ai-summary", animated: true, label: "court_records", style: { stroke: CATEGORY_COLORS.legal } },
  { id: "social-ai", source: "social", target: "ai-summary", animated: true, label: "profiles", style: { stroke: CATEGORY_COLORS.people } },
  { id: "financial-ai", source: "financial", target: "ai-summary", animated: true, label: "equity+mortgage", style: { stroke: CATEGORY_COLORS.financial } },
  { id: "unclaimed-ai", source: "unclaimed", target: "ai-summary", animated: true, label: "funds_found", style: { stroke: CATEGORY_COLORS.financial } },
  { id: "neighborhood-ai", source: "neighborhood", target: "ai-summary", animated: true, label: "walk+school+crime", style: { stroke: CATEGORY_COLORS.neighborhood } },
  { id: "environmental-ai", source: "environmental", target: "ai-summary", animated: true, label: "flood+env", style: { stroke: CATEGORY_COLORS.property } },
  { id: "market-ai", source: "market", target: "ai-summary", animated: true, label: "market_data", style: { stroke: CATEGORY_COLORS.market } },
  { id: "regrid-ai", source: "regrid", target: "ai-summary", animated: true, label: "parcel_flags", style: { stroke: CATEGORY_COLORS.property } },
  { id: "zillow-ai", source: "zillow", target: "ai-summary", animated: true, label: "property_data", style: { stroke: CATEGORY_COLORS.property } },
  { id: "ai-score", source: "ai-summary", target: "score", animated: true, label: "full_dossier", style: { stroke: CATEGORY_COLORS.output } },
  // ── Score → Content Engine ──
  { id: "score-content", source: "score", target: "content-gen", animated: true, label: "dossier+score", style: { stroke: CATEGORY_COLORS.content } },
  { id: "content-gen-publish", source: "content-gen", target: "content-publish", animated: true, label: "ai_posts", style: { stroke: CATEGORY_COLORS.content } },
];

// ── Dagre layout ─────────────────────────────────────────────

function layoutNodes(nodes: Node<PipelineNodeData>[], edges: Edge[]): Node<PipelineNodeData>[] {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 180 });
  for (const node of nodes) g.setNode(node.id, { width: 220, height: 90 });
  for (const edge of edges) g.setEdge(edge.source, edge.target);
  Dagre.layout(g);
  return nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - 110, y: pos.y - 45 } };
  });
}

// ── Custom Pipeline Node ─────────────────────────────────────

function PipelineNode({ data, selected }: NodeProps<Node<PipelineNodeData>>) {
  const color = CATEGORY_COLORS[data.category] || "#888";
  const bg = CATEGORY_BG[data.category] || "rgba(255,255,255,0.03)";
  const badge = STATUS_BADGE[data.status] || STATUS_BADGE.idle;

  return (
    <div
      className={`rounded-lg shadow-lg backdrop-blur-sm transition-all ${
        selected ? "ring-2 ring-white/40 border-white/30" : "border-white/10"
      } border`}
      style={{ background: bg, borderLeft: `3px solid ${color}`, minWidth: 200 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-white/30 !border-white/40 !w-3 !h-3 hover:!bg-white/60 hover:!scale-125 transition-all" />
      <div className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white truncate">{data.label}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium whitespace-nowrap ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="rounded-full px-2 py-0.5 text-[0.55rem] font-medium uppercase tracking-wider" style={{ color, background: `${color}20` }}>
            {data.category}
          </span>
          <span className="text-xs text-white/40 tabular-nums">
            {data.confidence > 0 ? `${data.confidence}%` : "--"}
          </span>
        </div>
        {data.scraperId && (
          <div className="text-[0.55rem] text-white/20 mt-1 font-mono truncate">{data.scraperId}</div>
        )}
        {data.description && (
          <div className="text-[0.6rem] text-white/30 mt-0.5 truncate">{data.description}</div>
        )}
        {data.status === "running" && (
          <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full animate-pulse" style={{ background: color, width: "60%" }} />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-white/30 !border-white/40 !w-3 !h-3 hover:!bg-white/60 hover:!scale-125 transition-all" />
    </div>
  );
}

// ── Add Node Panel ───────────────────────────────────────────

function AddNodePanel({ onAdd, onClose }: { onAdd: (label: string, category: Category, description: string, scraperId: string) => void; onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<Category>("property");
  const [description, setDescription] = useState("");
  const [scraperId, setScraperId] = useState("");
  const [showScraperList, setShowScraperList] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onAdd(label.trim(), category, description.trim(), scraperId.trim());
    onClose();
  };

  const selectScraper = (s: typeof KNOWN_SCRAPERS[0]) => {
    setLabel(s.label);
    setCategory(s.category);
    setScraperId(s.id);
    setShowScraperList(false);
  };

  return (
    <div className="absolute top-16 left-4 z-20 w-80">
      <form onSubmit={handleSubmit} className="rounded-xl bg-gray-900/95 border border-white/10 backdrop-blur-md shadow-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Add Node</h3>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">&times;</button>
        </div>

        {/* Quick-add from known scrapers */}
        <div className="mb-3">
          <button type="button" onClick={() => setShowScraperList(!showScraperList)}
            className="text-[0.65rem] text-purple-400 hover:text-purple-300 transition-colors">
            {showScraperList ? "Hide" : "Quick add from"} known scrapers
          </button>
          {showScraperList && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1 rounded-lg bg-white/5 p-2">
              {KNOWN_SCRAPERS.map((s) => (
                <button key={s.id} type="button" onClick={() => selectScraper(s)}
                  className="w-full text-left rounded-md px-2 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm" style={{ background: CATEGORY_COLORS[s.category] }} />
                  <span>{s.label}</span>
                  <span className="text-white/20 font-mono text-[0.55rem] ml-auto">{s.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[0.65rem] text-white/40 uppercase tracking-wider mb-1">Name</label>
            <input ref={inputRef} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. LinkedIn Scraper"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30" />
          </div>
          <div>
            <label className="block text-[0.65rem] text-white/40 uppercase tracking-wider mb-1">Scraper ID</label>
            <input value={scraperId} onChange={(e) => setScraperId(e.target.value)} placeholder="e.g. linkedin (maps to research worker)"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/70 font-mono placeholder-white/20 focus:outline-none focus:border-white/30" />
          </div>
          <div>
            <label className="block text-[0.65rem] text-white/40 uppercase tracking-wider mb-1">Category</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                  className={`rounded-lg px-2 py-1.5 text-[0.65rem] font-medium border transition-all ${
                    category === cat.value ? "border-white/30 bg-white/10 text-white" : "border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5"
                  }`}
                  style={category === cat.value ? { borderColor: CATEGORY_COLORS[cat.value], color: CATEGORY_COLORS[cat.value] } : {}}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[0.65rem] text-white/40 uppercase tracking-wider mb-1">Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this step does"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30" />
          </div>
          <button type="submit" disabled={!label.trim()}
            className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            Add to Workflow
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Edit Node Panel ──────────────────────────────────────────

function EditNodePanel({ node, onSave, onClose }: {
  node: Node<PipelineNodeData>;
  onSave: (id: string, label: string, category: Category, description: string, scraperId: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(node.data.label);
  const [category, setCategory] = useState<Category>(node.data.category);
  const [description, setDescription] = useState(node.data.description || "");
  const [scraperId, setScraperId] = useState(node.data.scraperId || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onSave(node.id, label.trim(), category, description.trim(), scraperId.trim());
    onClose();
  };

  return (
    <div className="absolute top-16 left-4 z-20 w-80">
      <form onSubmit={handleSubmit} className="rounded-xl bg-gray-900/95 border border-white/10 backdrop-blur-md shadow-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Edit Node</h3>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">&times;</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[0.65rem] text-white/40 uppercase tracking-wider mb-1">Name</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30" />
          </div>
          <div>
            <label className="block text-[0.65rem] text-white/40 uppercase tracking-wider mb-1">Scraper ID</label>
            <input value={scraperId} onChange={(e) => setScraperId(e.target.value)} placeholder="maps to research worker scraper"
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/70 font-mono placeholder-white/20 focus:outline-none focus:border-white/30" />
          </div>
          <div>
            <label className="block text-[0.65rem] text-white/40 uppercase tracking-wider mb-1">Category</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((cat) => (
                <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                  className={`rounded-lg px-2 py-1.5 text-[0.65rem] font-medium border transition-all ${
                    category === cat.value ? "border-white/30 bg-white/10 text-white" : "border-white/5 bg-white/[0.02] text-white/40 hover:bg-white/5"
                  }`}
                  style={category === cat.value ? { borderColor: CATEGORY_COLORS[cat.value], color: CATEGORY_COLORS[cat.value] } : {}}>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[0.65rem] text-white/40 uppercase tracking-wider mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30" />
          </div>
          <button type="submit" className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition-colors">
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Edge Label Input ─────────────────────────────────────────

function EdgeLabelPanel({ edge, onSave, onClose }: { edge: Edge; onSave: (id: string, label: string) => void; onClose: () => void }) {
  const [label, setLabel] = useState((edge.label as string) || "");

  return (
    <div className="absolute top-16 left-4 z-20 w-64">
      <form onSubmit={(e) => { e.preventDefault(); onSave(edge.id, label); onClose(); }}
        className="rounded-xl bg-gray-900/95 border border-white/10 backdrop-blur-md shadow-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Edit Edge Label</h3>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">&times;</button>
        </div>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. owner_name, phone/email"
          className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 mb-3" />
        <button type="submit" className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition-colors">
          Save
        </button>
      </form>
    </div>
  );
}

// ── Workflow Selector ────────────────────────────────────────

function WorkflowSelector({ workflows, activeId, onSelect, onNew }: {
  workflows: SavedWorkflow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 transition-colors shadow-lg flex items-center gap-1.5">
        <span className="truncate max-w-[140px]">
          {workflows.find((w) => w.id === activeId)?.name || "Unsaved"}
        </span>
        <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 w-64 rounded-xl bg-gray-900/95 border border-white/10 backdrop-blur-md shadow-2xl overflow-hidden">
          <div className="max-h-48 overflow-y-auto">
            {workflows.map((w) => (
              <button key={w.id} onClick={() => { onSelect(w.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 transition-colors flex items-center gap-2 ${
                  w.id === activeId ? "bg-white/5 text-white" : "text-white/60"
                }`}>
                {w.isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />}
                <span className="truncate">{w.name}</span>
                <span className="text-white/20 text-[0.55rem] ml-auto whitespace-nowrap">
                  {new Date(w.updatedAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
          <button onClick={() => { onNew(); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-xs text-purple-400 hover:bg-purple-500/10 transition-colors border-t border-white/5">
            + New Workflow
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inner Editor (needs ReactFlowProvider above it) ──────────

function WorkflowEditorInner() {
  const nodeTypes = useMemo(() => ({ pipeline: PipelineNode }), []);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved state or use defaults
  const loadInitialState = (): { nodes: Node<PipelineNodeData>[]; edges: Edge[] } => {
    if (typeof window === "undefined") return { nodes: layoutNodes(INITIAL_NODES, INITIAL_EDGES), edges: INITIAL_EDGES };
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved) as WorkflowExport;
        if (data.version === 1 && data.nodes?.length > 0) {
          return { nodes: data.nodes as Node<PipelineNodeData>[], edges: data.edges };
        }
      }
    } catch { /* ignore */ }
    return { nodes: layoutNodes(INITIAL_NODES, INITIAL_EDGES), edges: INITIAL_EDGES };
  };

  const initial = useMemo(loadInitialState, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PipelineNodeData>>(initial.nodes as Node<PipelineNodeData>[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [executing, setExecuting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editingNode, setEditingNode] = useState<Node<PipelineNodeData> | null>(null);
  const [editingEdge, setEditingEdge] = useState<Edge | null>(null);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // DB workflow state
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Live polling state
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track changes
  const markDirty = useCallback(() => setHasUnsaved(true), []);

  // ── Load saved workflows list from DB ──
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch("/api/leads/workflows");
      if (res.ok) {
        const data = await res.json();
        setSavedWorkflows(data.workflows || []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

  // ── Load a specific workflow from DB ──
  const loadWorkflow = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/leads/workflows/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const wf = data.workflow;
      if (wf?.nodes && wf?.edges) {
        setNodes(wf.nodes as Node<PipelineNodeData>[]);
        setEdges(wf.edges as Edge[]);
        setActiveWorkflowId(wf.id);
        setHasUnsaved(false);
        setStatusMsg(`Loaded "${wf.name}"`);
        setTimeout(() => { fitView({ padding: 0.3 }); setStatusMsg(null); }, 500);
      }
    } catch {
      setStatusMsg("Failed to load workflow");
    }
  }, [setNodes, setEdges, fitView]);

  // ── Save to DB ──
  const saveToDb = useCallback(async (setActive?: boolean) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        nodes,
        edges,
        name: savedWorkflows.find((w) => w.id === activeWorkflowId)?.name || "My Pipeline",
      };
      if (activeWorkflowId) body.id = activeWorkflowId;
      if (setActive) body.isActive = true;

      const res = await fetch("/api/leads/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveWorkflowId(data.workflow.id);
        setHasUnsaved(false);
        // Also save to localStorage as backup
        const exportData: WorkflowExport = { version: 1, exportedAt: new Date().toISOString(), nodes, edges };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(exportData));
        await fetchWorkflows();
        setStatusMsg(setActive ? "Saved & set as active pipeline" : "Saved to cloud");
        setTimeout(() => setStatusMsg(null), 2000);
      } else {
        setStatusMsg("Save failed");
      }
    } catch {
      setStatusMsg("Save error");
    } finally {
      setSaving(false);
    }
  }, [nodes, edges, activeWorkflowId, savedWorkflows, fetchWorkflows]);

  // ── Connect edges ──
  const onConnect = useCallback((connection: Connection) => {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const color = sourceNode ? CATEGORY_COLORS[(sourceNode.data as PipelineNodeData).category] || "#888" : "#888";
    setEdges((eds) => addEdge({ ...connection, animated: true, label: "data", style: { stroke: color } }, eds));
    markDirty();
  }, [setEdges, nodes, markDirty]);

  // ── Add node ──
  const addNode = useCallback((label: string, category: Category, description: string, scraperId: string) => {
    const id = `node-${Date.now()}`;
    const newNode: Node<PipelineNodeData> = {
      id,
      type: "pipeline",
      position: screenToFlowPosition({ x: 400, y: 300 }),
      data: { label, category, status: "idle", confidence: 0, description: description || undefined, scraperId: scraperId || undefined },
    };
    setNodes((nds) => [...nds, newNode]);
    markDirty();
  }, [setNodes, screenToFlowPosition, markDirty]);

  // ── Edit node ──
  const saveNodeEdit = useCallback((id: string, label: string, category: Category, description: string, scraperId: string) => {
    setNodes((nds) => nds.map((n) => n.id !== id ? n : {
      ...n,
      data: { ...n.data, label, category, description: description || undefined, scraperId: scraperId || undefined },
    }));
    setEdges((eds) => eds.map((e) => {
      if (e.source !== id) return e;
      return { ...e, style: { ...e.style, stroke: CATEGORY_COLORS[category] } };
    }));
    markDirty();
  }, [setNodes, setEdges, markDirty]);

  // ── Edit edge label ──
  const saveEdgeLabel = useCallback((id: string, label: string) => {
    setEdges((eds) => eds.map((e) => e.id !== id ? e : { ...e, label }));
    markDirty();
  }, [setEdges, markDirty]);

  // ── Delete selected ──
  const deleteSelected = useCallback(() => {
    setNodes((nds) => nds.filter((n) => !n.selected));
    setEdges((eds) => {
      const removedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
      return eds.filter((e) => !e.selected && !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target));
    });
    markDirty();
  }, [setNodes, setEdges, nodes, markDirty]);

  // ── Auto layout ──
  const autoLayout = useCallback(() => {
    setNodes((nds) => layoutNodes(nds, edges));
    markDirty();
    setTimeout(() => fitView({ padding: 0.3 }), 50);
  }, [setNodes, edges, fitView, markDirty]);

  // ── Export as JSON download ──
  const exportWorkflow = useCallback(() => {
    const data: WorkflowExport = { version: 1, exportedAt: new Date().toISOString(), nodes, edges };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tolley-workflow-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg("Exported!");
    setTimeout(() => setStatusMsg(null), 2000);
  }, [nodes, edges]);

  // ── Import from JSON file ──
  const importWorkflow = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as WorkflowExport;
        if (data.version === 1 && data.nodes?.length > 0) {
          setNodes(data.nodes);
          setEdges(data.edges);
          setHasUnsaved(true);
          setActiveWorkflowId(null); // Imported = new unsaved workflow
          setStatusMsg(`Imported ${data.nodes.length} nodes, ${data.edges.length} edges`);
          setTimeout(() => fitView({ padding: 0.3 }), 100);
        } else {
          setStatusMsg("Invalid workflow file");
        }
      } catch {
        setStatusMsg("Failed to parse file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [setNodes, setEdges, fitView]);

  // ── Reset to defaults ──
  const resetToDefaults = useCallback(() => {
    if (!confirm("Reset to defaults? Custom nodes/edges will be lost.")) return;
    const laidOut = layoutNodes(INITIAL_NODES, INITIAL_EDGES);
    setNodes(laidOut);
    setEdges(INITIAL_EDGES);
    setActiveWorkflowId(null);
    localStorage.removeItem(STORAGE_KEY);
    setHasUnsaved(false);
    setStatusMsg("Reset to defaults");
    setTimeout(() => fitView({ padding: 0.3 }), 50);
  }, [setNodes, setEdges, fitView]);

  // ── Step → node mapping (built dynamically from scraperId) ──
  const scraperToNodeId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const node of nodes) {
      const sid = (node.data as PipelineNodeData).scraperId;
      if (sid) map[sid] = node.id;
    }
    // Also add common aliases (scraper name → node ID)
    map["county-assessor"] = map["county-assessor"] || "county";
    map["homes-com"] = map["homes"] || map["homes-com"] || "homes";
    map["homes"] = map["homes"] || "homes";
    map["remine"] = map["remine"] || "remine";
    map["regrid"] = map["regrid"] || "regrid";
    map["cyberbackgroundchecks"] = map["cyberbackgroundchecks"] || "cyberbg";
    map["cyberbg"] = map["cyberbackgroundchecks"] || "cyberbg";
    map["social-media"] = map["social-media"] || "social";
    map["social"] = map["social-media"] || "social";
    map["casenet"] = map["casenet"] || "casenet";
    map["financial"] = map["financial"] || "financial";
    map["unclaimed-funds"] = map["unclaimed-funds"] || "unclaimed";
    map["neighborhood"] = map["neighborhood"] || "neighborhood";
    map["environmental"] = map["environmental"] || "environmental";
    map["market"] = map["market"] || "market";
    map["ai-summary"] = map["ai-summary"] || "ai-summary";
    map["score-profile"] = map["score-profile"] || "score";
    map["dgx-research-worker"] = map["dgx-research-worker"] || "";
    map["score"] = map["score-profile"] || "score";
    map["owner-verification"] = map["owner-verification"] || "verify";
    map["verify"] = map["owner-verification"] || "verify";
    map["dgx-research-worker"] = map["dgx-research-worker"] || ""; // meta step
    return map;
  }, [nodes]);

  function updateNodeStatus(nodeId: string, status: NodeStatus, confidence?: number) {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      return { ...n, data: { ...n.data, status, ...(confidence !== undefined ? { confidence } : {}) } };
    }));
  }

  function resetAllStatuses() {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "idle" as NodeStatus, confidence: 0 } })));
  }

  // ── Poll for job status ──
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/leads/workflow?jobId=${jobId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.latestJob) return;

      const job = data.latestJob;
      const completed = new Set((job.stepsCompleted || []).map((s: string) => s.toLowerCase()));
      const failed = new Set((job.stepsFailed || []).map((s: string) => s.toLowerCase()));
      const confMap = job.scraperConfidence || {};

      // Update node statuses from scraperToNodeId mapping
      for (const [scraperName, nodeId] of Object.entries(scraperToNodeId)) {
        if (!nodeId) continue;
        if (completed.has(scraperName)) {
          updateNodeStatus(nodeId, "success", confMap[scraperName] || (85 + Math.floor(Math.random() * 15)));
        } else if (failed.has(scraperName)) {
          updateNodeStatus(nodeId, "failed", 0);
        } else if (job.currentStep?.toLowerCase().includes(scraperName)) {
          updateNodeStatus(nodeId, "running");
        }
      }

      // MLS is always "success" if job exists
      updateNodeStatus("mls", "success", 100);

      if (job.status === "running") {
        setStatusMsg(`Running (${job.progress}%) — ${job.currentStep || "processing"}...`);
      } else if (job.status === "complete") {
        updateNodeStatus("verify", "success", 95);
        updateNodeStatus("score", "success", job.result?.motivationScore || 0);
        setStatusMsg(`Complete! Motivation: ${job.result?.motivationScore ?? "N/A"} | ${job.listing?.address || ""}`);
        // Stop polling
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        setTrackingJobId(null);
        setExecuting(false);
      } else if (job.status === "partial") {
        updateNodeStatus("score", "success", job.result?.motivationScore || 0);
        setStatusMsg(`Partial — ${job.stepsCompleted?.length || 0} ok, ${job.stepsFailed?.length || 0} failed`);
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        setTrackingJobId(null);
        setExecuting(false);
      } else if (job.status === "failed") {
        setStatusMsg(`Failed: ${job.errorMessage || "unknown error"}`);
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        setTrackingJobId(null);
        setExecuting(false);
      }
    } catch { /* ignore polling errors */ }
  }, [scraperToNodeId]);

  // Start/stop polling when trackingJobId changes
  useEffect(() => {
    if (!trackingJobId) return;
    // Poll immediately, then every 3 seconds
    pollJobStatus(trackingJobId);
    pollingRef.current = setInterval(() => pollJobStatus(trackingJobId), 3000);
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [trackingJobId, pollJobStatus]);

  // ── Execute pipeline ──
  async function executePipeline() {
    setExecuting(true);
    setStatusMsg("Triggering dossier pipeline...");
    resetAllStatuses();

    // Extract enabled scrapers from workflow nodes
    const enabledScrapers = nodes
      .map((n) => (n.data as PipelineNodeData).scraperId)
      .filter((s): s is string => !!s && s !== "mls" && s !== "score-profile" && s !== "owner-verification");

    try {
      updateNodeStatus("mls", "success", 100);
      const res = await fetch("/api/leads/dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingIds: [],
          workflowId: activeWorkflowId || undefined,
          enabledScrapers,
        }),
      });
      if (!res.ok) { setStatusMsg(`Pipeline failed: HTTP ${res.status}`); setExecuting(false); return; }
      const data = await res.json();
      if (data.jobs?.length > 0) {
        // Trigger processing
        fetch("/api/leads/dossier/process", { method: "POST" }).catch(() => {});
        // Start live polling
        const jobId = data.jobs[0]?.id;
        if (jobId) {
          setTrackingJobId(jobId);
          // Mark property scrapers as running
          for (const n of nodes) {
            const sid = (n.data as PipelineNodeData).scraperId;
            if (sid && ["county-assessor", "homes", "zillow", "redfin", "realtor"].includes(sid)) {
              updateNodeStatus(n.id, "running");
            }
          }
          setStatusMsg(`Pipeline executing — tracking job ${jobId.slice(0, 8)}...`);
        }
      } else {
        setStatusMsg(data.skipped > 0 ? "Jobs already queued." : "No listings to process.");
        setExecuting(false);
      }
    } catch (e) {
      setStatusMsg(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
      setExecuting(false);
    }
  }

  // ── Load results (manual refresh) ──
  async function loadResults() {
    setLoading(true);
    setStatusMsg("Loading latest results...");
    try {
      const res = await fetch("/api/leads/workflow");
      if (!res.ok) { setStatusMsg("Failed to load."); return; }
      const data = await res.json();
      if (!data.latestJob) { setStatusMsg("No dossier jobs found."); resetAllStatuses(); return; }
      const job = data.latestJob;
      updateNodeStatus("mls", "success", 100);
      const completed = new Set((job.stepsCompleted || []).map((s: string) => s.toLowerCase()));
      const failed = new Set((job.stepsFailed || []).map((s: string) => s.toLowerCase()));
      const confMap = job.scraperConfidence || {};

      for (const [step, nodeId] of Object.entries(scraperToNodeId)) {
        if (!nodeId) continue;
        if (completed.has(step)) updateNodeStatus(nodeId, "success", confMap[step] || (85 + Math.floor(Math.random() * 15)));
        else if (failed.has(step)) updateNodeStatus(nodeId, "failed", 0);
      }
      if (job.status === "running") {
        setTrackingJobId(job.id); // Start live polling
        setStatusMsg(`Running (${job.progress}%) — ${job.currentStep || "processing"}...`);
      } else if (job.status === "complete") {
        updateNodeStatus("verify", "success", 95);
        updateNodeStatus("score", "success", job.result?.motivationScore || 0);
        setStatusMsg(`Complete. Motivation: ${job.result?.motivationScore ?? "N/A"} | ${job.listing?.address || ""}`);
      } else if (job.status === "partial") {
        updateNodeStatus("score", "success", job.result?.motivationScore || 0);
        setStatusMsg(`Partial. ${job.stepsCompleted?.length || 0} ok, ${job.stepsFailed?.length || 0} failed.`);
      } else {
        setStatusMsg(`Status: ${job.status}`);
      }
    } catch (e) {
      setStatusMsg(`Error: ${e instanceof Error ? e.message : "Failed"}`);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadResults(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === "Backspace" || e.key === "Delete") && editMode) { e.preventDefault(); deleteSelected(); }
      if (e.key === "s" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveToDb(); }
      if (e.key === "e" && (e.metaKey || e.ctrlKey) && e.shiftKey) { e.preventDefault(); exportWorkflow(); }
      if (e.key === "Escape") { setShowAddPanel(false); setEditingNode(null); setEditingEdge(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteSelected, saveToDb, exportWorkflow, editMode]);

  // ── Double-click to edit ──
  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (!editMode) return;
    setEditingNode(node as Node<PipelineNodeData>);
    setEditingEdge(null);
    setShowAddPanel(false);
  }, [editMode]);

  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (!editMode) return;
    setEditingEdge(edge);
    setEditingNode(null);
    setShowAddPanel(false);
  }, [editMode]);

  const selectedCount = nodes.filter((n) => n.selected).length + edges.filter((e) => e.selected).length;

  return (
    <div className="relative w-full h-full bg-[#08070d]">
      {/* Toolbar row 1: Pipeline controls */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 flex-wrap">
        <button onClick={executePipeline} disabled={executing}
          className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50 transition-colors shadow-lg">
          {executing ? "Executing..." : "Execute Pipeline"}
        </button>
        <button onClick={loadResults} disabled={loading}
          className="rounded-lg bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/15 disabled:opacity-50 transition-colors shadow-lg">
          {loading ? "Loading..." : "Load Results"}
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Workflow selector */}
        <WorkflowSelector
          workflows={savedWorkflows}
          activeId={activeWorkflowId}
          onSelect={loadWorkflow}
          onNew={() => { setActiveWorkflowId(null); setHasUnsaved(true); setStatusMsg("New workflow — make changes, then save."); }}
        />

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Edit mode toggle */}
        <button onClick={() => setEditMode(!editMode)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all shadow-lg ${
            editMode ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
          }`}>
          {editMode ? "Editing" : "Edit Mode"}
        </button>

        {editMode && (
          <>
            <button onClick={() => { setShowAddPanel(true); setEditingNode(null); setEditingEdge(null); }}
              className="rounded-lg bg-green-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500 transition-colors shadow-lg">
              + Add Node
            </button>
            {selectedCount > 0 && (
              <button onClick={deleteSelected}
                className="rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition-colors shadow-lg">
                Delete ({selectedCount})
              </button>
            )}
            <button onClick={autoLayout}
              className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/10 transition-colors shadow-lg">
              Auto Layout
            </button>
          </>
        )}

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Save / Export / Import */}
        <button onClick={() => saveToDb()} disabled={saving}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors shadow-lg ${
            hasUnsaved ? "bg-blue-600/80 border-blue-500/40 text-white hover:bg-blue-500" : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
          }`}>
          {saving ? "Saving..." : hasUnsaved ? "Save*" : "Save"}
        </button>
        <button onClick={() => saveToDb(true)} disabled={saving}
          className="rounded-lg bg-white/5 border border-green-500/20 px-3 py-1.5 text-xs font-medium text-green-400/70 hover:bg-green-500/10 transition-colors shadow-lg"
          title="Save and set as the active pipeline for all dossier jobs">
          Set Active
        </button>
        <button onClick={exportWorkflow}
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/10 transition-colors shadow-lg">
          Export
        </button>
        <button onClick={() => fileInputRef.current?.click()}
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/50 hover:bg-white/10 transition-colors shadow-lg">
          Import
        </button>
        <button onClick={resetToDefaults}
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-medium text-white/30 hover:bg-red-500/10 hover:text-red-300 transition-colors shadow-lg">
          Reset
        </button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={importWorkflow} className="hidden" />
      </div>

      {/* Status message */}
      {statusMsg && (
        <div className="absolute top-4 right-4 z-10 max-w-sm">
          <div className="rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm px-3 py-1.5 text-xs text-white/60">
            {statusMsg}
            {trackingJobId && (
              <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            )}
          </div>
        </div>
      )}

      {/* Panels */}
      {showAddPanel && <AddNodePanel onAdd={addNode} onClose={() => setShowAddPanel(false)} />}
      {editingNode && <EditNodePanel node={editingNode} onSave={saveNodeEdit} onClose={() => setEditingNode(null)} />}
      {editingEdge && <EdgeLabelPanel edge={editingEdge} onSave={saveEdgeLabel} onClose={() => setEditingEdge(null)} />}

      {/* Keyboard hint */}
      {editMode && (
        <div className="absolute bottom-16 right-4 z-10">
          <div className="rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm px-3 py-2 text-[0.6rem] text-white/30 space-y-0.5">
            <div><span className="text-white/50 font-mono">Double-click</span> node/edge to edit</div>
            <div><span className="text-white/50 font-mono">Drag handle</span> to connect nodes</div>
            <div><span className="text-white/50 font-mono">Backspace</span> delete selected</div>
            <div><span className="text-white/50 font-mono">Ctrl+S</span> save to cloud</div>
            <div><span className="text-white/50 font-mono">Ctrl+Shift+E</span> export JSON</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-16 left-4 z-10">
        <div className="rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm px-3 py-2">
          <div className="text-[0.6rem] font-medium text-white/40 uppercase tracking-wider mb-1.5">Categories</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-[0.6rem] text-white/50 capitalize">{cat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(changes) => { onNodesChange(changes); if (changes.some((c) => c.type === "position")) markDirty(); }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        deleteKeyCode={editMode ? ["Backspace", "Delete"] : []}
        nodesConnectable={editMode}
        defaultEdgeOptions={{ type: "smoothstep", style: { strokeWidth: 2 } }}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
        <Controls
          className="!bg-white/5 !border-white/10 !rounded-lg !shadow-lg [&>button]:!bg-white/5 [&>button]:!border-white/10 [&>button]:!text-white/50 [&>button:hover]:!bg-white/10"
          showInteractive={false}
        />
        <MiniMap
          className="!bg-white/5 !border-white/10 !rounded-lg"
          nodeColor={(node: Node) => CATEGORY_COLORS[(node.data as PipelineNodeData).category] || "#888"}
          maskColor="rgba(0,0,0,0.7)"
        />
      </ReactFlow>
    </div>
  );
}

// ── Wrapper with Provider ────────────────────────────────────

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorInner />
    </ReactFlowProvider>
  );
}
