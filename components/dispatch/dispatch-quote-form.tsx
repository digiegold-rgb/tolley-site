"use client";

import { useState } from "react";

interface QuoteResult {
  distanceMi: number;
  durationMin: number;
  basePrice: number;
  surcharges: { label: string; amount: number }[];
  subtotal: number;
  urgencyAdjustment: number;
  clientPrice: number;
  platformFee: number;
  driverPay: number;
  industryEstimate: number;
  clientSavings: number;
  driverBonusVsGig: number;
  pickupAddress: string;
  dropoffAddress: string;
}

export function DispatchQuoteForm() {
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [urgency, setUrgency] = useState<"standard" | "asap" | "scheduled">(
    "standard"
  );
  const [requiresTrailer, setRequiresTrailer] = useState(false);
  const [requiresTempControl, setRequiresTempControl] = useState(false);
  const [isFragile, setIsFragile] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setQuote(null);

    try {
      const res = await fetch("/api/dispatch/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupAddress,
          dropoffAddress,
          weightLbs: weightLbs ? parseInt(weightLbs) : undefined,
          urgency,
          requiresTrailer,
          requiresTempControl,
          isFragile,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to get quote");
        return;
      }

      setQuote(data);
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Addresses */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">
            Pickup Address
          </label>
          <input
            type="text"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            placeholder="e.g. Home Depot, 4400 SE Noland Rd, Independence MO"
            required
            className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-1">
            Dropoff Address
          </label>
          <input
            type="text"
            value={dropoffAddress}
            onChange={(e) => setDropoffAddress(e.target.value)}
            placeholder="e.g. 123 Oak St, Kansas City MO 64055"
            required
            className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
        </div>

        {/* Options row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">
              Weight (lbs)
            </label>
            <input
              type="number"
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
              placeholder="Optional"
              className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">
              Urgency
            </label>
            <select
              value={urgency}
              onChange={(e) =>
                setUrgency(e.target.value as "standard" | "asap" | "scheduled")
              }
              className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            >
              <option value="standard">Standard</option>
              <option value="asap">ASAP (+35%)</option>
              <option value="scheduled">Scheduled (-5%)</option>
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={requiresTrailer}
              onChange={(e) => setRequiresTrailer(e.target.checked)}
              className="accent-red-500"
            />
            Trailer needed (+$25)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={requiresTempControl}
              onChange={(e) => setRequiresTempControl(e.target.checked)}
              className="accent-red-500"
            />
            Temp control (+$15)
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isFragile}
              onChange={(e) => setIsFragile(e.target.checked)}
              className="accent-red-500"
            />
            Fragile (+$5)
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-bold text-lg rounded-lg transition-colors"
        >
          {loading ? "Calculating..." : "Get Instant Quote"}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-900/40 border border-red-700 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {quote && (
        <div className="mt-8 space-y-4">
          {/* Route info */}
          <div className="p-4 bg-gray-900/60 border border-gray-700 rounded-lg">
            <div className="text-sm text-gray-400">
              {quote.pickupAddress} → {quote.dropoffAddress}
            </div>
            <div className="flex gap-6 mt-2 text-lg font-semibold text-white">
              <span>{quote.distanceMi} mi</span>
              <span>~{quote.durationMin} min</span>
            </div>
          </div>

          {/* Your price */}
          <div className="p-6 bg-gradient-to-br from-red-900/40 to-gray-900/60 border border-red-700/50 rounded-xl">
            <div className="text-sm text-red-400 font-semibold uppercase tracking-wider">
              Your Price
            </div>
            <div className="text-4xl font-extrabold text-white mt-1">
              ${quote.clientPrice.toFixed(2)}
            </div>

            {/* Breakdown */}
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-300">
                <span>
                  Base ({quote.distanceMi} mi × $2.00)
                </span>
                <span>${quote.basePrice.toFixed(2)}</span>
              </div>
              {quote.surcharges.map((s, i) => (
                <div key={i} className="flex justify-between text-gray-300">
                  <span>{s.label}</span>
                  <span>+${s.amount.toFixed(2)}</span>
                </div>
              ))}
              {quote.urgencyAdjustment !== 0 && (
                <div className="flex justify-between text-gray-300">
                  <span>
                    {quote.urgencyAdjustment > 0
                      ? "ASAP rush"
                      : "Scheduled discount"}
                  </span>
                  <span>
                    {quote.urgencyAdjustment > 0 ? "+" : ""}$
                    {quote.urgencyAdjustment.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {/* Transparency */}
            <div className="mt-4 pt-4 border-t border-red-700/30 space-y-1 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Platform fee (18%)</span>
                <span>${quote.platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-400 font-semibold">
                <span>Driver receives</span>
                <span>${quote.driverPay.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Savings comparison */}
          <div className="p-4 bg-green-900/20 border border-green-700/40 rounded-lg">
            <div className="text-sm text-green-400 font-semibold">
              Industry comparison
            </div>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between text-gray-300">
                <span>Dispatch / Roadie / GoShare would charge</span>
                <span className="line-through text-gray-500">
                  ${quote.industryEstimate.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-green-400 font-bold text-lg">
                <span>You save</span>
                <span>${quote.clientSavings.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-green-400/70">
                <span>Driver earns more vs gig apps</span>
                <span>+${quote.driverBonusVsGig.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <a
            href="/lastmile/dashboard/order"
            className="block w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold text-lg rounded-lg text-center transition-colors"
          >
            Book This Delivery
          </a>
        </div>
      )}
    </div>
  );
}
