"use client";

import type { WaterReading, WaterParam } from "@/lib/water";
import { getStatus, getStatusColor, WATER_RANGES } from "@/lib/water";

interface Props {
  readings: WaterReading[];
  onDelete?: (id: string) => void;
}

const COLS: { key: WaterParam; label: string }[] = [
  { key: "ph", label: "pH" },
  { key: "freeChlorine", label: "FC" },
  { key: "alkalinity", label: "Alk" },
  { key: "cya", label: "CYA" },
  { key: "salt", label: "Salt" },
  { key: "calciumHardness", label: "CH" },
  { key: "temperature", label: "Temp" },
];

export function WaterReadingsTable({ readings, onDelete }: Props) {
  if (readings.length === 0) {
    return (
      <div className="water-card text-center text-sm text-white/30 py-8">
        No readings yet. Add your first reading above.
      </div>
    );
  }

  return (
    <div className="water-card overflow-x-auto">
      <table className="water-table">
        <thead>
          <tr>
            <th>Date</th>
            {COLS.map((c) => <th key={c.key}>{c.label}</th>)}
            <th>LSI</th>
            <th>Source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {readings.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap text-white/60">
                {new Date(r.readingAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                <span className="ml-1 text-white/30 text-xs">
                  {new Date(r.readingAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </td>
              {COLS.map((c) => {
                const val = r[c.key] as number | null;
                const status = getStatus(c.key, val);
                return (
                  <td key={c.key} style={{ color: val != null ? getStatusColor(status) : "rgba(255,255,255,0.2)" }}>
                    {val != null ? val : "—"}
                  </td>
                );
              })}
              <td className="text-white/60">{r.lsi != null ? r.lsi : "—"}</td>
              <td className="text-xs text-white/30">{r.source}</td>
              <td>
                {onDelete && (
                  <button
                    onClick={() => onDelete(r.id)}
                    className="text-xs text-red-400/50 hover:text-red-400"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
