"use client";

import { useState } from "react";

type CourtCase = {
  id: string;
  caseNumber: string;
  court: string;
  fileDate: string | null;
  caseType: string | null;
  status: string | null;
  parties: { role: string; name: string }[];
  judgmentAmount: number | null;
  events: { date: string; description: string }[];
  lastActivity: string | null;
  relatedDebtId: string | null;
  notes: string | null;
};

const statusColors: Record<string, string> = {
  active: "bg-red-500/20 text-red-400 border-red-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  disposed: "bg-white/10 text-white/40 border-white/10",
  closed: "bg-white/10 text-white/40 border-white/10",
  judgment: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

function getStatusStyle(status: string | null) {
  if (!status) return statusColors.pending;
  const lower = status.toLowerCase();
  if (lower.includes("dispos") || lower.includes("closed"))
    return statusColors.disposed;
  if (lower.includes("judgment")) return statusColors.judgment;
  if (lower.includes("active") || lower.includes("pending"))
    return statusColors.active;
  return statusColors.pending;
}

export function CourtCases({
  cases,
  lastCheck,
}: {
  cases?: CourtCase[];
  lastCheck?: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const triggerScan = async () => {
    setScanning(true);
    try {
      await fetch("/api/credit/court", { method: "POST" });
    } catch {}
    setTimeout(() => setScanning(false), 5000);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#00d4ff]">
          Missouri Court Cases (CaseNet)
        </h3>
        <div className="flex items-center gap-3">
          {lastCheck && (
            <span className="text-xs text-white/30">
              Last scan:{" "}
              {new Date(lastCheck).toLocaleDateString("en-US", {
                timeZone: "America/Chicago",
              })}
            </span>
          )}
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="rounded-lg border border-[#00d4ff]/30 bg-[#00d4ff]/10 px-3 py-1.5 text-xs font-medium text-[#00d4ff] hover:bg-[#00d4ff]/20 disabled:opacity-50"
          >
            {scanning ? "Scanning..." : "Scan Now"}
          </button>
        </div>
      </div>

      {!cases || cases.length === 0 ? (
        <p className="text-sm text-white/40">
          No court cases found. Cases will appear after the next CaseNet scan
          (Monday 6 AM or use Scan Now).
        </p>
      ) : (
        <div className="space-y-3">
          {cases.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <div
                className="flex cursor-pointer items-center justify-between"
                onClick={() =>
                  setExpandedId(expandedId === c.id ? null : c.id)
                }
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-white">
                    {c.caseNumber}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusStyle(c.status)}`}
                  >
                    {c.status || "Unknown"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/50">
                  {c.judgmentAmount && (
                    <span className="font-medium text-amber-400">
                      ${c.judgmentAmount.toLocaleString()}
                    </span>
                  )}
                  <span>{c.fileDate || "No date"}</span>
                  <span className="text-white/30">
                    {expandedId === c.id ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              <div className="mt-1 text-xs text-white/40">
                {c.caseType || "Unknown type"} — {c.court}
              </div>

              {expandedId === c.id && (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-3">
                  {c.parties.length > 0 && (
                    <div>
                      <h5 className="mb-1 text-xs font-bold uppercase text-white/50">
                        Parties
                      </h5>
                      {c.parties.map((p, i) => (
                        <div key={i} className="text-xs text-white/60">
                          <span className="text-white/40">{p.role}:</span>{" "}
                          {p.name}
                        </div>
                      ))}
                    </div>
                  )}

                  {c.events.length > 0 && (
                    <div>
                      <h5 className="mb-1 text-xs font-bold uppercase text-white/50">
                        Docket Events
                      </h5>
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        {c.events.map((e, i) => (
                          <div key={i} className="flex gap-2 text-xs">
                            <span className="shrink-0 text-white/40">
                              {e.date}
                            </span>
                            <span className="text-white/60">
                              {e.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {c.notes && (
                    <p className="text-xs italic text-white/40">{c.notes}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
