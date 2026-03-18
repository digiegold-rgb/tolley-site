"use client";

import { useState, useEffect } from "react";

interface Simulation {
  id: string;
  simulationId: string;
  event: string;
  eventType: string;
  triggerType: string;
  status: string;
  agentCount: number;
  roundCount: number;
  currentRound: number;
  signals: any;
  report: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Props {
  initialSimulations: Simulation[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  extracting: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  cancelled: "bg-white/10 text-white/40 border-white/20",
};

const TRIGGER_ICONS: Record<string, string> = {
  manual: "\u270B",
  cron: "\u23F0",
  scheduled_date: "\uD83D\uDCC5",
  event_driven: "\u26A1",
};

export default function SimulationDashboard({ initialSimulations }: Props) {
  const [simulations, setSimulations] = useState<Simulation[]>(initialSimulations);
  const [showForm, setShowForm] = useState(false);
  const [formEvent, setFormEvent] = useState("");
  const [formAgents, setFormAgents] = useState(50);
  const [formRounds, setFormRounds] = useState(20);
  const [formScenario, setFormScenario] = useState("");
  const [formTargets, setFormTargets] = useState<string[]>(["crypto", "polymarket"]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string>("");
  const [mirofishOnline, setMirofishOnline] = useState(false);

  // Poll for updates
  useEffect(() => {
    const fetchSims = async () => {
      try {
        const res = await fetch("/api/trading/simulations");
        if (res.ok) {
          const data = await res.json();
          setSimulations(data.simulations || []);
        }
      } catch {}
    };

    // Check MiroFish health
    const checkHealth = async () => {
      try {
        const res = await fetch("/api/trading/simulations?limit=1");
        setMirofishOnline(res.ok);
      } catch {
        setMirofishOnline(false);
      }
    };

    fetchSims();
    checkHealth();
    const interval = setInterval(fetchSims, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
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
        setShowForm(false);
        setFormEvent("");
        setFormScenario("");
        // Refresh
        const listRes = await fetch("/api/trading/simulations");
        if (listRes.ok) setSimulations((await listRes.json()).simulations || []);
      }
    } catch {}
    setSubmitting(false);
  };

  const loadReport = async (simId: string) => {
    if (selectedReport === simId) {
      setSelectedReport(null);
      return;
    }
    setSelectedReport(simId);
    try {
      const res = await fetch(`/api/trading/simulations/${simId}/report`);
      if (res.ok) {
        const data = await res.json();
        setReportContent(data.report || "No report available.");
      }
    } catch {
      setReportContent("Failed to load report.");
    }
  };

  const toggleTarget = (t: string) => {
    setFormTargets((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const activeSims = simulations.filter((s) => ["running", "pending", "extracting"].includes(s.status));
  const completedSims = simulations.filter((s) => s.status === "completed");
  const otherSims = simulations.filter((s) => ["failed", "cancelled"].includes(s.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">MiroFish Simulations</h2>
          <p className="text-xs text-white/30">
            Multi-agent market scenario intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                mirofishOnline ? "bg-green-400 pulse-gold" : "bg-red-400/50"
              }`}
            />
            <span className="text-[10px] text-white/30">
              MiroFish {mirofishOnline ? "Online" : "Offline"}
            </span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-colors"
          >
            + New Simulation
          </button>
        </div>
      </div>

      {/* Manual trigger form */}
      {showForm && (
        <div className="crypto-card space-y-4">
          <h3 className="text-sm font-medium text-white">Trigger Manual Simulation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-white/30 uppercase mb-1">Event Name</label>
              <input
                type="text"
                value={formEvent}
                onChange={(e) => setFormEvent(e.target.value)}
                placeholder="e.g., Fed Rate Decision March 2026"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-white/30 uppercase mb-1">Agents</label>
                <input
                  type="number"
                  value={formAgents}
                  onChange={(e) => setFormAgents(parseInt(e.target.value) || 50)}
                  min={10}
                  max={200}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
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
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-white/30 uppercase mb-1">Scenario (optional)</label>
            <textarea
              value={formScenario}
              onChange={(e) => setFormScenario(e.target.value)}
              rows={2}
              placeholder="Describe the scenario for agents to consider..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-amber-500/50 focus:outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-white/30 uppercase mb-1">Target Engines</label>
            <div className="flex gap-2">
              {["crypto", "polymarket", "stocks_conservative", "stocks_aggressive"].map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTarget(t)}
                  className={`px-2 py-1 text-[10px] rounded-md border transition-colors ${
                    formTargets.includes(t)
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-white/5 text-white/30 border-white/10 hover:border-white/20"
                  }`}
                >
                  {t.replace("stocks_", "stocks ")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting || !formEvent.trim()}
              className="px-4 py-2 text-xs font-medium bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded-lg hover:bg-amber-500/40 transition-colors disabled:opacity-30"
            >
              {submitting ? "Launching..." : "Launch Simulation"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active simulations */}
      {activeSims.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">Active</h3>
          {activeSims.map((sim) => (
            <div key={sim.id} className="crypto-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{TRIGGER_ICONS[sim.triggerType] || "\u2699"}</span>
                  <span className="text-sm font-medium text-white">{sim.event}</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase border ${
                    STATUS_COLORS[sim.status] || STATUS_COLORS.pending
                  }`}
                >
                  {sim.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/30">
                <span>{sim.agentCount} agents</span>
                <span>Round {sim.currentRound}/{sim.roundCount}</span>
                <span>{sim.eventType}</span>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500/50 rounded-full transition-all duration-500"
                  style={{ width: `${(sim.currentRound / sim.roundCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed simulations with signals */}
      {completedSims.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Completed ({completedSims.length})
          </h3>
          {completedSims.map((sim) => {
            const signals = sim.signals?.signals || {};
            const consensus = sim.signals?.agent_consensus;
            const sentiment = sim.signals?.sentiment_distribution;

            return (
              <div key={sim.id} className="crypto-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{TRIGGER_ICONS[sim.triggerType] || "\u2699"}</span>
                    <span className="text-sm font-medium text-white">{sim.event}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase border ${STATUS_COLORS.completed}`}
                    >
                      completed
                    </span>
                    <button
                      onClick={() => loadReport(sim.simulationId)}
                      className="text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors"
                    >
                      {selectedReport === sim.simulationId ? "Hide" : "Report"}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-white/30 mb-3">
                  <span>{sim.agentCount} agents</span>
                  <span>{sim.roundCount} rounds</span>
                  {consensus != null && (
                    <span>Consensus: {(consensus * 100).toFixed(0)}%</span>
                  )}
                  {sentiment && (
                    <span
                      className={
                        sentiment.bullish > sentiment.bearish
                          ? "text-green-400/60"
                          : sentiment.bearish > sentiment.bullish
                          ? "text-red-400/60"
                          : "text-white/30"
                      }
                    >
                      {sentiment.bullish > sentiment.bearish
                        ? "Bullish"
                        : sentiment.bearish > sentiment.bullish
                        ? "Bearish"
                        : "Mixed"}
                    </span>
                  )}
                  {sim.completedAt && (
                    <span>{new Date(sim.completedAt).toLocaleDateString()}</span>
                  )}
                </div>

                {/* Signal cards */}
                {Object.keys(signals).length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(signals).map(([engine, signal]: [string, any]) => (
                      <div
                        key={engine}
                        className="bg-white/5 rounded-lg p-2 border border-white/5"
                      >
                        <div className="text-[10px] text-white/30 truncate">{engine.replace("stocks_", "")}</div>
                        <div
                          className={`text-xs font-semibold ${
                            signal.direction === "UP"
                              ? "text-green-400"
                              : signal.direction === "DOWN"
                              ? "text-red-400"
                              : "text-white/40"
                          }`}
                        >
                          {signal.direction || "N/A"}
                        </div>
                        <div className="text-[10px] text-white/20">
                          {signal.confidence != null
                            ? `${(signal.confidence * 100).toFixed(0)}% conf`
                            : ""}
                          {signal.magnitude ? ` / ${signal.magnitude}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Report viewer */}
                {selectedReport === sim.simulationId && reportContent && (
                  <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10 max-h-80 overflow-y-auto">
                    <pre className="text-xs text-white/60 whitespace-pre-wrap font-mono">
                      {reportContent}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Failed/cancelled */}
      {otherSims.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Other ({otherSims.length})
          </h3>
          {otherSims.slice(0, 5).map((sim) => (
            <div key={sim.id} className="crypto-card opacity-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/40">{sim.event}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase border ${
                    STATUS_COLORS[sim.status] || ""
                  }`}
                >
                  {sim.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {simulations.length === 0 && (
        <div className="crypto-card text-center py-12">
          <div className="text-4xl mb-3 opacity-20">{"\uD83D\uDC1F"}</div>
          <div className="text-sm text-white/30 mb-1">No simulations yet</div>
          <div className="text-xs text-white/15">
            Trigger a manual simulation or wait for scheduled events
          </div>
        </div>
      )}
    </div>
  );
}
