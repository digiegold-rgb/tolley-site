"use client";

import { useState } from "react";

interface Props {
  simId: string;
  agentIdx: number;
  agent: {
    persona: string;
    tier: string;
    action: string;
    sentiment: string;
    confidence: number;
    reasoning: string;
    coalition: string | null;
    model_used: string;
  } | undefined;
  onClose: () => void;
}

export default function AgentInterrogation({ simId, agentIdx, agent, onClose }: Props) {
  const [question, setQuestion] = useState("Why did you make that decision?");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch(`/api/trading/simulations/${simId}/interrogate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentIdx, question }),
      });
      if (res.ok) {
        const data = await res.json();
        setResponse(data.response || "No response.");
      } else {
        setResponse("Failed to interrogate agent.");
      }
    } catch {
      setResponse("Error connecting to MiroFish.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="crypto-card max-w-lg w-full border-purple-500/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-white">
              Interrogate Agent #{agentIdx}
            </h3>
            {agent && (
              <p className="text-[10px] text-white/30 mt-0.5 truncate max-w-[300px]">
                {agent.persona}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/60 text-lg transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Agent stats */}
        {agent && (
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-[8px] text-white/30 uppercase">Action</div>
              <div className={`text-xs font-bold ${
                agent.sentiment === "bullish" ? "text-green-400" :
                agent.sentiment === "bearish" ? "text-red-400" : "text-white/40"
              }`}>
                {agent.action}
              </div>
            </div>
            <div className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-[8px] text-white/30 uppercase">Confidence</div>
              <div className="text-xs font-bold text-white/80">
                {((agent.confidence || 0) * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-[8px] text-white/30 uppercase">Tier</div>
              <div className={`text-xs font-bold ${
                agent.tier === "expert" ? "text-amber-400" :
                agent.tier === "bulk" ? "text-blue-400" : "text-white/30"
              }`}>
                {agent.tier}
              </div>
            </div>
            <div className="bg-white/5 rounded p-1.5 text-center">
              <div className="text-[8px] text-white/30 uppercase">Coalition</div>
              <div className={`text-xs font-bold ${
                agent.coalition === "bullish" ? "text-green-400" :
                agent.coalition === "bearish" ? "text-red-400" : "text-white/20"
              }`}>
                {agent.coalition || "none"}
              </div>
            </div>
          </div>
        )}

        {/* Current reasoning */}
        {agent?.reasoning && (
          <div className="mb-4 p-2 bg-white/5 rounded text-[10px] text-white/40">
            <span className="text-white/20 uppercase">Current reasoning:</span>{" "}
            {agent.reasoning}
          </div>
        )}

        {/* Question input */}
        <div className="mb-3">
          <label className="block text-[10px] text-white/30 uppercase mb-1">
            Ask this agent
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:border-purple-500/50 focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          />
        </div>

        {/* Ask button */}
        <button
          onClick={handleAsk}
          disabled={loading || !question.trim()}
          className="w-full px-4 py-2 text-xs font-medium bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-lg hover:bg-purple-500/40 transition-colors disabled:opacity-30 mb-3"
        >
          {loading ? "Thinking..." : "Ask Agent"}
        </button>

        {/* Response */}
        {response && (
          <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
            <div className="text-[10px] text-purple-400/60 uppercase mb-1">Agent Response</div>
            <div className="text-sm text-white/80 leading-relaxed">{response}</div>
          </div>
        )}
      </div>
    </div>
  );
}
