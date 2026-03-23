"use client";

import { useState } from "react";
import { WATER_RANGES, type WaterParam } from "@/lib/water";
import { calculateLSI } from "@/lib/water-chemistry";

const FIELDS: { key: WaterParam; step: string }[] = [
  { key: "ph", step: "0.1" },
  { key: "freeChlorine", step: "0.1" },
  { key: "totalChlorine", step: "0.1" },
  { key: "alkalinity", step: "1" },
  { key: "cya", step: "1" },
  { key: "calciumHardness", step: "1" },
  { key: "salt", step: "10" },
  { key: "temperature", step: "1" },
  { key: "tds", step: "10" },
  { key: "phosphates", step: "10" },
];

interface Props {
  onSaved?: () => void;
}

export function WaterReadingForm({ onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [readingAt, setReadingAt] = useState(new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key: string, val: string) => setValues((v) => ({ ...v, [key]: val }));

  // Live LSI
  const ph = parseFloat(values.ph || "");
  const temp = parseFloat(values.temperature || "");
  const ch = parseFloat(values.calciumHardness || "");
  const alk = parseFloat(values.alkalinity || "");
  const tds = parseFloat(values.tds || "") || 1000;
  const canCalcLSI = !isNaN(ph) && !isNaN(temp) && !isNaN(ch) && !isNaN(alk);
  const lsi = canCalcLSI ? calculateLSI({ ph, temperature: temp, calciumHardness: ch, alkalinity: alk, tds }) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    const payload: Record<string, unknown> = { notes, readingAt };
    for (const f of FIELDS) {
      const v = values[f.key];
      if (v && v !== "") payload[f.key] = parseFloat(v);
    }

    try {
      const res = await fetch("/api/water/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setValues({});
        setNotes("");
        setSuccess(true);
        onSaved?.();
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="water-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">New Reading</h3>
        {lsi !== null && (
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            Math.abs(lsi) <= 0.3 ? "bg-emerald-500/15 text-emerald-400" :
            Math.abs(lsi) <= 0.5 ? "bg-amber-500/15 text-amber-400" :
            "bg-red-500/15 text-red-400"
          }`}>
            LSI: {lsi}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {FIELDS.map((f) => {
          const range = WATER_RANGES[f.key];
          return (
            <div key={f.key}>
              <label className="mb-1 block text-xs text-white/50">{range.label}</label>
              <input
                type="number"
                step={f.step}
                value={values[f.key] || ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={`${range.min}–${range.max}`}
                className="water-input"
              />
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-white/50">Date/Time</label>
          <input
            type="datetime-local"
            value={readingAt}
            onChange={(e) => setReadingAt(e.target.value)}
            className="water-input"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-white/50">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            className="water-input"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="water-btn water-btn-primary">
          {saving ? "Saving..." : "Save Reading"}
        </button>
        {success && <span className="text-sm text-emerald-400">Saved!</span>}
      </div>
    </form>
  );
}
