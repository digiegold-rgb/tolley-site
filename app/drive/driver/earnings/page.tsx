"use client";

import { useEffect, useState } from "react";

interface Earning {
  id: string;
  amount: number;
  tip: number;
  total: number;
  status: string;
  createdAt: string;
  order: {
    orderNumber: string;
    pickupAddress: string;
    dropoffAddress: string;
    distanceMi: number | null;
    completedAt: string | null;
  };
}

interface Summary {
  totalEarned: number;
  totalTips: number;
  available: number;
  pending: number;
  deliveries: number;
}

export default function DriverEarningsPage() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [period, setPeriod] = useState("week");
  const [loading, setLoading] = useState(true);
  const [payingOut, setPayingOut] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dispatch/driver/earnings?period=${period}`)
      .then((r) => r.json())
      .then((data) => {
        setEarnings(data.earnings || []);
        setSummary(data.summary || null);
      })
      .finally(() => setLoading(false));
  }, [period]);

  async function requestPayout() {
    setPayingOut(true);
    try {
      const res = await fetch("/api/dispatch/driver/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "stripe_connect" }),
      });
      if (res.ok) {
        // Refresh earnings
        const data = await fetch(
          `/api/dispatch/driver/earnings?period=${period}`
        ).then((r) => r.json());
        setEarnings(data.earnings || []);
        setSummary(data.summary || null);
      }
    } finally {
      setPayingOut(false);
    }
  }

  return (
    <main className="relative z-10 min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Earnings</h1>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-green-900/30 to-gray-900/60 border border-green-700/40 rounded-xl">
              <div className="text-sm text-green-400">Available</div>
              <div className="text-2xl font-bold text-white">
                ${summary.available.toFixed(2)}
              </div>
              {summary.available > 0 && (
                <button
                  onClick={requestPayout}
                  disabled={payingOut}
                  className="mt-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white text-sm font-semibold rounded-lg"
                >
                  {payingOut ? "Processing..." : "Cash Out"}
                </button>
              )}
            </div>
            <div className="p-4 bg-gray-900/60 border border-gray-700 rounded-xl">
              <div className="text-sm text-gray-400">Total Earned</div>
              <div className="text-2xl font-bold text-white">
                ${summary.totalEarned.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {summary.deliveries} deliveries
              </div>
            </div>
          </div>
        )}

        {/* Period selector */}
        <div className="flex gap-2 mb-6">
          {["week", "month", "all"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                period === p
                  ? "bg-red-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {p === "all" ? "All Time" : p === "week" ? "This Week" : "This Month"}
            </button>
          ))}
        </div>

        {/* Earnings list */}
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : earnings.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No earnings for this period
          </div>
        ) : (
          <div className="space-y-3">
            {earnings.map((e) => (
              <div
                key={e.id}
                className="p-4 bg-gray-900/60 border border-gray-700 rounded-xl flex justify-between items-center"
              >
                <div>
                  <div className="text-sm font-mono text-gray-400">
                    {e.order.orderNumber}
                  </div>
                  <div className="text-sm text-gray-300 mt-1">
                    {e.order.distanceMi} mi
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(e.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-400">
                    ${e.total.toFixed(2)}
                  </div>
                  <div
                    className={`text-xs ${
                      e.status === "available"
                        ? "text-green-400"
                        : e.status === "paid_out"
                          ? "text-gray-500"
                          : "text-yellow-400"
                    }`}
                  >
                    {e.status.replace(/_/g, " ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
