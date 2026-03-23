"use client";

import type { PluginOutput } from "./types";

export default function DossierEnvironmental({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const env = pluginData["environmental"];
  if (!env?.success) return null;

  const floodZone = env.data.floodZone as string | undefined;
  const floodZoneDesc = env.data.floodZoneDesc as string | undefined;
  const isHighRisk =
    floodZone?.startsWith("A") || floodZone?.startsWith("V");

  return (
    <div className="space-y-3">
      {floodZone ? (
        <div
          className={`rounded-lg p-3 ${
            isHighRisk
              ? "bg-red-500/10 border border-red-500/20"
              : "bg-green-500/10 border border-green-500/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-xl font-bold ${
                isHighRisk ? "text-red-400" : "text-green-400"
              }`}
            >
              Zone {floodZone}
            </span>
            <span className="text-xs text-white/50">FEMA Flood Zone</span>
          </div>
          {floodZoneDesc && (
            <p className="text-xs text-white/40 mt-1">{floodZoneDesc}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/40">
          Flood zone data not available via API — check FEMA link below.
        </p>
      )}
      <div>
        <h4 className="text-xs font-medium text-white/50 mb-2">
          Environmental Research
        </h4>
        <div className="flex flex-wrap gap-2">
          {(env.sources || []).map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10"
            >
              {s.label.replace(/ — .*/, "")}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
