"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateProjectButton() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");

  async function create() {
    setCreating(true);
    setErr("");
    try {
      const res = await fetch("/api/video/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled project" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Could not create project");
        return;
      }
      router.push(`/video/edit/${data.project.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={create}
        disabled={creating}
        className="rounded-lg border border-purple-400/30 bg-purple-500/15 px-4 py-2 text-sm font-bold text-purple-200 transition hover:bg-purple-500/25 disabled:opacity-50"
      >
        {creating ? "Creating..." : "+ New project"}
      </button>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
