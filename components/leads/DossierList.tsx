"use client";

import { useState } from "react";

interface DossierJobSummary {
  id: string;
  status: string;
  progress: number;
  currentStep: string | null;
  stepsCompleted: string[];
  stepsFailed: string[];
  createdAt: string;
  completedAt: string | null;
  listing: {
    address: string;
    city: string | null;
    zip: string | null;
    listPrice: number | null;
    mlsId: string;
    photoUrls: string[];
  };
  result: {
    motivationScore: number | null;
    motivationFlags: string[];
    owners: unknown;
    entityType: string | null;
  } | null;
}

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-gray-500/20 text-gray-300",
  running: "bg-blue-500/20 text-blue-300 animate-pulse",
  complete: "bg-green-500/20 text-green-300",
  partial: "bg-yellow-500/20 text-yellow-300",
  failed: "bg-red-500/20 text-red-300",
  cancelled: "bg-white/10 text-white/30",
};

export default function DossierList({
  jobs,
  total,
  syncKey,
}: {
  jobs: DossierJobSummary[];
  total: number;
  syncKey: string;
}) {
  const [processing, setProcessing] = useState(false);

  async function processNext() {
    setProcessing(true);
    try {
      const res = await fetch("/api/leads/dossier/process?limit=1", {
        method: "POST",
        headers: { "x-sync-secret": syncKey },
      });
      if (res.ok) {
        // Reload to show updated status
        window.location.reload();
      } else {
        const err = await res.json();
        alert(err.error || "Process failed");
      }
    } finally {
      setProcessing(false);
    }
  }

  const queuedCount = jobs.filter((j) => j.status === "queued").length;

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-white/40">
          {total} dossier{total !== 1 ? "s" : ""} | {queuedCount} queued
        </p>
        {queuedCount > 0 && (
          <button
            onClick={processNext}
            disabled={processing}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-500 disabled:opacity-50"
          >
            {processing ? "Processing..." : `Process Next (${queuedCount} queued)`}
          </button>
        )}
      </div>

      {/* Job cards */}
      <div className="space-y-3">
        {jobs.map((job) => {
          const owners = (job.result?.owners || []) as { name: string; role: string }[];

          return (
            <a
              key={job.id}
              href={`/leads/dossier/${job.id}?key=${syncKey}`}
              className="block rounded-xl bg-white/5 border border-white/10 p-4 hover:bg-white/[0.08] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Property info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    {/* Motivation score */}
                    {job.result?.motivationScore != null && (
                      <div className="flex flex-col items-center min-w-[48px]">
                        <span
                          className={`text-2xl font-bold tabular-nums leading-none ${
                            job.result.motivationScore >= 60
                              ? "text-red-400"
                              : job.result.motivationScore >= 40
                                ? "text-orange-400"
                                : "text-yellow-400"
                          }`}
                        >
                          {job.result.motivationScore}
                        </span>
                        <span className="text-[0.55rem] text-white/30 mt-0.5">MOTIVE</span>
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-white">
                        {job.listing.address}
                      </h3>
                      <p className="text-xs text-white/40">
                        MLS# {job.listing.mlsId} | {job.listing.city} {job.listing.zip}
                        {job.listing.listPrice && ` | $${job.listing.listPrice.toLocaleString()}`}
                      </p>
                    </div>
                  </div>

                  {/* Owner names */}
                  {owners.length > 0 && (
                    <p className="mt-2 text-sm text-white/60">
                      Owner{owners.length > 1 ? "s" : ""}: {owners.map((o) => o.name).join(", ")}
                      {job.result?.entityType && job.result.entityType !== "individual" && (
                        <span className="text-white/30"> ({job.result.entityType})</span>
                      )}
                    </p>
                  )}

                  {/* Motivation flags */}
                  {job.result?.motivationFlags && job.result.motivationFlags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {job.result.motivationFlags.map((flag) => (
                        <span
                          key={flag}
                          className="rounded-full bg-red-500/10 text-red-300 px-2 py-0.5 text-[0.6rem] font-medium"
                        >
                          {flag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Progress for running jobs */}
                  {job.status === "running" && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/40 tabular-nums">{job.progress}%</span>
                      </div>
                      {job.currentStep && (
                        <p className="text-xs text-blue-300 mt-1">{job.currentStep}</p>
                      )}
                    </div>
                  )}

                  {/* Steps summary for completed */}
                  {(job.status === "complete" || job.status === "partial") && (
                    <p className="mt-1 text-xs text-white/30">
                      {job.stepsCompleted.length} plugins completed
                      {job.stepsFailed.length > 0 && `, ${job.stepsFailed.length} failed`}
                    </p>
                  )}
                </div>

                {/* Right: Status + time */}
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      STATUS_STYLES[job.status] || "bg-white/10 text-white/50"
                    }`}
                  >
                    {job.status}
                  </span>
                  <span className="text-xs text-white/30">
                    {timeAgo(job.createdAt)}
                  </span>
                </div>
              </div>
            </a>
          );
        })}

        {jobs.length === 0 && (
          <div className="text-center py-12 text-white/30">
            No dossiers yet. Request research from the leads dashboard.
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
