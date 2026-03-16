"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SavedLocation {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  isPickup: boolean;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [form, setForm] = useState({
    pickupAddress: "",
    dropoffAddress: "",
    cargoDescription: "",
    cargoWeightLbs: "",
    urgency: "standard",
    requiresTrailer: false,
    requiresTempControl: false,
    isFragile: false,
    pickupContactName: "",
    pickupContactPhone: "",
    pickupInstructions: "",
    dropoffContactName: "",
    dropoffContactPhone: "",
    dropoffInstructions: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dispatch/client/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.locations) setSavedLocations(data.locations);
        if (data.defaultPickupAddress) {
          setForm((f) => ({
            ...f,
            pickupAddress: data.defaultPickupAddress,
          }));
        }
      })
      .catch(() => {});
  }, []);

  function update(field: string, value: string | number | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function useSavedLocation(loc: SavedLocation) {
    if (loc.isPickup) {
      setForm((f) => ({ ...f, pickupAddress: loc.address }));
    } else {
      setForm((f) => ({ ...f, dropoffAddress: loc.address }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dispatch/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          cargoWeightLbs: form.cargoWeightLbs
            ? parseInt(form.cargoWeightLbs)
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create order");
        return;
      }

      router.push(`/drive/track/${data.orderNumber}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative z-10 min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">
          New Delivery Order
        </h1>

        {/* Saved locations */}
        {savedLocations.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-2">Saved Locations</p>
            <div className="flex flex-wrap gap-2">
              {savedLocations.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => useSavedLocation(loc)}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:border-red-500 transition-colors"
                >
                  {loc.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Addresses */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">
              Pickup Address *
            </label>
            <input
              type="text"
              value={form.pickupAddress}
              onChange={(e) => update("pickupAddress", e.target.value)}
              placeholder="Store name or full address"
              required
              className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">
              Dropoff Address *
            </label>
            <input
              type="text"
              value={form.dropoffAddress}
              onChange={(e) => update("dropoffAddress", e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          {/* Cargo */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">
              What are we delivering? *
            </label>
            <input
              type="text"
              value={form.cargoDescription}
              onChange={(e) => update("cargoDescription", e.target.value)}
              placeholder="e.g. 20 sheets of drywall, 2 pallets of tile"
              required
              className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Weight (lbs)
              </label>
              <input
                type="number"
                value={form.cargoWeightLbs}
                onChange={(e) => update("cargoWeightLbs", e.target.value)}
                placeholder="Optional"
                className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Urgency
              </label>
              <select
                value={form.urgency}
                onChange={(e) => update("urgency", e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              >
                <option value="standard">Standard</option>
                <option value="asap">ASAP (+35%)</option>
                <option value="scheduled">Scheduled (-5%)</option>
              </select>
            </div>
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requiresTrailer}
                onChange={(e) => update("requiresTrailer", e.target.checked)}
                className="accent-red-500"
              />
              Trailer (+$25)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requiresTempControl}
                onChange={(e) =>
                  update("requiresTempControl", e.target.checked)
                }
                className="accent-red-500"
              />
              Temp control (+$15)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isFragile}
                onChange={(e) => update("isFragile", e.target.checked)}
                className="accent-red-500"
              />
              Fragile (+$5)
            </label>
          </div>

          {/* Contact details (collapsible) */}
          <details className="bg-gray-900/40 border border-gray-700 rounded-lg p-4">
            <summary className="text-sm font-semibold text-gray-400 cursor-pointer">
              Contact & Instructions (optional)
            </summary>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={form.dropoffContactName}
                  onChange={(e) =>
                    update("dropoffContactName", e.target.value)
                  }
                  placeholder="Dropoff contact name"
                  className="px-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
                <input
                  type="tel"
                  value={form.dropoffContactPhone}
                  onChange={(e) =>
                    update("dropoffContactPhone", e.target.value)
                  }
                  placeholder="Dropoff phone"
                  className="px-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
              </div>
              <input
                type="text"
                value={form.dropoffInstructions}
                onChange={(e) =>
                  update("dropoffInstructions", e.target.value)
                }
                placeholder="Delivery instructions (gate code, loading dock, etc.)"
                className="w-full px-3 py-2 bg-gray-900/60 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </details>

          {error && (
            <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold text-lg rounded-lg transition-colors"
          >
            {loading ? "Creating Order..." : "Place Order"}
          </button>
        </form>
      </div>
    </main>
  );
}
