"use client";

import type { DeedEntry } from "./types";

export default function DossierHistory({
  deedHistory,
}: {
  deedHistory: DeedEntry[];
}) {
  if (deedHistory.length === 0) {
    return (
      <p className="text-white/30 text-sm">
        No deed history found. Check source links for manual lookup.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {deedHistory.map((d, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg bg-white/[0.03] p-2 text-sm"
        >
          <div>
            <span className="text-white/70">{d.date}</span>
            <span className="text-white/30 mx-2">|</span>
            <span className="capitalize text-white/40">
              {d.type.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {d.price && (
              <span className="font-medium text-white/80">
                ${d.price.toLocaleString()}
              </span>
            )}
            <a
              href={d.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              Source
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
