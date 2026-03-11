"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

interface ParsedRow {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  ownerName?: string;
  ownerName2?: string;
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  isAbsentee?: boolean;
}

export default function NarrprUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{ imported: number; matched: number; unmatched: number; merged: number } | null>(null);

  function handleFile(file: File) {
    setErrorMsg("");
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseNarrprCsv(text);
      if (parsed.length === 0) {
        setErrorMsg("No valid rows found. Ensure the CSV has address columns.");
        setRows([]);
        return;
      }
      setRows(parsed);
    };
    reader.readAsText(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) { e.preventDefault(); setDragging(true); }
  function onDragLeave(e: DragEvent<HTMLDivElement>) { e.preventDefault(); setDragging(false); }
  function onFileChange(e: ChangeEvent<HTMLInputElement>) { const file = e.target.files?.[0]; if (file) handleFile(file); }

  function clearFile() {
    setRows([]);
    setFileName("");
    setErrorMsg("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (rows.length === 0) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/leads/narrpr/csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Import failed");
        return;
      }
      setStatus("done");
      setResult(data);
    } catch {
      setStatus("error");
      setErrorMsg("Network error");
    }
  }

  const previewRows = rows.slice(0, 10);
  const absenteeCount = rows.filter((r) => r.isAbsentee).length;

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <div className="rounded-xl bg-white/5 border border-white/10 p-6">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-sm font-medium text-white/60">NARRPR CSV Import</h2>
          <span className="text-xs rounded-full bg-orange-500/20 text-orange-300 px-2 py-0.5">
            Prospecting Export
          </span>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-colors ${
            dragging
              ? "border-orange-400/60 bg-orange-500/10"
              : "border-white/20 hover:border-white/30 hover:bg-white/[0.03]"
          }`}
        >
          <svg className="w-10 h-10 text-white/20 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          {fileName ? (
            <div className="text-center">
              <p className="text-sm text-white/80">{fileName}</p>
              <p className="text-xs text-white/40 mt-1">
                {rows.length} row{rows.length !== 1 ? "s" : ""} parsed
                {absenteeCount > 0 && (
                  <span className="text-orange-300 ml-2">{absenteeCount} absentee</span>
                )}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-white/40">Drop NARRPR CSV export here</p>
              <p className="text-xs text-white/25 mt-1">Supports Owner, Address, Mailing columns</p>
            </div>
          )}
        </div>

        <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={onFileChange} className="hidden" />
        {fileName && (
          <button onClick={clearFile} className="mt-3 text-xs text-white/30 hover:text-white/50 transition-colors">
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
              Showing {previewRows.length} of {rows.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">#</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Address</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Owner</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">City</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Zip</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-white/40">Absentee</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="py-2 px-3 text-white/30 tabular-nums">{i + 1}</td>
                    <td className="py-2 px-3 text-white/80">{row.address}</td>
                    <td className="py-2 px-3 text-white/60">{row.ownerName || "—"}</td>
                    <td className="py-2 px-3 text-white/60">{row.city || "—"}</td>
                    <td className="py-2 px-3 text-white/60">{row.zip || "—"}</td>
                    <td className="py-2 px-3">
                      {row.isAbsentee ? (
                        <span className="text-xs rounded-full bg-orange-500/20 text-orange-300 px-2 py-0.5">Yes</span>
                      ) : (
                        <span className="text-xs text-white/20">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 10 && (
            <p className="text-xs text-white/25 mt-3 text-center">+{rows.length - 10} more</p>
          )}
        </div>
      )}

      {/* Submit */}
      {rows.length > 0 && status !== "done" && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-6">
          <button
            onClick={handleSubmit}
            disabled={status === "loading" || rows.length === 0}
            className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "loading"
              ? "Importing..."
              : `Import ${rows.length} NARRPR Record${rows.length !== 1 ? "s" : ""}`}
          </button>
          {errorMsg && <p className="text-xs text-red-400 mt-3">{errorMsg}</p>}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-6">
          <h3 className="text-sm font-medium text-green-300 mb-3">Import Complete</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center">
              <span className="text-2xl font-bold text-white/80">{result.imported}</span>
              <div className="text-[0.6rem] text-white/30">IMPORTED</div>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-green-400">{result.matched}</span>
              <div className="text-[0.6rem] text-white/30">MATCHED</div>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-yellow-400">{result.unmatched}</span>
              <div className="text-[0.6rem] text-white/30">UNMATCHED</div>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-blue-400">{result.merged}</span>
              <div className="text-[0.6rem] text-white/30">MERGED</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Simple NARRPR CSV parser (client-side) ─────────────────────

function parseNarrprCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const headers = splitLine(lines[0]).map((h) => strip(h).toLowerCase().replace(/[^a-z0-9 ]/g, "").trim());

  const colMap: Record<string, number> = {};
  const firstNameCols: Record<string, number> = {};
  const lastNameCols: Record<string, number> = {};

  const aliases: Record<string, string> = {
    "property address": "address", "site address": "address", address: "address", street: "address",
    city: "city", "property city": "city", "site city": "city",
    state: "state", "property state": "state", st: "state",
    zip: "zip", zipcode: "zip", "zip code": "zip", "property zip": "zip",
    "owner name": "ownerName", "owner 1": "ownerName", owner: "ownerName",
    "owner 2": "ownerName2", "co-owner": "ownerName2",
    "mailing address": "mailingAddress", "mail address": "mailingAddress",
    "mailing city": "mailingCity", "mail city": "mailingCity",
    "mailing state": "mailingState", "mail state": "mailingState",
    "mailing zip": "mailingZip", "mail zip": "mailingZip",
  };

  for (let i = 0; i < headers.length; i++) {
    if (headers[i] === "owner 1 first name") { firstNameCols["ownerName"] = i; continue; }
    if (headers[i] === "owner 1 last name") { lastNameCols["ownerName"] = i; continue; }
    if (headers[i] === "owner 2 first name") { firstNameCols["ownerName2"] = i; continue; }
    if (headers[i] === "owner 2 last name") { lastNameCols["ownerName2"] = i; continue; }
    const mapped = aliases[headers[i]];
    if (mapped && !(mapped in colMap)) colMap[mapped] = i;
  }

  if (!("address" in colMap)) return [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitLine(lines[i]);
    const address = strip(parts[colMap.address] || "");
    if (!address) continue;

    let ownerName = colMap.ownerName != null ? strip(parts[colMap.ownerName] || "") : "";
    if (firstNameCols.ownerName != null || lastNameCols.ownerName != null) {
      const f = firstNameCols.ownerName != null ? strip(parts[firstNameCols.ownerName] || "") : "";
      const l = lastNameCols.ownerName != null ? strip(parts[lastNameCols.ownerName] || "") : "";
      ownerName = [f, l].filter(Boolean).join(" ");
    }

    let ownerName2 = colMap.ownerName2 != null ? strip(parts[colMap.ownerName2] || "") : undefined;
    if (firstNameCols.ownerName2 != null || lastNameCols.ownerName2 != null) {
      const f = firstNameCols.ownerName2 != null ? strip(parts[firstNameCols.ownerName2] || "") : "";
      const l = lastNameCols.ownerName2 != null ? strip(parts[lastNameCols.ownerName2] || "") : "";
      ownerName2 = [f, l].filter(Boolean).join(" ") || undefined;
    }

    const city = colMap.city != null ? strip(parts[colMap.city] || "") : undefined;
    const mailingAddress = colMap.mailingAddress != null ? strip(parts[colMap.mailingAddress] || "") : undefined;
    const mailingCity = colMap.mailingCity != null ? strip(parts[colMap.mailingCity] || "") : undefined;

    // Detect absentee
    let isAbsentee = false;
    if (mailingAddress && address) {
      const propNum = address.match(/^\d+/)?.[0];
      const mailNum = mailingAddress.match(/^\d+/)?.[0];
      if (propNum && mailNum && propNum !== mailNum) isAbsentee = true;
      else if (city && mailingCity && city.toLowerCase() !== mailingCity.toLowerCase()) isAbsentee = true;
    }

    rows.push({
      address,
      city,
      state: colMap.state != null ? strip(parts[colMap.state] || "") : undefined,
      zip: colMap.zip != null ? strip(parts[colMap.zip] || "") : undefined,
      ownerName: ownerName || undefined,
      ownerName2,
      mailingAddress,
      mailingCity,
      mailingState: colMap.mailingState != null ? strip(parts[colMap.mailingState] || "") : undefined,
      mailingZip: colMap.mailingZip != null ? strip(parts[colMap.mailingZip] || "") : undefined,
      isAbsentee,
    });
  }
  return rows;
}

function splitLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) { fields.push(current.trim()); current = ""; }
    else current += ch;
  }
  fields.push(current.trim());
  return fields;
}

function strip(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))
    return t.slice(1, -1).trim();
  return t;
}
