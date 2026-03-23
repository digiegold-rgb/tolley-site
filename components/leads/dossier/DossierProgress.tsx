"use client";

import type { DossierJob } from "./types";

export default function DossierProgress({
  job,
  isPolling,
}: {
  job: DossierJob;
  isPolling?: boolean;
}) {
  const l = job.listing;

  const phaseLabel =
    job.progress < 5
      ? "Assembling pre-loaded data..."
      : job.progress < 50
        ? "DGX deep research..."
        : job.progress < 95
          ? "Running local plugins..."
          : "Finalizing...";

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center">
      <h2 className="text-2xl font-bold mb-2">{l.address}</h2>
      <p className="text-white/40 mb-6">
        {l.city} {l.zip} | MLS# {l.mlsId}
      </p>

      <div className="max-w-md mx-auto mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <span className="text-lg font-bold tabular-nums text-blue-300">
            {job.progress}%
          </span>
        </div>
      </div>

      {job.currentStep && (
        <p className="text-blue-300 animate-pulse">{job.currentStep}</p>
      )}

      <p className="text-white/30 text-sm mt-4">
        {job.status === "queued"
          ? "Waiting in queue..."
          : `${phaseLabel} This may take 30-60 minutes`}
      </p>

      {isPolling ? (
        <p className="text-green-300 text-xs mt-6">Auto-refreshing...</p>
      ) : (
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
        >
          Refresh
        </button>
      )}
    </div>
  );
}
