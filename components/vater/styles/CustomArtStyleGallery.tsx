"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  name: string;
  description: string;
  referenceImageUrls: string[];
  thumbnailUrl: string | null;
  updatedAt: string | Date;
  _count?: { styles: number };
};

export function CustomArtStyleGallery({ items }: { items: Item[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setFiles([]);
    setError(null);
    setPhase("");
    setCreating(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFiles = (filelist: FileList | null) => {
    if (!filelist) return;
    const arr = Array.from(filelist).slice(0, 5);
    setFiles(arr);
    // Auto-fill name from the first file if user hasn't typed one yet.
    // Strips extension + common screenshot prefix so "Screenshot 2026-04-14 at 7.02.52 PM"
    // becomes a reasonable starting point the user can edit before submit.
    if (!name.trim() && arr.length > 0) {
      const stem = arr[0].name
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/^Screenshot[ _-]*\d{4}-\d{2}-\d{2}.*$/i, "Custom style")
        .trim();
      setName(stem || "Custom style");
    }
  };

  const submit = async () => {
    if (!name.trim() || files.length < 3 || files.length > 5) {
      setError("Need a name and 3-5 images");
      return;
    }
    setBusy(true);
    setError(null);
    setPhase("uploading");
    try {
      // Upload each image via /api/vater/upload (Vercel Blob)
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        setPhase(`uploading ${i + 1}/${files.length}`);
        const fd = new FormData();
        fd.append("file", files[i]);
        const r = await fetch("/api/vater/upload", { method: "POST", body: fd });
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || `upload ${i + 1} failed`);
        urls.push(data.url);
      }

      // Create the CustomArtStyle row + kick off Gemini describer
      setPhase("analyzing");
      const r = await fetch("/api/vater/youtube/custom-art-styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), referenceImageUrls: urls }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `create failed: ${r.status}`);

      // Poll job status if returned (description fills in async via callback)
      if (data.jobId) {
        setPhase("describing");
        const start = Date.now();
        const TIMEOUT_MS = 3 * 60 * 1000;
        while (Date.now() - start < TIMEOUT_MS) {
          await new Promise((res) => setTimeout(res, 4000));
          const pr = await fetch(`/api/vater/autopilot/jobs/${data.jobId}`, { cache: "no-store" }).catch(() => null);
          if (pr?.ok) {
            const pj = await pr.json();
            if (pj.status === "done") break;
            if (pj.status === "failed") throw new Error(pj.error || "describer failed");
          }
        }
      }

      reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {creating ? (
        <div className="rounded-lg border border-sky-700 bg-sky-950/30 p-5 space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Create custom art style</h2>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-400">
              Style name <span className="text-rose-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder="e.g. Finance Whiteboard, Pixar Casual, Cartel Drone"
              className={`w-full rounded-md border bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-sky-500 ${
                !name.trim() && files.length >= 3
                  ? "border-rose-700"
                  : "border-zinc-700"
              }`}
            />
            {!name.trim() && files.length >= 3 ? (
              <p className="mt-1 text-xs text-rose-400">Name required to submit</p>
            ) : null}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={busy}
              onChange={(e) => handleFiles(e.target.files)}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-200 hover:file:bg-zinc-700"
            />
            <p className="mt-1 text-xs text-zinc-500">
              3-5 reference images (PNG/JPG/WebP, ≤10 MB each). All should
              demonstrate the SAME illustration style.
            </p>
          </div>
          {files.length > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-md border border-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="rounded-md border border-rose-900 bg-rose-950/30 p-2 text-xs text-rose-300">{error}</div>
          )}
          {(() => {
            const missing: string[] = [];
            if (!name.trim()) missing.push("name");
            if (files.length < 3) missing.push(`${3 - files.length} more image${3 - files.length === 1 ? "" : "s"}`);
            if (files.length > 5) missing.push("≤5 images (you have too many)");
            const canSubmit = missing.length === 0 && !busy;
            return (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!canSubmit) {
                        setError(`Need: ${missing.join(", ")}`);
                        return;
                      }
                      void submit();
                    }}
                    disabled={busy}
                    className={`flex-1 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                      canSubmit ? "bg-sky-600 hover:bg-sky-500" : "bg-zinc-700 hover:bg-zinc-600 cursor-help"
                    }`}
                  >
                    {busy ? phase || "Working…" : canSubmit ? "Upload + Analyze" : `Upload + Analyze (need: ${missing.join(", ")})`}
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    disabled={busy}
                    className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })()}
          <p className="text-xs text-zinc-500">
            ~5-10s per image upload + ~5s Gemini Flash analysis. Free tier
            handles vision OK; falls back gracefully if the API errors.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          + Create custom art style
        </button>
      )}

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
          No custom art styles yet. Upload 3-5 reference images above to make
          your first one.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((cas) => (
            <CustomArtStyleCard key={cas.id} item={cas} onDelete={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  );
}

function CustomArtStyleCard({
  item,
  onDelete,
}: {
  item: Item;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const handleDelete = async () => {
    if (!confirm(`Delete custom art style "${item.name}"?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/vater/youtube/custom-art-styles/${item.id}`, { method: "DELETE" });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error || `delete failed: ${r.status}`);
      }
      onDelete();
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="grid aspect-video w-full grid-cols-3 grid-rows-2 gap-px bg-zinc-950">
        {item.referenceImageUrls.slice(0, 6).map((url, i) => (
          <div key={i} className="relative bg-zinc-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="ref" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">{item.name}</h3>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {item._count?.styles ?? 0} style{(item._count?.styles ?? 0) === 1 ? "" : "s"}
          </span>
        </div>
        {item.description ? (
          <p className="line-clamp-3 text-xs text-zinc-500">{item.description}</p>
        ) : (
          <p className="text-xs italic text-amber-400">Description pending… (Gemini analyzing)</p>
        )}
      </div>
      <div className="border-t border-zinc-800 p-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="w-full rounded-md border border-rose-900 px-3 py-1 text-xs font-medium text-rose-400 hover:bg-rose-950 disabled:opacity-50"
        >
          {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
