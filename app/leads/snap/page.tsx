"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SnapCapture from "@/components/snap/SnapCapture";

interface SnapHistoryItem {
  id: string;
  photoUrl: string;
  resolvedAddress: string | null;
  resolvedCity: string | null;
  resolvedState: string | null;
  status: string;
  estimatedEquity: number | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-white/10 text-white/40",
  geocoding: "bg-blue-500/20 text-blue-300",
  geocoded: "bg-blue-500/20 text-blue-300",
  needs_address: "bg-yellow-500/20 text-yellow-300",
  researching: "bg-purple-500/20 text-purple-300",
  complete: "bg-green-500/20 text-green-300",
  failed: "bg-red-500/20 text-red-300",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function SnapPage() {
  const router = useRouter();
  const [history, setHistory] = useState<SnapHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/snap")
      .then((r) => r.json())
      .then((data) => setHistory(data.snaps || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSnapCreated = (snapId: string) => {
    router.push(`/leads/snap/${snapId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a
            href="/leads/dashboard"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Leads
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/dossier"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Dossiers
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/clients"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Clients
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/conversations"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Conversations
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/sequences"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Sequences
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/connects"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Connects
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/workflow"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Workflow
          </a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-purple-200 bg-purple-500/15">
            Snap & Know
          </span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Snap & Know</h1>
          <p className="text-white/40 text-sm mt-1">
            Photo a property. Get instant intel.
          </p>
        </div>

        {/* Capture Zone */}
        <SnapCapture onSnapCreated={handleSnapCreated} />

        {/* Recent Snaps */}
        <div className="mt-12">
          <h2 className="text-lg font-medium text-white/60 mb-4">Recent Lookups</h2>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-white/20 py-8">
              No lookups yet. Snap your first property above.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((snap) => (
                <a
                  key={snap.id}
                  href={`/leads/snap/${snap.id}`}
                  className="flex items-center gap-4 rounded-xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 transition-colors"
                >
                  {snap.photoUrl ? (
                    <img
                      src={snap.photoUrl}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">
                      {snap.resolvedAddress || "Address pending..."}
                    </p>
                    <p className="text-xs text-white/30">
                      {snap.resolvedCity && snap.resolvedState
                        ? `${snap.resolvedCity}, ${snap.resolvedState}`
                        : timeAgo(snap.createdAt)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        statusColors[snap.status] || statusColors.pending
                      }`}
                    >
                      {snap.status}
                    </span>
                    {snap.estimatedEquity !== null && snap.status === "complete" && (
                      <p className={`text-sm font-medium mt-1 ${
                        snap.estimatedEquity >= 0 ? "text-green-400" : "text-red-400"
                      }`}>
                        ${Math.round(snap.estimatedEquity / 1000)}K
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
