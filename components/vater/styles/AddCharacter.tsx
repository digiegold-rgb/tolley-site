"use client";

import { useState, useCallback, useRef } from "react";

type Mode = "describe" | "upload";

export function AddCharacter({
  styleId,
  onComplete,
}: {
  styleId: string;
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<Mode>("upload");
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    if (!name.trim()) {
      setError("Name required");
      return;
    }
    if (mode === "describe" && brief.trim().length < 8) {
      setError("Brief description must be ≥8 chars");
      return;
    }
    if (mode === "upload" && !imageFile) {
      setError("Pick a reference image (PNG/JPG/WebP)");
      return;
    }
    setBusy(true);
    setPhase("starting");
    try {
      let endpoint: string;
      let body: Record<string, unknown>;

      if (mode === "upload" && imageFile) {
        // Upload image to Vercel Blob first → get public URL → DGX downloads
        // it back to local disk and uses as IP-Adapter face anchor.
        setPhase("uploading image");
        const fd = new FormData();
        fd.append("file", imageFile);
        const ur = await fetch("/api/vater/upload", { method: "POST", body: fd });
        const udata = await ur.json();
        if (!ur.ok) throw new Error(udata?.error || `upload ${ur.status}`);
        endpoint = `/api/vater/youtube/styles/${styleId}/characters/from-image`;
        body = { name: name.trim(), imageUrl: udata.url };
      } else {
        endpoint = `/api/vater/youtube/styles/${styleId}/characters`;
        body = { name: name.trim(), brief: brief.trim() };
      }

      setPhase("creating");
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      const jobId = data.jobId as string;
      setPhase(mode === "upload" ? "Gemini analyzing image" : "describing");
      const start = Date.now();
      const TIMEOUT_MS = 5 * 60 * 1000;
      while (Date.now() - start < TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, 4000));
        const pr = await fetch(`/api/vater/autopilot/jobs/${jobId}`, { cache: "no-store" }).catch(() => null);
        if (pr?.ok) {
          const pj = await pr.json();
          setPhase(pj.phase || "running");
          if (pj.status === "done") break;
          if (pj.status === "failed") throw new Error(pj.error || "character gen failed");
        }
      }
      setName("");
      setBrief("");
      setImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPhase("");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  }, [name, brief, mode, imageFile, styleId, onComplete]);

  return (
    <div className="space-y-3 rounded-md border border-zinc-800 bg-zinc-900/40 p-3">
      {/* Mode tabs */}
      <div className="flex gap-1 rounded-md bg-zinc-950 p-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode("upload")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            mode === "upload"
              ? "bg-sky-600 text-white"
              : "bg-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          🖼️ Upload my reference image (recommended)
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode("describe")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            mode === "describe"
              ? "bg-sky-600 text-white"
              : "bg-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          ✏️ Describe → SDXL invents
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Character name (e.g. Peter, Trey, The Everyman)"
        disabled={busy}
        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500"
      />

      {mode === "upload" ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-200 hover:file:bg-zinc-700"
          />
          {imageFile && (
            <div className="mt-2 flex items-center gap-2 rounded-md border border-zinc-800 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(imageFile)}
                alt="ref"
                className="h-12 w-12 rounded object-cover"
              />
              <span className="text-xs text-zinc-400">{imageFile.name}</span>
            </div>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            Your image becomes the IP-Adapter face anchor → SAME character in
            every scene. Gemini Vision auto-writes the hex descriptor. ~10-15s.
          </p>
        </div>
      ) : (
        <div>
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Brief: middle-aged man in a blue suit, anxious about money"
            disabled={busy}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Qwen writes a 400-800 char hex descriptor. SDXL renders the ref
            image (may invent a character that doesn&apos;t match your brand).
            ~15-90s.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500" />
        <button
          type="button"
          onClick={submit}
          disabled={
            busy ||
            !name.trim() ||
            (mode === "describe" && brief.trim().length < 8) ||
            (mode === "upload" && !imageFile)
          }
          className="rounded-md bg-sky-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy
            ? phase || "Working…"
            : mode === "upload"
              ? "Upload + Create Character"
              : "Generate Character"}
        </button>
      </div>
      {error && (
        <div className="rounded-md border border-rose-900 bg-rose-950/30 p-2 text-xs text-rose-300">
          {error}
        </div>
      )}
    </div>
  );
}
