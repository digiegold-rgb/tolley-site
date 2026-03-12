"use client";

import { useCallback, useRef, useState } from "react";

type UploadStatus = "idle" | "uploading" | "success" | "error";

export function VaterFileUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [message, setMessage] = useState("");

  const handleFile = useCallback((f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setStatus("idle");
    setMessage("");
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const upload = async () => {
    if (!file) return;
    setStatus("uploading");
    setMessage("");

    try {
      const body = new FormData();
      body.append("file", file);

      const res = await fetch("/api/vater/upload", { method: "POST", body });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Upload failed (${res.status})`);
      }

      setStatus("success");
      setMessage("Upload complete.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  return (
    <div className="vater-card mx-auto max-w-lg p-6">
      <h3 className="mb-4 text-lg font-bold text-slate-100">Upload File</h3>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-sky-400 bg-sky-400/10"
            : "border-slate-600 hover:border-sky-400/50"
        }`}
      >
        <svg
          className="mb-3 h-8 w-8 text-slate-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3.75 3.75 0 013.572 5.345A3.75 3.75 0 0118 19.5H6.75z"
          />
        </svg>
        <p className="text-sm text-slate-400">
          Drag &amp; drop a file here, or <span className="text-sky-400 underline">browse</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {/* Selected file */}
      {file && (
        <p className="mt-3 truncate text-sm text-slate-300">
          Selected: <span className="font-medium text-sky-400">{file.name}</span>{" "}
          <span className="text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
        </p>
      )}

      {/* Upload button */}
      <button
        onClick={upload}
        disabled={!file || status === "uploading"}
        className="vater-cta mt-4 w-full justify-center disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "uploading" ? "Uploading..." : "Upload"}
      </button>

      {/* Status message */}
      {message && (
        <p
          className={`mt-3 text-sm font-medium ${
            status === "success" ? "text-green-400" : "text-red-400"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
