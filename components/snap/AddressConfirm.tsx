"use client";

import { useState } from "react";

interface AddressConfirmProps {
  snapId: string;
  detectedAddress?: {
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    county: string | null;
  } | null;
  onConfirmed: () => void;
}

export default function AddressConfirm({
  snapId,
  detectedAddress,
  onConfirmed,
}: AddressConfirmProps) {
  const [editing, setEditing] = useState(!detectedAddress);
  const [address, setAddress] = useState(detectedAddress?.address || "");
  const [city, setCity] = useState(detectedAddress?.city || "");
  const [state, setState] = useState(detectedAddress?.state || "MO");
  const [zip, setZip] = useState(detectedAddress?.zip || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!address.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/snap/${snapId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), city, state, zip }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to resolve address");
        return;
      }

      onConfirmed();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!editing && detectedAddress) {
    return (
      <div className="rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-white/40 mb-1">Detected Address</p>
            <p className="text-lg font-medium text-white/90">
              {detectedAddress.address}
            </p>
            <p className="text-sm text-white/50">
              {[detectedAddress.city, detectedAddress.state, detectedAddress.zip]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-purple-300/60 hover:text-purple-300 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-4 space-y-3">
      <p className="text-xs text-white/40">
        {detectedAddress ? "Correct the address:" : "Enter the property address:"}
      </p>
      <input
        type="text"
        placeholder="Street address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="w-full rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <input
          type="text"
          placeholder="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <input
          type="text"
          placeholder="ZIP"
          value={zip}
          onChange={(e) => setZip(e.target.value)}
          className="rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!address.trim() || submitting}
          className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Looking up..." : "Research This Property"}
        </button>
        {detectedAddress && (
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-300">{error}</p>
      )}
    </div>
  );
}
