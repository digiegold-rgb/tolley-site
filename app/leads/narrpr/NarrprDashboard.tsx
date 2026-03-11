"use client";

import { useState, useEffect } from "react";

interface ImportRecord {
  id: string;
  importType: string;
  address: string;
  city?: string;
  zip?: string;
  status: string;
  matchedListingId: string | null;
  matchConfidence: number | null;
  ownerName: string | null;
  createdAt: string;
  mergedAt: string | null;
}

interface Stats {
  totalImports: number;
  matched: number;
  unmatched: number;
  merged: number;
  pending: number;
  matchRate: number;
  mergeRate: number;
  recentImports: ImportRecord[];
}

export default function NarrprDashboard({ syncKey }: { syncKey: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leads/narrpr/status?key=${syncKey}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [syncKey]);

  if (loading) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <p className="text-sm text-white/30">Loading import stats...</p>
      </div>
    );
  }

  if (!stats || stats.totalImports === 0) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <p className="text-sm text-white/40">No NARRPR imports yet. Upload a CSV or use the bookmarklet.</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    merged: "text-green-400",
    matched: "text-blue-400",
    unmatched: "text-yellow-400",
    staged: "text-purple-400",
    pending: "text-white/40",
  };

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-sm font-medium text-white/60 mb-4">Import Statistics</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg bg-white/[0.03] p-3 text-center">
            <span className="text-2xl font-bold text-white/80">{stats.totalImports}</span>
            <div className="text-[0.6rem] text-white/30">TOTAL</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 text-center">
            <span className="text-2xl font-bold text-green-400">{stats.merged}</span>
            <div className="text-[0.6rem] text-white/30">MERGED</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 text-center">
            <span className="text-2xl font-bold text-blue-400">{stats.matched}</span>
            <div className="text-[0.6rem] text-white/30">MATCHED</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 text-center">
            <span className="text-2xl font-bold text-yellow-400">{stats.unmatched}</span>
            <div className="text-[0.6rem] text-white/30">UNMATCHED</div>
          </div>
          <div className="rounded-lg bg-white/[0.03] p-3 text-center">
            <span className="text-2xl font-bold text-white/60">{stats.matchRate}%</span>
            <div className="text-[0.6rem] text-white/30">MATCH RATE</div>
          </div>
        </div>
      </div>

      {/* Recent imports */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-sm font-medium text-white/60 mb-4">Recent Imports</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Address</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Owner</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Type</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Status</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Match</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Date</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentImports.map((imp) => (
                <tr key={imp.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="py-2 px-3 text-white/80">{imp.address}</td>
                  <td className="py-2 px-3 text-white/60">{imp.ownerName || "—"}</td>
                  <td className="py-2 px-3">
                    <span className="text-xs rounded-full bg-white/10 text-white/50 px-2 py-0.5">
                      {imp.importType === "csv_bulk" ? "CSV" : imp.importType === "rich_detail" ? "Rich" : "Bookmarklet"}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-xs ${statusColors[imp.status] || "text-white/40"}`}>
                      {imp.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-xs text-white/40">
                    {imp.matchConfidence ? `${Math.round(imp.matchConfidence * 100)}%` : "—"}
                  </td>
                  <td className="py-2 px-3 text-xs text-white/30">
                    {new Date(imp.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
