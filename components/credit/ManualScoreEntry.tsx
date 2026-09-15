"use client";

import { useState } from "react";

export function ManualScoreEntry({ onSaved }: { onSaved: () => void }) {
  const [transunion, setTransunion] = useState("");
  const [equifax, setEquifax] = useState("");
  const [experian, setExperian] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const entry: Record<string, unknown> = {
        date: new Date().toISOString().split("T")[0],
        source: "manual",
        sources: {} as Record<string, string>,
      };
      const sources = entry.sources as Record<string, string>;
      const tu = transunion ? parseInt(transunion, 10) : NaN;
      const eq = equifax ? parseInt(equifax, 10) : NaN;
      const ex = experian ? parseInt(experian, 10) : NaN;
      const ko = kickoff ? parseInt(kickoff, 10) : NaN;
      if (Number.isFinite(tu)) {
        entry.transunion = tu;
        sources.transunion = "manual";
      }
      if (Number.isFinite(eq)) {
        entry.equifax = eq;
        sources.equifax = "manual";
      }
      if (Number.isFinite(ex)) {
        entry.experian = ex;
        sources.experian = "manual";
      }
      if (Number.isFinite(ko)) {
        entry.kickoff_score = ko;
        sources.kickoff = "manual";
      }

      await fetch("/api/credit/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      onSaved();
    } catch {}
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-purple-400/20 bg-purple-500/5 p-5 backdrop-blur-xl">
      <p className="mb-3 text-[0.68rem] font-medium tracking-wider text-white/50 uppercase">
        Add Score Entry
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "TransUnion", value: transunion, set: setTransunion },
          { label: "Equifax", value: equifax, set: setEquifax },
          { label: "Experian", value: experian, set: setExperian },
          { label: "Kikoff", value: kickoff, set: setKickoff },
        ].map((field) => (
          <div key={field.label}>
            <label className="mb-1 block text-xs text-white/40">
              {field.label}
            </label>
            <input
              type="number"
              min={300}
              max={850}
              value={field.value}
              onChange={(e) => field.set(e.target.value)}
              placeholder="---"
              className="w-full rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-center font-mono text-lg text-white/90 placeholder-white/20 outline-none focus:border-purple-400/40"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={saving || (!transunion && !equifax && !experian && !kickoff)}
          className="rounded-xl bg-purple-500/30 px-6 py-2 text-sm font-medium text-white/90 transition hover:bg-purple-500/40 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save Scores"}
        </button>
        <button
          onClick={onSaved}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/50 hover:text-white/70"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
