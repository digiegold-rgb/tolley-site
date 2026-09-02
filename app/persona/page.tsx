"use client";

// /persona — self-serve persona editor (2026-08-11, Jared: stop paying credits
// to text for every character tweak). Edits business-os/persona-identity.json
// (her description) + persona-wardrobe.json (outfits) + character-ref.png (face)
// on the DGX, which every render script reads. Admin-gated. Server enforces a
// broadcast-safe guardrail that is NOT client-adjustable.
import { useEffect, useRef, useState } from "react";

const box: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 8, border: "1px solid #2a2f3d",
  background: "#141826", color: "#e8eaf0", width: "100%", fontSize: 14,
};

export default function PersonaPage() {
  const [desc, setDesc] = useState("");
  const [updated, setUpdated] = useState("");
  const [wardrobe, setWardrobe] = useState<string[]>([]);
  const [newOutfit, setNewOutfit] = useState("");
  const [register, setRegister] = useState("casual");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const loaded = useRef(false);

  async function load() {
    const r = await fetch("/api/admin/persona", { cache: "no-store" });
    if (r.status === 401) { setMsg({ t: "Log in at /hq first, then reload.", ok: false }); return; }
    const j = await r.json();
    setDesc(j.description || ""); setUpdated(j.updated || ""); setWardrobe(j.wardrobe || []);
  }
  useEffect(() => { if (!loaded.current) { loaded.current = true; load(); } }, []);

  function flash(t: string, ok: boolean) { setMsg({ t, ok }); setTimeout(() => setMsg(null), 6000); }

  async function saveDesc() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/persona", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      const j = await r.json();
      flash(r.ok ? "Saved — next render uses this." : (j.error || j.detail || "save failed"), r.ok);
    } finally { setBusy(false); }
  }

  async function addOutfit() {
    if (newOutfit.trim().length < 4) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/persona/wardrobe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newOutfit, register }),
      });
      const j = await r.json();
      if (r.ok) { setWardrobe((w) => [...w, newOutfit]); setNewOutfit(""); flash(`Added — ${j.count} outfits.`, true); }
      else flash(j.error || j.detail || "add failed", false);
    } finally { setBusy(false); }
  }

  async function uploadTicket(file: File): Promise<string> {
    const t = await fetch("/api/admin/quickgen/ticket", { method: "POST" });
    const { ticket } = await t.json();
    const fd = new FormData(); fd.append("file", file);
    const up = await fetch(`https://quickgen.tolley.io/upload?ticket=${ticket}`, { method: "POST", body: fd });
    const uj = await up.json();
    if (!up.ok || !uj.upload_id) throw new Error(uj.detail || "upload failed");
    return uj.upload_id;
  }

  async function rebuildRef() {
    if (!refFiles.length) { flash("Pick 1–6 reference photos first.", false); return; }
    setBusy(true);
    try {
      flash("Uploading + rebuilding her face… (~15s)", true);
      const ids: string[] = [];
      for (const f of refFiles.slice(0, 6)) ids.push(await uploadTicket(f));
      const r = await fetch("/api/admin/persona/ref", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref_ids: ids.join(",") }),
      });
      const j = await r.json();
      flash(r.ok ? "New face locked in — next render uses it." : (j.error || j.detail || "rebuild failed"), r.ok);
    } catch (e) { flash(e instanceof Error ? e.message : String(e), false); }
    finally { setBusy(false); }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0d12", color: "#e8eaf0", display: "flex", justifyContent: "center", padding: "48px 16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 640 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Persona Editor</h1>
        <p style={{ color: "#8b93a7", fontSize: 13, marginBottom: 8 }}>
          Edit her yourself — no credits, no texting. Every daily render reads this instantly.
        </p>
        <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
          <a href="/generate" style={{ color: "#5b8cff", fontSize: 13 }}>→ Generate</a>
          <span style={{ color: "#5c6273", fontSize: 13 }}>Live at video.tolley.io: watch renders run</span>
        </div>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Her description {updated && <span style={{ color: "#5c6273", fontSize: 12 }}>· saved {updated}</span>}</h2>
          <p style={{ color: "#6b7386", fontSize: 12, marginBottom: 8 }}>
            Face, hair, skin, age, vibe. Do NOT put clothes or jewelry here — those live in Wardrobe below (clothes here fight her reference photo and cause face drift).
          </p>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} disabled={busy} style={box} />
          <button onClick={saveDesc} disabled={busy} style={{ marginTop: 10, padding: "9px 20px", borderRadius: 8, border: "none", background: "#5b8cff", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Save description</button>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Her face (reference image)</h2>
          <p style={{ color: "#6b7386", fontSize: 12, marginBottom: 8 }}>
            Upload 1–6 AI reference photos of the same woman; her locked portrait is rebuilt to match (the old one is backed up).
          </p>
          <input type="file" accept="image/*" multiple disabled={busy}
            onChange={(e) => setRefFiles(Array.from(e.target.files ?? []))} style={{ color: "#e8eaf0", marginBottom: 10 }} />
          {refFiles.length > 0 && <span style={{ marginLeft: 6, fontSize: 13 }}>{refFiles.length} selected</span>}
          <div><button onClick={rebuildRef} disabled={busy} style={{ marginTop: 8, padding: "9px 20px", borderRadius: 8, border: "1px solid #5b8cff", background: "#141826", color: "#cdd7ff", cursor: "pointer" }}>Rebuild her face</button></div>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Wardrobe <span style={{ color: "#5c6273", fontSize: 12 }}>· {wardrobe.length} outfits</span></h2>
          <p style={{ color: "#6b7386", fontSize: 12, marginBottom: 8 }}>
            Add an outfit. Garment only — use <code>{"{color}"}</code> where a color goes, e.g. <i>a {"{color}"} linen jumpsuit</i>. It joins the daily rotation.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input value={newOutfit} onChange={(e) => setNewOutfit(e.target.value)} placeholder="a {color} oversized cable-knit sweater and leggings" disabled={busy} style={{ ...box, flex: 1 }} />
            <select value={register} onChange={(e) => setRegister(e.target.value)} disabled={busy} style={{ ...box, width: "auto" }}>
              <option value="casual">casual</option>
              <option value="elegant">elegant</option>
              <option value="athleisure">athleisure</option>
              <option value="glam">glam</option>
            </select>
            <button onClick={addOutfit} disabled={busy} style={{ padding: "0 18px", borderRadius: 8, border: "none", background: "#5b8cff", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Add</button>
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto", fontSize: 13, color: "#8b93a7", lineHeight: 1.8 }}>
            {wardrobe.map((w, i) => <div key={i}>· {w}</div>)}
          </div>
        </section>

        {msg && <p style={{ color: msg.ok ? "#9be8b8" : "#ff9b9b", fontSize: 13 }}>{msg.t}</p>}
      </div>
    </main>
  );
}
