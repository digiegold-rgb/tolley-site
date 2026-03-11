"use client";

import { useState } from "react";
import { KC_FARM_AREAS, SPECIALTIES } from "@/lib/leads-subscription";

export default function OnboardForm({
  tier,
  existingZips,
  existingSpecialties,
}: {
  tier: string;
  existingZips?: string[];
  existingSpecialties?: string[];
}) {
  const [selectedZips, setSelectedZips] = useState<Set<string>>(
    new Set(existingZips || [])
  );
  const [selectedSpecialties, setSelectedSpecialties] = useState<Set<string>>(
    new Set(existingSpecialties || [])
  );
  const [customZip, setCustomZip] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleArea(zips: string[]) {
    setSelectedZips((prev) => {
      const next = new Set(prev);
      const allSelected = zips.every((z) => next.has(z));
      if (allSelected) {
        zips.forEach((z) => next.delete(z));
      } else {
        zips.forEach((z) => next.add(z));
      }
      return next;
    });
  }

  function toggleSpecialty(id: string) {
    setSelectedSpecialties((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addCustomZip() {
    const zip = customZip.trim();
    if (/^\d{5}$/.test(zip)) {
      setSelectedZips((prev) => new Set(prev).add(zip));
      setCustomZip("");
    }
  }

  async function handleSubmit() {
    if (selectedZips.size === 0) {
      alert("Select at least one area or zip code.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/leads/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmZips: Array.from(selectedZips),
          farmCities: [],
          specialties: Array.from(selectedSpecialties),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        window.location.href = "/leads/dashboard";
      } else {
        alert(data.error || "Failed to save. Try again.");
      }
    } catch {
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Tier badge */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-purple-500/20 border border-purple-500/30 px-3 py-1 text-xs font-medium text-purple-300 capitalize">
          {tier} Plan
        </span>
      </div>

      {/* Farm areas */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">
          Select Your Farm Areas
        </h3>
        <div className="grid gap-2">
          {Object.entries(KC_FARM_AREAS).map(([area, zips]) => {
            const count = zips.filter((z) => selectedZips.has(z)).length;
            const allSelected = count === zips.length;

            return (
              <button
                key={area}
                onClick={() => toggleArea(zips)}
                className={`flex items-center justify-between rounded-lg px-4 py-3 text-left text-sm transition-colors ${
                  allSelected
                    ? "bg-purple-500/20 border border-purple-500/40 text-white"
                    : count > 0
                      ? "bg-purple-500/10 border border-purple-500/20 text-white/80"
                      : "bg-white/[0.03] border border-white/10 text-white/60 hover:bg-white/[0.06]"
                }`}
              >
                <span>{area}</span>
                <span className="text-xs text-white/40">
                  {count}/{zips.length} zips
                </span>
              </button>
            );
          })}
        </div>

        {/* Custom zip */}
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={customZip}
            onChange={(e) => setCustomZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="Add custom zip..."
            className="flex-1 rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
            onKeyDown={(e) => e.key === "Enter" && addCustomZip()}
          />
          <button
            onClick={addCustomZip}
            className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/20"
          >
            Add
          </button>
        </div>

        {/* Selected zips display */}
        {selectedZips.size > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Array.from(selectedZips).sort().map((zip) => (
              <span
                key={zip}
                className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300"
              >
                {zip}
                <button
                  onClick={() =>
                    setSelectedZips((prev) => {
                      const next = new Set(prev);
                      next.delete(zip);
                      return next;
                    })
                  }
                  className="text-purple-300/50 hover:text-purple-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Specialties */}
      <div>
        <h3 className="text-sm font-medium text-white mb-3">
          Specialties <span className="text-white/30">(optional)</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleSpecialty(s.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedSpecialties.has(s.id)
                  ? "bg-purple-500/20 border border-purple-500/40 text-purple-200"
                  : "bg-white/[0.03] border border-white/10 text-white/50 hover:bg-white/[0.06]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading || selectedZips.size === 0}
        className={`w-full rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
          loading || selectedZips.size === 0
            ? "bg-white/10 text-white/30 cursor-not-allowed"
            : "bg-purple-600 text-white hover:bg-purple-500"
        }`}
      >
        {loading ? "Saving..." : `Start Receiving Leads (${selectedZips.size} zips selected)`}
      </button>
    </div>
  );
}
