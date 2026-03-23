"use client";

import { useState, useEffect } from "react";
import { POOL_VOLUME_GAL, WATER_RANGES } from "@/lib/water";
import { calculateDosing, getDosingRecommendations, type DosingResult } from "@/lib/water-chemistry";

type DosingParam = "ph_down" | "ph_up" | "alkalinity" | "cya" | "salt" | "calciumHardness" | "freeChlorine" | "shock";

const CALC_OPTIONS: { value: DosingParam; label: string; hint: string }[] = [
  { value: "ph_down", label: "Lower pH (Muriatic Acid)", hint: "Current pH too high" },
  { value: "ph_up", label: "Raise pH (Soda Ash)", hint: "Current pH too low" },
  { value: "freeChlorine", label: "Raise Free Chlorine (Liquid)", hint: "FC too low" },
  { value: "shock", label: "Shock (Cal-Hypo)", hint: "SLAM or algae treatment" },
  { value: "alkalinity", label: "Raise Alkalinity (Baking Soda)", hint: "TA too low" },
  { value: "cya", label: "Raise CYA / Stabilizer", hint: "CYA too low" },
  { value: "salt", label: "Add Salt", hint: "Salt level too low" },
  { value: "calciumHardness", label: "Raise Calcium Hardness", hint: "CH too low" },
];

interface LatestReading {
  ph?: number | null;
  freeChlorine?: number | null;
  alkalinity?: number | null;
  cya?: number | null;
  salt?: number | null;
  calciumHardness?: number | null;
}

export function WaterCalculator() {
  const [param, setParam] = useState<DosingParam>("ph_down");
  const [current, setCurrent] = useState("");
  const [target, setTarget] = useState("");
  const [volume, setVolume] = useState(String(POOL_VOLUME_GAL));
  const [result, setResult] = useState<DosingResult | null>(null);
  const [latestReading, setLatestReading] = useState<LatestReading | null>(null);
  const [batchRecs, setBatchRecs] = useState<ReturnType<typeof getDosingRecommendations>>([]);

  // Load latest reading for batch mode
  useEffect(() => {
    fetch("/api/water/readings?limit=1")
      .then((r) => r.json())
      .then((data) => {
        if (data.readings?.[0]) {
          setLatestReading(data.readings[0]);
          const recs = getDosingRecommendations(data.readings[0], Number(volume) || POOL_VOLUME_GAL);
          setBatchRecs(recs);
        }
      })
      .catch(() => {});
  }, [volume]);

  function calc() {
    const c = parseFloat(current);
    const t = parseFloat(target);
    const v = parseFloat(volume) || POOL_VOLUME_GAL;
    if (isNaN(c) || isNaN(t)) return;
    const r = calculateDosing(param, c, t, v);
    setResult(r);
  }

  return (
    <div className="space-y-6">
      {/* Manual Calculator */}
      <div className="water-card space-y-4">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Dosing Calculator</h3>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-white/50">Chemical / Action</label>
            <select
              value={param}
              onChange={(e) => { setParam(e.target.value as DosingParam); setResult(null); }}
              className="water-select w-full"
            >
              {CALC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Current Value</label>
            <input
              type="number"
              step="0.1"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="water-input"
              placeholder="e.g. 7.8"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Target Value</label>
            <input
              type="number"
              step="0.1"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="water-input"
              placeholder="e.g. 7.4"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/50">Pool Volume (gal)</label>
            <input
              type="number"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="water-input"
            />
          </div>
        </div>

        <button onClick={calc} className="water-btn water-btn-primary">Calculate</button>

        {result && (
          <div className="rounded-lg border border-[#00e5c7]/20 bg-[#00e5c7]/5 p-4">
            <p className="text-lg font-bold text-[#00e5c7]">
              {result.amount} {result.unit} of {result.chemical}
            </p>
            <p className="mt-2 text-sm text-white/70">{result.instruction}</p>
          </div>
        )}
      </div>

      {/* Batch Recommendations */}
      {batchRecs.length > 0 && (
        <div className="water-card space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Auto-Recommendations (from latest reading)
          </h3>
          {batchRecs.map((rec, i) => (
            <div
              key={i}
              className={`rounded-lg border p-3 ${
                rec.priority === "high"
                  ? "border-red-500/20 bg-red-500/5"
                  : rec.priority === "medium"
                  ? "border-amber-500/20 bg-amber-500/5"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase ${
                  rec.priority === "high" ? "bg-red-500/20 text-red-400" :
                  rec.priority === "medium" ? "bg-amber-500/20 text-amber-400" :
                  "bg-white/10 text-white/40"
                }`}>
                  {rec.priority}
                </span>
                <span className="text-sm font-semibold text-white/80">{rec.param}</span>
              </div>
              <p className="mt-1.5 text-sm text-white/60">{rec.instruction}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
