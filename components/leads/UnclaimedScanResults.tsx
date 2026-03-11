"use client";

import { useEffect, useState } from "react";
import UnclaimedFundCard from "./UnclaimedFundCard";

interface Fund {
  id: string;
  source: string;
  ownerName: string;
  amount: number | null;
  holderName: string | null;
  propertyType: string | null;
  matchConfidence: number;
  matchMethod: string | null;
  reportDate: string | null;
  state: string | null;
  claim?: { id: string; status: string } | null;
}

interface Scan {
  id: string;
  ownerName: string;
  alternateNames: string[];
  sources: string[];
  status: string;
  totalFound: number;
  claimableAmount: number;
  errorMessage: string | null;
  duration: number | null;
  createdAt: string;
  funds: Fund[];
}

export default function UnclaimedScanResults({ scanId }: { scanId: string }) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchScan = async () => {
    try {
      const res = await fetch(`/api/unclaimed/scan/${scanId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load scan");
        return;
      }
      setScan(data.scan);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScan();
    // Poll while running
    const interval = setInterval(() => {
      if (scan?.status === "running" || scan?.status === "pending") {
        fetchScan();
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId, scan?.status]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-500">Loading scan...</div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!scan) return null;

  const isRunning = scan.status === "running" || scan.status === "pending";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {scan.ownerName}
            </h2>
            {scan.alternateNames.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Also searched: {scan.alternateNames.join(", ")}
              </p>
            )}
          </div>
          <div className="text-right">
            <StatusBadge status={scan.status} />
            {scan.duration && (
              <p className="text-xs text-gray-400 mt-1">
                {(scan.duration / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {scan.totalFound}
            </p>
            <p className="text-xs text-gray-500">Records Found</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-700">
              ${scan.claimableAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500">Claimable Amount</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {scan.sources.length}
            </p>
            <p className="text-xs text-gray-500">Sources Searched</p>
          </div>
        </div>

        {scan.errorMessage && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-700">
            {scan.errorMessage}
          </div>
        )}
      </div>

      {/* Running indicator */}
      {isRunning && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="animate-pulse text-blue-700 font-medium">
            Scanning government databases...
          </div>
          <p className="text-sm text-blue-500 mt-1">
            This typically takes 30-90 seconds. Results appear automatically.
          </p>
        </div>
      )}

      {/* Fund cards */}
      {scan.funds.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Found Records ({scan.funds.length})
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {scan.funds.map((fund) => (
              <UnclaimedFundCard key={fund.id} fund={fund} />
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {!isRunning && scan.funds.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No unclaimed funds found</p>
          <p className="text-sm mt-1">
            Try searching with alternate name spellings or maiden names.
          </p>
        </div>
      )}

      {/* Registration banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>Note:</strong> Claiming unclaimed funds on behalf of others
        requires registration with the applicable State Treasurer. Missouri
        requires registration under RSMo 447.581. Claims workflow and owner
        outreach will be enabled after registration is confirmed.
      </div>
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
      className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || "bg-gray-100"}`}
    >
      {status === "running" ? "Scanning..." : status}
    </span>
  );
}
