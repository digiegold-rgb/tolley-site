"use client";

import type { AltBureauPlaceholder } from "@/lib/credit/types";
import { DEFAULT_ALT_BUREAUS } from "@/lib/credit/types";

const statusLabel: Record<AltBureauPlaceholder["status"], string> = {
  not_started: "not wired",
  monitoring: "monitoring",
  n_a: "n/a",
};

export function AltBureaus({
  bureaus,
}: {
  bureaus?: AltBureauPlaceholder[] | null;
}) {
  const rows = bureaus && bureaus.length > 0 ? bureaus : DEFAULT_ALT_BUREAUS;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-[#00d4ff]">
        Other bureaus
      </h3>
      <p className="mb-3 text-[0.65rem] text-white/35">
        Placeholders only — scores stay -- until a real pull exists.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((b) => (
          <div
            key={b.id}
            className="rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-white/80">{b.label}</p>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.6rem] text-white/40">
                {statusLabel[b.status] ?? b.status}
              </span>
            </div>
            <p className="mt-2 text-3xl font-black text-white/15">
              {b.score ?? "--"}
            </p>
            <p className="mt-1 text-[0.65rem] text-white/30">
              {b.vendor ?? "vendor --"} · as of {b.asOf ?? "--"}
            </p>
            {b.notes && (
              <p className="mt-1 text-[0.65rem] italic text-white/30">
                {b.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
