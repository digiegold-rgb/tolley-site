"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalScans: number;
  completedScans: number;
  totalFunds: number;
  totalClaimableAmount: number;
  activeClaims: number;
  usage: { fundScanUsed: number; fundScanLimit: number };
}

interface ScanSummary {
  id: string;
  ownerName: string;
  status: string;
  totalFound: number;
  claimableAmount: number;
  createdAt: string;
  funds: {
    id: string;
    source: string;
    amount: number | null;
    ownerName: string;
    matchConfidence: number;
    claim?: { id: string; status: string } | null;
  }[];
}

export default function UnclaimedDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/unclaimed/stats").then((r) => r.json()),
      fetch("/api/unclaimed/scan?limit=10").then((r) => r.json()),
    ])
      .then(([statsData, scansData]) => {
        setStats(statsData);
        setScans(scansData.scans || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Scans"
            value={stats.totalScans}
          />
          <StatCard
            label="Funds Discovered"
            value={stats.totalFunds}
          />
          <StatCard
            label="Claimable Amount"
            value={`$${stats.totalClaimableAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            highlight
          />
          <StatCard
            label="Active Claims"
            value={stats.activeClaims}
          />
        </div>
      )}

      {/* Usage bar */}
      {stats && stats.usage.fundScanLimit > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Monthly Scan Usage</span>
            <span className="font-medium">
              {stats.usage.fundScanUsed} / {stats.usage.fundScanLimit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{
                width: `${Math.min(
                  (stats.usage.fundScanUsed / stats.usage.fundScanLimit) * 100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Link
          href="/leads/unclaimed/scan"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          New Scan
        </Link>
      </div>

      {/* Recent Scans */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          Recent Scans
        </h3>
        {scans.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            <p>No scans yet. Start your first unclaimed funds search.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {scans.map((scan) => (
              <Link
                key={scan.id}
                href={`/leads/unclaimed/scan/${scan.id}`}
                className="block bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900">
                      {scan.ownerName}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {new Date(scan.createdAt).toLocaleDateString()}{" "}
                      {new Date(scan.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {scan.totalFound > 0 && (
                      <span className="text-sm text-green-700 font-medium">
                        {scan.totalFound} found &middot; $
                        {scan.claimableAmount.toLocaleString()}
                      </span>
                    )}
                    <StatusBadge status={scan.status} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p
        className={`text-2xl font-bold ${highlight ? "text-green-700" : "text-gray-900"}`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    running: "bg-blue-100 text-blue-700",
    complete: "bg-green-100 text-green-700",
    partial: "bg-yellow-100 text-yellow-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] || "bg-gray-100"}`}
    >
      {status}
    </span>
  );
}
