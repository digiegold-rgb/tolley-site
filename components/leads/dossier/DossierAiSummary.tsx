"use client";

import type { PluginOutput } from "./types";

export default function DossierAiSummary({
  pluginData,
}: {
  pluginData: Record<string, PluginOutput>;
}) {
  const ai = pluginData["ai-summary"];
  if (!ai?.success) return null;

  const keyFindings = (ai.data.keyFindings as string[] | undefined) || [];
  const actionItems = (ai.data.actionItems as string[] | undefined) || [];
  const totalDataPoints = (ai.data.totalDataPoints as number) || 0;
  const pluginsRun = (ai.data.pluginsRun as number) || 0;
  const avgPluginConfidence = (ai.data.avgPluginConfidence as number) || 0;

  return (
    <div className="space-y-3">
      {keyFindings.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-white/50 mb-2">Key Findings</h4>
          <div className="space-y-1">
            {keyFindings.map((f, i) => (
              <p
                key={i}
                className="text-sm text-white/70 flex items-start gap-2"
              >
                <span className="text-blue-400 mt-0.5 shrink-0">*</span>
                {f}
              </p>
            ))}
          </div>
        </div>
      )}
      {actionItems.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-orange-300/70 mb-2">
            Action Items
          </h4>
          <div className="space-y-1">
            {actionItems.map((a, i) => (
              <p
                key={i}
                className="text-sm text-orange-200/80 flex items-start gap-2"
              >
                <span className="text-orange-400 mt-0.5 shrink-0">!</span>
                {a}
              </p>
            ))}
          </div>
        </div>
      )}
      <div className="text-xs text-white/20 mt-2 flex gap-4">
        <span>Data points: {totalDataPoints}</span>
        <span>Plugins: {pluginsRun}</span>
        <span>Avg confidence: {Math.round(avgPluginConfidence * 100)}%</span>
      </div>
    </div>
  );
}
