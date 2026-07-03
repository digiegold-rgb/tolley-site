"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * Drop a photo → upload to /api/leads/snap → navigate to the resulting Snap
 * result page. Lives on the Cockpit and is also exposed via Cmd+K.
 */
export default function SnapDropZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/snap/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Upload failed (${res.status})`);
      }
      if (data?.snapId) {
        router.push(`/leads/snap/${data.snapId}`);
      } else {
        router.push("/leads/snap");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void upload(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 ${
        dragging
          ? "scale-[1.01] border-sky-300/70 bg-gradient-to-br from-sky-400/15 via-cyan-400/10 to-emerald-400/10 shadow-lg shadow-sky-500/20"
          : "border-sky-400/20 bg-gradient-to-br from-sky-400/5 via-white/[0.04] to-emerald-400/5 hover:border-sky-300/40 hover:from-sky-400/10 hover:to-emerald-400/10"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 text-white shadow-lg shadow-sky-500/40">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </div>
      <div className="text-sm font-medium text-white">
        {uploading ? "Uploading…" : "Snap & Know — drop a photo"}
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Auto-extracts GPS, geolocates, builds a full dossier
      </div>
      {error && (
        <div className="mt-2 text-[11px] text-rose-300">{error}</div>
      )}
    </div>
  );
}
