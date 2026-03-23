"use client";

import type { CourtCase, Lien } from "./types";

export default function DossierLegal({
  courtCases,
  liens,
  bankruptcies,
}: {
  courtCases: CourtCase[];
  liens: Lien[];
  bankruptcies: {
    chapter: string;
    caseNumber: string;
    filedDate: string;
    status: string;
    sourceUrl: string;
  }[];
}) {
  if (courtCases.length === 0 && liens.length === 0 && bankruptcies.length === 0) {
    return (
      <p className="text-green-300/60 text-sm">
        No court records, liens, or bankruptcies found.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {courtCases.map((c, i) => (
        <div
          key={i}
          className="rounded-lg bg-red-500/5 border border-red-500/10 p-3"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 font-medium uppercase">
                {c.type.replace(/_/g, " ")}
              </span>
              <p className="text-sm text-white mt-1">Case# {c.caseNumber}</p>
              <p className="text-xs text-white/40">
                {c.court} | Filed: {c.filedDate} | {c.status}
              </p>
              <p className="text-xs text-white/40">{c.parties}</p>
            </div>
            <a
              href={c.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              View case
            </a>
          </div>
        </div>
      ))}
      {liens.map((ln, i) => (
        <div
          key={`lien-${i}`}
          className="rounded-lg bg-orange-500/5 border border-orange-500/10 p-3"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs rounded-full bg-orange-500/20 text-orange-300 px-2 py-0.5 font-medium uppercase">
                {ln.type.replace(/_/g, " ")}
              </span>
              {ln.amount && (
                <p className="text-sm text-white mt-1">
                  ${ln.amount.toLocaleString()}
                </p>
              )}
              <p className="text-xs text-white/40">
                Holder: {ln.holder} | Filed: {ln.filedDate} | {ln.status}
              </p>
            </div>
            <a
              href={ln.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              View
            </a>
          </div>
        </div>
      ))}
      {bankruptcies.map((b, i) => (
        <div
          key={`bk-${i}`}
          className="rounded-lg bg-red-500/5 border border-red-500/10 p-3"
        >
          <span className="text-xs rounded-full bg-red-500/20 text-red-300 px-2 py-0.5 font-medium">
            BANKRUPTCY CH. {b.chapter}
          </span>
          <p className="text-sm text-white mt-1">Case# {b.caseNumber}</p>
          <p className="text-xs text-white/40">
            Filed: {b.filedDate} | {b.status}
          </p>
        </div>
      ))}
    </div>
  );
}
