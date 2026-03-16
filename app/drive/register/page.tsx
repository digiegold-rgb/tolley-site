"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VEHICLE_TYPES } from "@/lib/dispatch/constants";

export default function DriverRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    vehicleType: "pickup",
    vehicleDetails: "",
    maxWeightLbs: 500,
    homeZip: "",
    serviceRadiusMi: 30,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field: string, value: string | number) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/dispatch/driver/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      router.push("/drive/driver?registered=1");
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative z-10 min-h-screen py-12 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-extrabold text-white text-center mb-2">
          Driver Application
        </h1>
        <p className="text-center text-gray-400 mb-8">
          Free to join. We&apos;ll review and approve within 24 hours.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">
              Phone (for dispatch SMS)
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+1XXXXXXXXXX"
              required
              className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Vehicle Type
              </label>
              <select
                value={form.vehicleType}
                onChange={(e) => update("vehicleType", e.target.value)}
                className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              >
                {VEHICLE_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {v.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Max Weight (lbs)
              </label>
              <input
                type="number"
                value={form.maxWeightLbs}
                onChange={(e) =>
                  update("maxWeightLbs", parseInt(e.target.value) || 500)
                }
                className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-1">
              Vehicle Details (optional)
            </label>
            <input
              type="text"
              value={form.vehicleDetails}
              onChange={(e) => update("vehicleDetails", e.target.value)}
              placeholder="e.g. 2022 Honda Ridgeline"
              className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Home ZIP Code
              </label>
              <input
                type="text"
                value={form.homeZip}
                onChange={(e) => update("homeZip", e.target.value)}
                required
                maxLength={5}
                className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                Service Radius (mi)
              </label>
              <input
                type="number"
                value={form.serviceRadiusMi}
                onChange={(e) =>
                  update("serviceRadiusMi", parseInt(e.target.value) || 30)
                }
                className="w-full px-4 py-3 bg-gray-900/60 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

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
            {loading ? "Submitting..." : "Apply to Drive"}
          </button>
        </form>
      </div>
    </main>
  );
}
