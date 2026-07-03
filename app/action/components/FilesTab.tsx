"use client";

import { useCallback, useEffect, useState } from "react";
import { S } from "../styles";
import { FsEntry } from "../types";
import { PromptModal } from "./PromptModal";
import { Skeleton } from "./Skeleton";

// Top-level dirs the API refuses to delete (matches PROTECTED_FS_DIRS server-side).
// We disable the Del button for these at the root so the user never hits a 403.
const PROTECTED_ROOT = new Set(["originals", "output", "state", "incoming",
  "incoming_pool", "incoming-pool", "music", "work"]);
const isProtectedRoot = (fsPath: string, name: string) =>
  fsPath === "" && (PROTECTED_ROOT.has(name) || name.startsWith("_") || name === ".trash");

export function FilesTab({ apiBase, token }: { apiBase: string; token: string }) {
  const [fsPath, setFsPath] = useState("");
  const [fsEntries, setFsEntries] = useState<FsEntry[]>([]);
  const [fsErr, setFsErr] = useState("");
  const [fsBusy, setFsBusy] = useState(false);
  const [fsLoading, setFsLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  // which prompt modal is open (replaces window.prompt)
  const [prompt, setPrompt] = useState<{ kind: "move"; src: string } | { kind: "mkdir" } | null>(null);

  const authHeaders = { "Content-Type": "application/json", "x-action-token": token };

  const loadFs = useCallback(async (path: string) => {
    setFsErr("");
    setFsLoading(true);
    try {
      const r = await fetch(`${apiBase}/fs/list?path=${encodeURIComponent(path)}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`list ${r.status}`);
      const d = await r.json();
      setFsPath(d.path === "." ? "" : d.path);
      setFsEntries(d.entries || []);
    } catch (e: any) {
      setFsErr(e.message);
    } finally { setFsLoading(false); }
  }, [apiBase]);

  useEffect(() => {
    loadFs("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fsMove(src: string, dstDir: string) {
    setFsBusy(true);
    try {
      const r = await fetch(`${apiBase}/fs/move`, { method: "POST", headers: authHeaders, body: JSON.stringify({ src, dstDir }) });
      if (!r.ok) throw new Error(await r.text());
      await loadFs(fsPath);
    } catch (e: any) { setFsErr(`Move failed: ${e.message}`); } finally { setFsBusy(false); }
  }
  async function fsDelete(path: string) {
    if (!window.confirm(`Delete "${path}"?\n\nIt moves to .trash (restorable for 7 days), not erased.`)) return;
    setFsBusy(true);
    try {
      const r = await fetch(`${apiBase}/fs/delete`, { method: "POST", headers: authHeaders, body: JSON.stringify({ path }) });
      if (!r.ok) throw new Error(await r.text());
      await loadFs(fsPath);
    } catch (e: any) { setFsErr(`Delete failed: ${e.message}`); } finally { setFsBusy(false); }
  }
  async function fsMkdir(name: string) {
    setFsBusy(true);
    try {
      const r = await fetch(`${apiBase}/fs/mkdir`, { method: "POST", headers: authHeaders, body: JSON.stringify({ path: fsPath ? `${fsPath}/${name}` : name }) });
      if (!r.ok) throw new Error(await r.text());
      await loadFs(fsPath);
    } catch (e: any) { setFsErr(`Mkdir failed: ${e.message}`); } finally { setFsBusy(false); }
  }
  async function fsUpload(files: FileList | null) {
    if (!files || !files.length) return;
    setFsBusy(true);
    try {
      for (const f of Array.from(files)) {
        const fd = new FormData();
        fd.append("path", fsPath);
        fd.append("file", f);
        const r = await fetch(`${apiBase}/fs/upload`, { method: "POST", headers: { "x-action-token": token }, body: fd });
        if (!r.ok) throw new Error(await r.text());
      }
      await loadFs(fsPath);
    } catch (e: any) { setFsErr(`Upload failed: ${e.message}`); } finally { setFsBusy(false); }
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* breadcrumb + actions */}
      <div style={S.fsBar}>
        <div style={S.crumbs}>
          <button onClick={() => loadFs("")} style={S.crumbBtn}>action-cam</button>
          {fsPath.split("/").filter(Boolean).map((seg, i, arr) => {
            const p = arr.slice(0, i + 1).join("/");
            return (
              <span key={p}>
                <span style={{ opacity: 0.4 }}> / </span>
                <button onClick={() => loadFs(p)} style={S.crumbBtn}>{seg}</button>
              </span>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setPrompt({ kind: "mkdir" })} disabled={fsBusy} style={S.smallBtn}>+ Folder</button>
          <label style={{ ...S.smallBtnPrimary, cursor: "pointer" }}>
            ↑ Upload
            <input type="file" multiple style={{ display: "none" }} onChange={(e) => fsUpload(e.target.files)} />
          </label>
        </div>
      </div>
      {fsErr && <div style={S.error}>{fsErr}</div>}
      {fsLoading && fsEntries.length === 0 ? (
        <Skeleton rows={5} height={42} />
      ) : (
        <div
          style={{ ...S.fsList, outline: dragOver ? "2px dashed #f59e0b" : "none", outlineOffset: 4 }}
          onDragOver={(ev) => { ev.preventDefault(); if (!dragOver) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(ev) => { ev.preventDefault(); setDragOver(false); fsUpload(ev.dataTransfer.files); }}
        >
          {dragOver && <div style={S.empty}>Drop files to upload to “{fsPath || "action-cam"}”…</div>}
          {fsEntries.length === 0 && <div style={S.empty}>Empty folder.</div>}
          {fsEntries.map((e) => (
            <div key={e.rel} style={S.fsRow}>
              <button
                onClick={() => e.isDir && loadFs(e.rel)}
                style={{ ...S.fsName, cursor: e.isDir ? "pointer" : "default" }}
              >
                <span style={{ marginRight: 8 }}>{e.isDir ? "📁" : e.isVideo ? "🎬" : "📄"}</span>
                {e.name}
              </button>
              <span style={S.fsMeta}>{e.sizeMB != null ? `${e.sizeMB} MB` : ""}</span>
              <div style={S.fsActions}>
                {!e.isDir && <a href={`${apiBase}/file?path=${encodeURIComponent(e.rel)}`} download style={S.fsAct} aria-label={`Download ${e.name}`} title={`Download ${e.name}`}>↓</a>}
                <button onClick={() => setPrompt({ kind: "move", src: e.rel })} disabled={fsBusy} style={S.fsAct} aria-label={`Move ${e.name}`}>Move</button>
                {isProtectedRoot(fsPath, e.name) ? (
                  <button disabled style={{ ...S.fsAct, color: "#52525b", cursor: "not-allowed" }}
                    aria-label={`${e.name} is a protected system folder and cannot be deleted`}
                    title="Protected system folder — can't be deleted from here">🔒</button>
                ) : (
                  <button onClick={() => fsDelete(e.rel)} disabled={fsBusy} style={{ ...S.fsAct, color: "#fca5a5" }}
                    aria-label={`Delete ${e.name}`}>Del</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <p style={S.hint}>
        Tip: drop music tracks into <code style={S.code}>music</code> and they'll be used as recap background beds.
      </p>

      {prompt?.kind === "move" && (
        <PromptModal title={`Move "${prompt.src.split("/").pop()}" to…`}
          placeholder="e.g. music, originals, output/16x9" initial="music" submitLabel="Move"
          onSubmit={(dst) => fsMove(prompt.src, dst)} onClose={() => setPrompt(null)} />
      )}
      {prompt?.kind === "mkdir" && (
        <PromptModal title="New folder name" placeholder="folder-name" submitLabel="Create"
          onSubmit={(name) => fsMkdir(name)} onClose={() => setPrompt(null)} />
      )}
    </div>
  );
}
