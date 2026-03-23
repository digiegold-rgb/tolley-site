"use client";

import { useState, useEffect } from "react";
import type { Owner } from "./types";

export default function DossierManualEdit({
  jobId,
  syncKey,
  owners,
}: {
  jobId: string;
  syncKey: string;
  owners: Owner[];
}) {
  const [saving, setSaving] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [manualOwnerName, setManualOwnerName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualEmail, setManualEmail] = useState("");

  useEffect(() => {
    if (owners.length > 0) {
      setManualOwnerName(owners[0].name || "");
      setManualPhone(owners[0].phone || "");
      setManualEmail(owners[0].email || "");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveManualInfo() {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/dossier/${jobId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": syncKey,
        },
        body: JSON.stringify({
          ownerName: manualOwnerName || undefined,
          ownerPhone: manualPhone || undefined,
          ownerEmail: manualEmail || undefined,
        }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const err = await res.json();
        alert(err.error || "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function rerunResearch() {
    setRerunning(true);
    try {
      const res = await fetch(`/api/leads/dossier/${jobId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": syncKey,
        },
        body: JSON.stringify({
          ownerName: manualOwnerName || undefined,
          ownerPhone: manualPhone || undefined,
          ownerEmail: manualEmail || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = `/leads/dossier/${data.jobId}?key=${syncKey}`;
      } else {
        const err = await res.json();
        alert(err.error || "Re-run failed");
      }
    } finally {
      setRerunning(false);
    }
  }

  return (
    <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 p-4">
      <h3 className="text-sm font-medium text-purple-300 mb-3">
        Add Info / Re-run Research
      </h3>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text"
          value={manualOwnerName}
          onChange={(e) => setManualOwnerName(e.target.value)}
          placeholder="Owner name"
          className="flex-1 min-w-[180px] rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/50"
        />
        <input
          type="text"
          value={manualPhone}
          onChange={(e) => setManualPhone(e.target.value)}
          placeholder="Phone"
          className="w-40 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/50"
        />
        <input
          type="text"
          value={manualEmail}
          onChange={(e) => setManualEmail(e.target.value)}
          placeholder="Email"
          className="w-48 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/50"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={saveManualInfo}
          disabled={saving}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Info"}
        </button>
        <button
          onClick={rerunResearch}
          disabled={rerunning}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50"
        >
          {rerunning ? "Starting..." : "Re-run Research with Updates"}
        </button>
      </div>
      <p className="text-[0.6rem] text-white/20 mt-2">
        Add owner name, phone, or email to help the DGX find better data. Re-run
        will start a fresh research job using this info.
      </p>
    </div>
  );
}
