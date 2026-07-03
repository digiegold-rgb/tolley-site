"use client";

import { useMemo, useState } from "react";

interface AgentState {
  idx: number;
  persona: string;
  tier: string;
  action: string;
  sentiment: string;
  confidence: number;
  reasoning: string;
  coalition: string | null;
  model_used: string;
  category: string;
  risk_tolerance: string;
  style: string;
}

interface Props {
  agents: AgentState[];
  onSelectAgent: (idx: number | null) => void;
  selectedAgent: number | null;
}

const SENTIMENT_COLORS = {
  bullish: { r: 34, g: 197, b: 94 },   // green
  bearish: { r: 239, g: 68, b: 68 },    // red
  neutral: { r: 148, g: 163, b: 184 },  // gray
};

const TIER_BORDERS = {
  expert: "border-amber-400/60",
  bulk: "border-blue-400/40",
  synthetic: "border-transparent",
};

export default function AgentGrid({ agents, onSelectAgent, selectedAgent }: Props) {
  const [hoveredAgent, setHoveredAgent] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>("all");

  // Compute grid dimensions
  const gridCols = useMemo(() => {
    const count = agents.length;
    if (count <= 100) return 10;
    if (count <= 400) return 20;
    if (count <= 1000) return 32;
    if (count <= 2000) return 45;
    return 64; // 4000 agents → 64 cols = ~63 rows
  }, [agents.length]);

  const cellSize = useMemo(() => {
    if (agents.length <= 100) return 20;
    if (agents.length <= 400) return 12;
    if (agents.length <= 1000) return 8;
    if (agents.length <= 2000) return 6;
    return 4; // 4K agents
  }, [agents.length]);

  // Filter agents
  const displayAgents = useMemo(() => {
    if (filter === "all") return agents;
    if (filter === "expert" || filter === "bulk" || filter === "synthetic") {
      return agents.filter((a) => a.tier === filter);
    }
    if (filter === "bullish" || filter === "bearish" || filter === "neutral") {
      return agents.filter((a) => a.sentiment === filter);
    }
    if (filter === "coalition") {
      return agents.filter((a) => a.coalition);
    }
    return agents;
  }, [agents, filter]);

  // Stats
  const stats = useMemo(() => {
    const total = agents.length || 1;
    const buys = agents.filter((a) => a.action === "BUY").length;
    const sells = agents.filter((a) => a.action === "SELL").length;
    const holds = total - buys - sells;
    const avgConf = agents.reduce((s, a) => s + (a.confidence || 0), 0) / total;
    return { total, buys, sells, holds, avgConf };
  }, [agents]);

  const getCellStyle = (agent: AgentState) => {
    const colors = SENTIMENT_COLORS[agent.sentiment as keyof typeof SENTIMENT_COLORS] || SENTIMENT_COLORS.neutral;
    const opacity = Math.max(0.15, Math.min(0.9, (agent.confidence || 0.3)));
    return {
      backgroundColor: `rgba(${colors.r}, ${colors.g}, ${colors.b}, ${opacity})`,
      width: cellSize,
      height: cellSize,
    };
  };

  const hovered = hoveredAgent !== null ? agents.find((a) => a.idx === hoveredAgent) : null;

  return (
    <div className="crypto-card">
      {/* Header with stats */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <h3 className="text-xs font-medium text-white/60 uppercase tracking-wider">
            Agent Swarm
          </h3>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-green-400">{stats.buys} BUY</span>
            <span className="text-red-400">{stats.sells} SELL</span>
            <span className="text-white/30">{stats.holds} HOLD</span>
            <span className="text-white/20">avg {(stats.avgConf * 100).toFixed(0)}% conf</span>
          </div>
        </div>
        <div className="flex gap-1">
          {["all", "expert", "bulk", "synthetic", "bullish", "bearish", "coalition"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-1.5 py-0.5 text-[8px] rounded uppercase transition-colors ${
                filter === f
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                  : "text-white/20 hover:text-white/40"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Agent grid */}
      {agents.length === 0 ? (
        <div className="text-center py-8 text-[10px] text-white/15">
          Waiting for agents...
        </div>
      ) : (
        <div
          className="relative overflow-hidden rounded-lg bg-black/20 p-1"
          style={{ minHeight: Math.min(400, Math.ceil(displayAgents.length / gridCols) * (cellSize + 1) + 8) }}
        >
          <div
            className="flex flex-wrap gap-px"
            style={{ maxWidth: gridCols * (cellSize + 1) }}
          >
            {displayAgents.map((agent) => (
              <div
                key={agent.idx}
                className={`cursor-pointer transition-all rounded-[1px] ${
                  agent.coalition ? "ring-1 ring-amber-400/40" : ""
                } ${selectedAgent === agent.idx ? "ring-2 ring-white" : ""} ${
                  TIER_BORDERS[agent.tier as keyof typeof TIER_BORDERS] || ""
                } ${agent.tier === "expert" ? "border border-amber-400/30" : ""}`}
                style={getCellStyle(agent)}
                onClick={() => onSelectAgent(agent.idx)}
                onMouseEnter={() => setHoveredAgent(agent.idx)}
                onMouseLeave={() => setHoveredAgent(null)}
              />
            ))}
          </div>

          {/* Hover tooltip */}
          {hovered && (
            <div className="absolute top-2 right-2 bg-black/90 border border-white/10 rounded-lg p-2 text-[10px] text-white/80 max-w-[200px] z-10 pointer-events-none">
              <div className="font-medium text-white mb-1 truncate">{hovered.persona}</div>
              <div className="space-y-0.5 text-white/50">
                <div>
                  <span className={
                    hovered.sentiment === "bullish" ? "text-green-400" :
                    hovered.sentiment === "bearish" ? "text-red-400" : "text-white/40"
                  }>
                    {hovered.action}
                  </span>
                  {" "}({(hovered.confidence * 100).toFixed(0)}%)
                </div>
                <div>Tier: {hovered.tier} | {hovered.model_used}</div>
                {hovered.coalition && <div className="text-amber-400">Coalition: {hovered.coalition}</div>}
                <div className="text-white/30 truncate">{hovered.reasoning}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[8px] text-white/20">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-green-500/60" />
          Bullish
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-red-500/60" />
          Bearish
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-gray-400/30" />
          Neutral
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm border border-amber-400/60" />
          Expert
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm ring-1 ring-amber-400/40" />
          Coalition
        </div>
        <div className="text-white/10">
          Opacity = confidence | Click to interrogate
        </div>
      </div>
    </div>
  );
}
