import { requireAdminPageSession } from "@/lib/admin-auth";
import AiResearchPanel from "@/components/trading/AiResearchPanel";
import "../../crypto/crypto.css";

export const dynamic = "force-dynamic";

export default async function TradingAiResearchPage() {
  await requireAdminPageSession("/trading/ai-research");

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <nav className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-white/30 hover:text-white/50">tolley.io</a>
            <span className="text-white/10">/</span>
            <a href="/trading" className="text-xs text-white/40 hover:text-white/70">Trading</a>
            <span className="text-white/10">/</span>
            <span className="text-sm font-medium text-amber-400">AI Research</span>
          </div>
        </nav>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">
            <span className="text-amber-400">AI Research</span> · TradingAgents
          </h1>
          <p className="text-sm text-white/40">
            Multi-agent LLM debate framework (Tauric Research). Runs 4 analysts → bull/bear
            researchers → trader → risk team → portfolio manager. Local Qwen3.6 inference.
          </p>
        </div>

        <AiResearchPanel />

        <div className="mt-12 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-white/20">
            Research overlay only. Not wired into execution. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
