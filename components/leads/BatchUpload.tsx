"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

interface ParsedRow {
  address: string;
  city: string;
  state: string;
  zip: string;
}

const HEADER_ALIASES: Record<string, keyof ParsedRow> = {
  address: "address",
  street: "address",
  street_address: "address",
  streetaddress: "address",
  "street address": "address",
  city: "city",
  state: "state",
  st: "state",
  zip: "zip",
  zipcode: "zip",
  zip_code: "zip",
  "zip code": "zip",
  postal: "zip",
  postalcode: "zip",
  postal_code: "zip",
  "postal code": "zip",
};

function stripQuotes(s: string): string {
  const trimmed = s.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  const firstLineParts = splitCsvLine(lines[0]);
  const normalized = firstLineParts.map((h) =>
    stripQuotes(h).toLowerCase().replace(/[^a-z ]/g, "")
  );

  // Detect headers
  const colMap: Record<keyof ParsedRow, number> = {
    address: -1,
    city: -1,
    state: -1,
    zip: -1,
  };

  let hasHeaders = false;
  for (let i = 0; i < normalized.length; i++) {
    const mapped = HEADER_ALIASES[normalized[i]];
    if (mapped && colMap[mapped] === -1) {
      colMap[mapped] = i;
      hasHeaders = true;
    }
  }

  // If no headers detected, assume order: address, city, state, zip
  if (!hasHeaders) {
    colMap.address = 0;
    colMap.city = firstLineParts.length > 1 ? 1 : -1;
    colMap.state = firstLineParts.length > 2 ? 2 : -1;
    colMap.zip = firstLineParts.length > 3 ? 3 : -1;
  }

  const dataLines = hasHeaders ? lines.slice(1) : lines;
  const rows: ParsedRow[] = [];

  for (const line of dataLines) {
    const parts = splitCsvLine(line);
    const address = colMap.address >= 0 ? stripQuotes(parts[colMap.address] || "") : "";
    if (!address) continue;

    rows.push({
      address,
      city: colMap.city >= 0 ? stripQuotes(parts[colMap.city] || "") : "",
      state: colMap.state >= 0 ? stripQuotes(parts[colMap.state] || "") : "",
      zip: colMap.zip >= 0 ? stripQuotes(parts[colMap.zip] || "") : "",
    });
  }

  return rows;
}

export default function BatchUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [batchName, setBatchName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function handleFile(file: File) {
    setErrorMsg("");
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setErrorMsg("No valid rows found. Make sure the file contains address data.");
        setRows([]);
        return;
      }
      setRows(parsed);
    };
    reader.onerror = () => {
      setErrorMsg("Failed to read file.");
    };
    reader.readAsText(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function clearFile() {
    setRows([]);
    setFileName("");
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (rows.length === 0) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/leads/dossier/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          name: batchName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Failed to submit batch");
        return;
      }

      router.push("/leads/dossier");
    } catch {
      setStatus("error");
      setErrorMsg("Network error");
    }
  }

  const previewRows = rows.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <h2 className="text-sm font-medium text-white/60 mb-4">Upload CSV</h2>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-colors ${
            dragging
              ? "border-purple-400/60 bg-purple-500/10"
              : "border-white/20 hover:border-white/30 hover:bg-white/[0.03]"
          }`}
        >
          <svg
            className="w-10 h-10 text-white/20 mb-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          {fileName ? (
            <div className="text-center">
              <p className="text-sm text-white/80">{fileName}</p>
              <p className="text-xs text-white/40 mt-1">
                {rows.length} row{rows.length !== 1 ? "s" : ""} parsed
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-white/40">Drop CSV file here</p>
              <p className="text-xs text-white/25 mt-1">or click to browse (.csv, .txt)</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          onChange={onFileChange}
          className="hidden"
        />

        {fileName && (
          <button
            onClick={clearFile}
            className="mt-3 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            Clear file
          </button>
        )}
      </div>

      {/* Preview table */}
      {rows.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-white/60">Preview</h2>
            <span className="text-xs text-white/40">
              Showing {previewRows.length} of {rows.length} row{rows.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">#</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Address</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">City</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">State</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Zip</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-2 px-3 text-white/30 tabular-nums">{i + 1}</td>
                    <td className="py-2 px-3 text-white/80">{row.address}</td>
                    <td className="py-2 px-3 text-white/80">{row.city}</td>
                    <td className="py-2 px-3 text-white/80">{row.state}</td>
                    <td className="py-2 px-3 text-white/80">{row.zip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > 10 && (
            <p className="text-xs text-white/25 mt-3 text-center">
              +{rows.length - 10} more row{rows.length - 10 !== 1 ? "s" : ""} not shown
            </p>
          )}
        </div>
      )}

      {/* Batch name + Submit */}
      {rows.length > 0 && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-white/40 mb-2">
                Batch Name (optional)
              </label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. PropStream Export March"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/50"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={status === "loading" || rows.length === 0}
              className="rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "loading"
                ? "Submitting..."
                : `Submit ${rows.length} Address${rows.length !== 1 ? "es" : ""}`}
            </button>
          </div>

          {errorMsg && <p className="text-xs text-red-400 mt-3">{errorMsg}</p>}
        </div>
      )}

      {/* Error when no rows parsed */}
      {errorMsg && rows.length === 0 && (
        <p className="text-xs text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}
