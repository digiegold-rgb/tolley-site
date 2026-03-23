"use client";

import type { PluginOutput } from "./types";

export default function DossierDeepSocial({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const sd = pluginData["social-deep"];
  if (!sd?.success || (sd.sources || []).length === 0) return null;

  const arrestSearchLinks =
    (sd.data.arrestSearchLinks as string[] | undefined) || [];
  const backgroundSearchLinks =
    (sd.data.backgroundSearchLinks as string[] | undefined) || [];
  const socialDeepLinks =
    (sd.data.socialDeepLinks as string[] | undefined) || [];

  return (
    <div className="space-y-3">
      {arrestSearchLinks.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-red-300/70 mb-2">
            Arrest & Court Records
          </h4>
          <div className="flex flex-wrap gap-2">
            {(sd.sources || [])
              .filter(
                (s) =>
                  s.type === "search" ||
                  s.type === "court" ||
                  s.type === "government"
              )
              .map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                >
                  {s.label.length > 40 ? s.label.slice(0, 37) + "..." : s.label}
                </a>
              ))}
          </div>
        </div>
      )}
      {backgroundSearchLinks.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-white/50 mb-2">
            Background Check Services
          </h4>
          <div className="flex flex-wrap gap-2">
            {(sd.sources || [])
              .filter((s) => s.type === "commercial")
              .map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10"
                >
                  {s.label.length > 40 ? s.label.slice(0, 37) + "..." : s.label}
                </a>
              ))}
          </div>
        </div>
      )}
      {socialDeepLinks.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-white/50 mb-2">
            Social Media Deep Search
          </h4>
          <div className="flex flex-wrap gap-2">
            {(sd.sources || [])
              .filter((s) => s.type === "social")
              .map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-white/[0.05] border border-white/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-white/10"
                >
                  {s.label.length > 40 ? s.label.slice(0, 37) + "..." : s.label}
                </a>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
