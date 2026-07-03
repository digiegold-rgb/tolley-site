"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import AgentGrid from "./AgentGrid";
import ConsensusDrift from "./ConsensusDrift";
import AgentInterrogation from "./AgentInterrogation";
import CounterfactualPanel from "./CounterfactualPanel";

interface SSEEvent {
  id: string;
  event: string;
  data: any;
  timestamp: number;
}

interface Simulation {
  id: string;
  simulationId?: string;
  event: string;
  status: string;
  agentCount: number;
  roundCount: number;
  currentRound: number;
  eventType?: string;
  triggerType?: string;
}

interface RoundData {
  round: number;
  buys: number;
  sells: number;
  holds: number;
  bullish_pct: number;
  bearish_pct: number;
  neutral_pct: number;
  consensus?: string;
}

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

const TARGET_OPTIONS = ["crypto", "polymarket", "stocks_conservative", "stocks_aggressive"];

export default function GodModeDashboard() {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [activeSim, setActiveSim] = useState<string | null>(null);
  const [roundHistory, setRoundHistory] = useState<RoundData[]>([]);
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [eventFeed, setEventFeed] = useState<SSEEvent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [showCounterfactual, setShowCounterfactual] = useState(false);
  const [tierDist, setTierDist] = useState<Record<string, number>>({});
  const [coalitions, setCoalitions] = useState<any[]>([]);
  const [debates, setDebates] = useState<any[]>([]);
  const [mirofishOnline, setMirofishOnline] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [simStatus, setSimStatus] = useState<string>("idle");
  const eventSourceRef = useRef<EventSource | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formEvent, setFormEvent] = useState("");
  const [formAgents, setFormAgents] = useState(1000);
  const [formRounds, setFormRounds] = useState(20);
  const [formScenario, setFormScenario] = useState("");
  const [formTargets, setFormTargets] = useState<string[]>(["crypto", "polymarket"]);
  const [submitting, setSubmitting] = useState(false);

  // Injection form
  const [injectionText, setInjectionText] = useState("");

  // Poll for sims list
  useEffect(() => {
    const fetchSims = async () => {
      try {
        const res = await fetch("/api/trading/simulations?limit=20");
        if (res.ok) {
          const data = await res.json();
          setSimulations(data.simulations || []);
          setMirofishOnline(true);
        } else {
          setMirofishOnline(false);
        }
      } catch {
        setMirofishOnline(false);
      }
    };
    fetchSims();
    const interval = setInterval(fetchSims, 10000);
    return () => clearInterval(interval);
  }, []);

  // SSE connection for active sim
  const connectSSE = useCallback((simId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setRoundHistory([]);
    setEventFeed([]);
    setCoalitions([]);
    setDebates([]);
    setAgents([]);
    setCurrentRound(0);
    setSimStatus("connecting");

    const es = new EventSource(`/api/trading/simulations/${simId}/stream`);
    eventSourceRef.current = es;

    const handleEvent = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const event: SSEEvent = {
          id: e.lastEventId || String(Date.now()),
          event: (e as any).type || "message",
          data,
          timestamp: Date.now(),
        };

        setEventFeed((prev) => [...prev.slice(-200), event]);

        switch (event.event) {
          case "sim_start":
            setSimStatus("running");
            setTotalRounds(data.round_count || 20);
            break;
          case "round_start":
            setCurrentRound(data.round);
            break;
          case "round_complete":
            setRoundHistory((prev) => [...prev, data as RoundData]);
            setCurrentRound(data.round);
            break;
          case "agent_batch":
            // Refresh agent states after batch
            fetchAgents(simId);
            break;
          case "tier_assignment":
            setTierDist(data.distribution || {});
            break;
          case "coalition_formed":
            setCoalitions(data.coalitions || []);
            break;
          case "debate":
            setDebates((prev) => [...prev, data]);
            break;
          case "sim_complete":
            setSimStatus("completed");
            break;
          case "sim_cancelled":
            setSimStatus("cancelled");
            break;
          case "sim_error":
            setSimStatus("error");
            break;
          case "fork_created":
            setEventFeed((prev) => [
              ...prev,
              { ...event, event: "fork_created", data: { ...data, message: `Fork created: ${data.fork_id}` } },
            ]);
            break;
        }
      } catch {
        // Ignore parse errors (keepalive comments)
      }
    };

    // Listen for all event types
    for (const type of [
      "sim_start", "round_start", "round_complete", "agent_batch",
      "tier_assignment", "coalition_formed", "debate", "extracting",
      "sim_complete", "sim_cancelled", "sim_error", "fork_created",
      "consensus_update", "injection",
    ]) {
      es.addEventListener(type, handleEvent);
    }

    es.onerror = () => {
      setSimStatus((prev) => (prev === "running" ? "reconnecting" : prev));
    };

    // Initial agent fetch
    fetchAgents(simId);
  }, []);

  const fetchAgents = async (simId: string) => {
    try {
      const res = await fetch(`/api/trading/simulations/${simId}/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch {}
  };

  // Watch for active sim
  useEffect(() => {
    if (activeSim) {
      connectSSE(activeSim);
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [activeSim, connectSSE]);

  // Auto-select running sim
  useEffect(() => {
    if (!activeSim) {
      const running = simulations.find((s) =>
        ["running", "pending", "extracting"].includes(s.status)
      );
      if (running) {
        setActiveSim(running.simulationId || running.id);
      }
    }
  }, [simulations, activeSim]);

  const handleCreateSim = async () => {
    if (!formEvent.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/trading/simulations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: formEvent,
          agentCount: formAgents,
          roundCount: formRounds,
          targets: formTargets,
          scenario: formScenario,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSim(data.id);
        setShowForm(false);
        setFormEvent("");
        setFormScenario("");
      }
    } catch {}
    setSubmitting(false);
  };

  const handleInject = async () => {
    if (!activeSim || !injectionText.trim()) return;
    try {
      await fetch(`/api/trading/simulations/${activeSim}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ injection: injectionText }),
      });
      setInjectionText("");
    } catch {}
  };

  const toggleTarget = (t: string) => {
    setFormTargets((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const activeSimData = simulations.find(
    (s) => (s.simulationId || s.id) === activeSim
  );

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-3">
            <span className="text-2xl">&#x1F9FF;</span>
            MiroFish God Mode
          </h1>
          <p className="text-xs text-white/30 mt-0.5">
            4,000-agent swarm visualization &bull; Real-time SSE &bull; Social dynamics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${mirofishOnline ? "bg-green-400 animate-pulse" : "bg-red-400/50"}`} />
            <span className="text-[10px] text-white/30">{mirofishOnline ? "Online" : "Offline"}</span>
          </div>
          {activeSim && simStatus === "running" && (
            <div className="text-[10px] text-blue-400/80 font-mono">
              Round {currentRound}/{totalRounds}
            </div>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors"
          >
            + New Swarm
          </button>
        </div>
      </div>

      {/* Create simulation form */}
      {showForm && (
        <div className="crypto-card space-y-3 border-purple-500/20">
          <h3 className="text-sm font-medium text-white">Launch Agent Swarm</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-[10px] text-white/30 uppercase mb-1">Event / Scenario</label>
              <input
                type="text"
                value={formEvent}
                onChange={(e) => setFormEvent(e.target.value)}
                placeholder="e.g., Fed cuts rates by 50bps unexpectedly"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-purple-500/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-white/30 uppercase mb-1">Agents</label>
                <input
                  type="number"
                  value={formAgents}
                  onChange={(e) => setFormAgents(parseInt(e.target.value) || 1000)}
                  min={50}
                  max={4000}
                  step={100}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-white/30 uppercase mb-1">Rounds</label>
                <input
                  type="number"
                  value={formRounds}
                  onChange={(e) => setFormRounds(parseInt(e.target.value) || 20)}
                  min={5}
                  max={50}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500/50 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-white/30 uppercase mb-1">Detailed Scenario (optional)</label>
            <textarea
              value={formScenario}
              onChange={(e) => setFormScenario(e.target.value)}
              rows={2}
              placeholder="Additional context for agents..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-purple-500/50 focus:outline-none resize-none"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              {TARGET_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTarget(t)}
                  className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                    formTargets.includes(t)
                      ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                      : "bg-white/5 text-white/30 border-white/10"
                  }`}
                >
                  {t.replace("stocks_", "")}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateSim}
                disabled={submitting || !formEvent.trim()}
                className="px-4 py-1.5 text-xs font-medium bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-lg hover:bg-purple-500/40 transition-colors disabled:opacity-30"
              >
                {submitting ? "Launching..." : `Launch ${formAgents.toLocaleString()} Agents`}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 text-xs text-white/30 hover:text-white/50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sim selector */}
      {simulations.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {simulations.slice(0, 10).map((sim) => {
            const simKey = sim.simulationId || sim.id;
            const isActive = simKey === activeSim;
            const isRunning = ["running", "pending", "extracting"].includes(sim.status);
            return (
              <button
                key={sim.id}
                onClick={() => setActiveSim(simKey)}
                className={`flex-shrink-0 px-3 py-1.5 text-[10px] rounded-lg border transition-all ${
                  isActive
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                    : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isRunning && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  )}
                  <span className="truncate max-w-[120px]">{sim.event}</span>
                  <span className="text-white/20">{sim.agentCount}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Main grid layout */}
      {activeSim ? (
        <div className="grid grid-cols-12 gap-4">
          {/* Left panel: Controls */}
          <div className="col-span-12 lg:col-span-2 space-y-3">
            {/* Status card */}
            <div className="crypto-card">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Status</div>
              <div className={`text-sm font-bold ${
                simStatus === "running" ? "text-blue-400" :
                simStatus === "completed" ? "text-green-400" :
                simStatus === "error" ? "text-red-400" : "text-white/40"
              }`}>
                {simStatus.charAt(0).toUpperCase() + simStatus.slice(1)}
              </div>
              {activeSimData && (
                <div className="mt-2 space-y-1 text-[10px] text-white/30">
                  <div>{activeSimData.agentCount.toLocaleString()} agents</div>
                  <div>{activeSimData.roundCount} rounds</div>
                  <div className="truncate">{activeSimData.event}</div>
                </div>
              )}
            </div>

            {/* Tier distribution */}
            {Object.keys(tierDist).length > 0 && (
              <div className="crypto-card">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Tiers</div>
                {Object.entries(tierDist).map(([tier, count]) => (
                  <div key={tier} className="flex items-center justify-between text-[10px] mb-1">
                    <span className={`${
                      tier === "expert" ? "text-amber-400" :
                      tier === "bulk" ? "text-blue-400" : "text-white/30"
                    }`}>
                      {tier}
                    </span>
                    <span className="text-white/50 font-mono">{count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Coalitions */}
            {coalitions.length > 0 && (
              <div className="crypto-card">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Coalitions</div>
                {coalitions.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] mb-1">
                    <span className={c.sentiment === "bullish" ? "text-green-400" : "text-red-400"}>
                      {c.sentiment}
                    </span>
                    <span className="text-white/50">{c.size} agents ({(c.strength * 100).toFixed(0)}%)</span>
                  </div>
                ))}
              </div>
            )}

            {/* Inject event */}
            {simStatus === "running" && (
              <div className="crypto-card">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Inject Event</div>
                <textarea
                  value={injectionText}
                  onChange={(e) => setInjectionText(e.target.value)}
                  rows={2}
                  placeholder="Breaking news..."
                  className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white placeholder-white/20 focus:border-purple-500/50 focus:outline-none resize-none mb-2"
                />
                <button
                  onClick={handleInject}
                  disabled={!injectionText.trim()}
                  className="w-full px-2 py-1 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 rounded hover:bg-red-500/30 disabled:opacity-30"
                >
                  Inject
                </button>
              </div>
            )}

            {/* Fork button */}
            {activeSim && roundHistory.length > 0 && (
              <button
                onClick={() => setShowCounterfactual(true)}
                className="w-full px-2 py-1.5 text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-500/20 transition-colors"
              >
                Fork / What If?
              </button>
            )}
          </div>

          {/* Center panel: Agent Grid */}
          <div className="col-span-12 lg:col-span-6">
            <AgentGrid
              agents={agents}
              onSelectAgent={setSelectedAgent}
              selectedAgent={selectedAgent}
            />
          </div>

          {/* Right panel: Charts + Feed */}
          <div className="col-span-12 lg:col-span-4 space-y-3">
            {/* Consensus drift chart */}
            <ConsensusDrift roundHistory={roundHistory} />

            {/* Debates */}
            {debates.length > 0 && (
              <div className="crypto-card max-h-48 overflow-y-auto">
                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                  Debates ({debates.length})
                </div>
                {debates.slice(-5).reverse().map((d, i) => (
                  <div key={i} className="text-[10px] mb-2 pb-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-white/50">R{d.round}</span>
                      <span className={d.winner === "bullish" ? "text-green-400" : "text-red-400"}>
                        {d.winner} wins
                      </span>
                    </div>
                    <div className="text-white/30">{d.summary}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Live event feed */}
            <div className="crypto-card max-h-64 overflow-y-auto">
              <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">
                Event Feed ({eventFeed.length})
              </div>
              {eventFeed.length === 0 ? (
                <div className="text-[10px] text-white/15 text-center py-4">
                  Waiting for events...
                </div>
              ) : (
                <div className="space-y-1">
                  {eventFeed.slice(-30).reverse().map((e) => (
                    <div key={e.id} className="text-[10px] flex items-start gap-2">
                      <span className={`flex-shrink-0 px-1 py-0.5 rounded text-[8px] uppercase font-bold ${
                        e.event === "round_complete" ? "bg-blue-500/20 text-blue-400" :
                        e.event === "coalition_formed" ? "bg-amber-500/20 text-amber-400" :
                        e.event === "debate" ? "bg-purple-500/20 text-purple-400" :
                        e.event === "sim_complete" ? "bg-green-500/20 text-green-400" :
                        e.event === "sim_error" ? "bg-red-500/20 text-red-400" :
                        "bg-white/5 text-white/30"
                      }`}>
                        {e.event.replace(/_/g, " ").slice(0, 12)}
                      </span>
                      <span className="text-white/40 truncate">
                        {typeof e.data === "object"
                          ? (e.data.consensus || e.data.summary || e.data.message || JSON.stringify(e.data).slice(0, 60))
                          : String(e.data).slice(0, 60)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="crypto-card text-center py-16">
          <div className="text-5xl mb-4 opacity-20">&#x1F9FF;</div>
          <div className="text-sm text-white/30 mb-1">No simulation selected</div>
          <div className="text-xs text-white/15 mb-4">
            Launch a swarm or select a running simulation above
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors"
          >
            Launch First Swarm
          </button>
        </div>
      )}

      {/* Agent interrogation modal */}
      {selectedAgent !== null && activeSim && (
        <AgentInterrogation
          simId={activeSim}
          agentIdx={selectedAgent}
          agent={agents[selectedAgent]}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* Counterfactual panel */}
      {showCounterfactual && activeSim && (
        <CounterfactualPanel
          simId={activeSim}
          maxRound={roundHistory.length}
          onClose={() => setShowCounterfactual(false)}
        />
      )}
    </div>
  );
}
