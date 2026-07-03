"use client";

import { useState } from "react";

interface Props {
  simId: string;
  maxRound: number;
  onClose: () => void;
}

export default function CounterfactualPanel({ simId, maxRound, onClose }: Props) {
  const [forkRound, setForkRound] = useState(Math.max(1, Math.floor(maxRound / 2)));
  const [counterfactual, setCounterfactual] = useState("");
  const [forking, setForking] = useState(false);
  const [result, setResult] = useState<{ fork_id?: string; error?: string } | null>(null);

  const handleFork = async () => {
    if (!counterfactual.trim()) return;
    setForking(true);
    setResult(null);

    try {
      const res = await fetch(`/api/trading/simulations/${simId}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forkAtRound: forkRound,
          counterfactual,
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Failed to connect to MiroFish" });
    }
    setForking(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="crypto-card max-w-md w-full border-cyan-500/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white flex items-center gap-2">
            <span className="text-cyan-400">&#x21C0;</span>
            Fork Simulation
          </h3>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 text-lg transition-colors"
          >
            &times;
          </button>
        </div>

        <p className="text-[10px] text-white/30 mb-4">
          Create an alternate reality: fork the simulation at a specific round with
          a &quot;what if&quot; scenario. The fork runs independently with the same agents.
        </p>

        {/* Fork at round */}
        <div className="mb-3">
          <label className="block text-[10px] text-white/30 uppercase mb-1">
            Fork at Round ({maxRound} available)
          </label>
          <input
            type="range"
            min={1}
            max={maxRound}
            value={forkRound}
            onChange={(e) => setForkRound(parseInt(e.target.value))}
            className="w-full accent-cyan-500"
          />
          <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
            <span>Round 1</span>
            <span className="text-cyan-400 font-mono">Round {forkRound}</span>
            <span>Round {maxRound}</span>
          </div>
        </div>

        {/* Counterfactual scenario */}
        <div className="mb-4">
          <label className="block text-[10px] text-white/30 uppercase mb-1">
            What If...
          </label>
          <textarea
            value={counterfactual}
            onChange={(e) => setCounterfactual(e.target.value)}
            rows={3}
            placeholder="e.g., What if the Fed raised rates by 100bps instead?"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-cyan-500/50 focus:outline-none resize-none"
          />
        </div>

        {/* Fork button */}
        <button
          onClick={handleFork}
          disabled={forking || !counterfactual.trim()}
          className="w-full px-4 py-2 text-xs font-medium bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg hover:bg-cyan-500/40 transition-colors disabled:opacity-30"
        >
          {forking ? "Forking..." : "Create Alternate Reality"}
        </button>

        {/* Result */}
        {result && (
          <div className={`mt-3 p-2 rounded-lg text-[10px] ${
            result.error
              ? "bg-red-500/10 border border-red-500/20 text-red-400"
              : "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
          }`}>
            {result.error ? (
              result.error
            ) : (
              <div>
                Fork created: <span className="font-mono">{result.fork_id}</span>
                <br />
                <span className="text-white/30">
                  Select it from the simulation bar above to watch it run.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
