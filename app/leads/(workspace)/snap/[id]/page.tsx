"use client";

import { use } from "react";
import SnapResults from "@/components/snap/SnapResults";

export default function SnapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <a
            href="/leads/snap"
            className="flex items-center gap-1 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Snap & Know
          </a>
          <div className="flex gap-2">
            <a
              href="/leads/dashboard"
              className="rounded-lg bg-white/10 px-3 py-2 text-xs hover:bg-white/20"
            >
              Leads
            </a>
          </div>
        </div>

        <SnapResults snapId={id} />
      </div>
    </div>
  );
}
