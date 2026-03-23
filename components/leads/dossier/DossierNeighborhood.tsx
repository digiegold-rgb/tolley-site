"use client";

import type { PluginOutput } from "./types";

export default function DossierNeighborhood({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const nb = pluginData["neighborhood"];
  if (!nb?.success) return null;

  const walkScore = nb.data.walkScore as number | undefined;
  const transitScore = nb.data.transitScore as number | undefined;

  return (
    <div className="space-y-3">
      {walkScore != null && (
        <div className="flex items-center gap-4">
          <div className="text-center">
            <span
              className={`text-2xl font-bold tabular-nums ${
                walkScore >= 70
                  ? "text-green-400"
                  : walkScore >= 50
                    ? "text-yellow-400"
                    : "text-red-400"
              }`}
            >
              {walkScore}
            </span>
            <div className="text-[0.6rem] text-white/30">WALK SCORE</div>
          </div>
          {transitScore != null && (
            <div className="text-center">
              <span className="text-2xl font-bold tabular-nums text-blue-400">
                {transitScore}
              </span>
              <div className="text-[0.6rem] text-white/30">TRANSIT</div>
            </div>
          )}
        </div>
      )}
      <div>
        <h4 className="text-xs font-medium text-white/50 mb-2">Research Links</h4>
        <div className="flex flex-wrap gap-2">
          {(nb.sources || []).map((s, i) => (
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
