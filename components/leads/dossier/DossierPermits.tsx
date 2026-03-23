"use client";

import type { PluginOutput } from "./types";

export default function DossierPermits({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const permits = pluginData["permits"];
  if (!permits?.success) return null;

  const matchedCity = permits.data.matchedCity as string | undefined;

  return (
    <div className="space-y-3">
      {matchedCity && (
        <p className="text-xs text-green-300/60">
          Matched city portal for {matchedCity}
        </p>
      )}
      <div>
        <h4 className="text-xs font-medium text-white/50 mb-2">
          Permit & Code Enforcement Links
        </h4>
        <div className="flex flex-wrap gap-2">
          {(permits.sources || []).map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10"
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
