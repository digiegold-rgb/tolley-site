"use client";

import type { PluginOutput } from "./types";

export default function DossierBusiness({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const biz = pluginData["business"];
  if (!biz?.success) return null;

  const entities =
    (biz.data.entities as
      | {
          ownerName: string;
          entityType: string | null;
          searchLinks: string[];
        }[]
      | undefined) || [];

  return (
    <div className="space-y-3">
      {entities.map((ent, i) => (
        <div key={i} className="rounded-lg bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-white/80">
              {ent.ownerName}
            </span>
            {ent.entityType && (
              <span className="text-xs rounded-full bg-purple-500/20 text-purple-300 px-2 py-0.5">
                {ent.entityType}
              </span>
            )}
          </div>
        </div>
      ))}
      {biz.warnings && biz.warnings.length > 0 && (
        <div className="text-xs text-yellow-300/60">
          {biz.warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
      <div>
        <h4 className="text-xs font-medium text-white/50 mb-2">
          Business Entity Research
        </h4>
        <div className="flex flex-wrap gap-2">
          {(biz.sources || []).map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10"
            >
              {s.label.length > 50 ? s.label.slice(0, 47) + "..." : s.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
