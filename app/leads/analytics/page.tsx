"use client";

import ROIDashboard from "@/components/leads/ROIDashboard";

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a href="/leads/dashboard" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Leads</a>
          <span className="text-white/20">/</span>
          <a href="/leads/dossier" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Dossiers</a>
          <span className="text-white/20">/</span>
          <a href="/leads/clients" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Clients</a>
          <span className="text-white/20">/</span>
          <a href="/leads/conversations" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Conversations</a>
          <span className="text-white/20">/</span>
          <a href="/leads/sequences" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Sequences</a>
          <span className="text-white/20">/</span>
          <a href="/leads/connects" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Connects</a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">Analytics</span>
          <span className="text-white/20">/</span>
          <a href="/leads/workflow" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">Workflow</a>
          <span className="text-white/20">/</span>
          <a href="/leads/snap" className="rounded-lg px-3 py-1.5 text-sm text-purple-300/70 hover:text-purple-200 hover:bg-purple-500/10 transition-colors">Snap & Know</a>
        </nav>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Analytics & ROI</h1>
          <p className="text-white/40 text-sm mt-1">
            Track your lead pipeline, SMS performance, and return on investment
          </p>
        </div>

        <ROIDashboard />
      </div>
    </div>
  );
}
