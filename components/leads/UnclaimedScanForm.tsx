"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AVAILABLE_SOURCES = [
  { id: "mo_unclaimed", label: "MO State Unclaimed Property", state: "MO" },
  { id: "mo_tax_surplus", label: "MO Tax Sale Surplus (Jackson Co.)", state: "MO" },
  { id: "ks_unclaimed", label: "KS State Unclaimed Property", state: "KS" },
];

interface Props {
  tier: string;
  fundScanUsed: number;
  fundScanLimit: number;
}

export default function UnclaimedScanForm({
  tier,
  fundScanUsed,
  fundScanLimit,
}: Props) {
  const router = useRouter();
  const [ownerName, setOwnerName] = useState("");
  const [alternateNames, setAlternateNames] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>(
    AVAILABLE_SOURCES.map((s) => s.id)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canScan = tier === "pro" || tier === "team";
  const atLimit = fundScanUsed >= fundScanLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/unclaimed/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          alternateNames: alternateNames
            .split("\n")
            .map((n) => n.trim())
            .filter(Boolean),
          sources: selectedSources,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || "Scan failed");
        return;
      }

      router.push(`/leads/unclaimed/scan/${data.scanId}`);
    } catch (e) {
      setError(`Network error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  if (!canScan) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
          Pro or Team Tier Required
        </h3>
        <p className="text-yellow-700 text-sm mb-4">
          Standalone unclaimed fund scans are available on Pro ($99/mo) and Team
          ($199/mo) tiers. Starter tier users can still see unclaimed funds
          discovered via dossier research.
        </p>
        <a
          href="/leads/pricing"
          className="inline-block px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
        >
          Upgrade Plan
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Owner Name *
        </label>
        <input
          type="text"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="John Smith"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Enter the property owner&apos;s full name as it would appear in
          government records
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Alternate Names (optional)
        </label>
        <textarea
          value={alternateNames}
          onChange={(e) => setAlternateNames(e.target.value)}
          placeholder={"J. Smith\nJohn A. Smith\nSmith, John"}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          One per line — maiden names, initials, name variations
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sources to Search
        </label>
        <div className="space-y-2">
          {AVAILABLE_SOURCES.map((source) => (
            <label
              key={source.id}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedSources.includes(source.id)}
                onChange={() => toggleSource(source.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{source.label}</span>
              <span className="text-xs text-gray-400">({source.state})</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">
          {fundScanUsed}/{fundScanLimit} scans used this month
        </span>
        <button
          type="submit"
          disabled={loading || atLimit || selectedSources.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {loading
            ? "Scanning..."
            : atLimit
              ? "Monthly Limit Reached"
              : "Start Scan"}
        </button>
      </div>
    </form>
  );
}
