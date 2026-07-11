"use client";

// People tab (v2) — on-device face clusters from faces.py. Name your kids here,
// then build "Reel of <name>" per person. 100% local (InsightFace on the DGX).

import { useCallback, useEffect, useState } from "react";
import { S } from "../styles";

type Person = {
  id: string; name: string | null; hidden: boolean;
  faceCount: number; clipCount: number; sampleFace?: string | null;
};

export function PeopleTab({ apiBase, token, onJob }: {
  apiBase: string;
  token: string;
  onJob: (jobId: string, meta: { period: string; kind: string; label: string }) => void;
}) {
  const [people, setPeople] = useState<Person[]>([]);
  const [updated, setUpdated] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const authHeaders = { "Content-Type": "application/json", "x-action-token": token };

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${apiBase}/people`, { cache: "no-store" });
      const j = await r.json();
      setPeople(j.people || []);
      setUpdated(j.updated || null);
    } catch (e: any) {
      setErr(`People load failed: ${e.message}`);
    }
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  async function post(path: string, body: Record<string, unknown>, label: string) {
    setErr("");
    setBusy(label);
    try {
      const r = await fetch(`${apiBase}${path}`, {
        method: "POST", headers: authHeaders, body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      if (j.jobId) onJob(j.jobId, { period: "", kind: "reel", label });
      await load();
    } catch (e: any) {
      setErr(`${label} failed: ${e.message}`);
    } finally {
      setBusy("");
    }
  }

  const shown = people.filter((p) => showHidden || !p.hidden);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={S.tabIntro}>
        <b>👥 People</b> — faces found in your footage, clustered on-device (nothing leaves the LAN).
        <b> Click a name to label a kid</b>, merge duplicate clusters, hide strangers, and build a
        <b> personal highlight reel</b> per person. New footage is scanned nightly at 12:30 AM.
        {updated && <span style={{ color: "#64748b" }}> · last scan {updated}</span>}
      </div>

      {err && <div style={{ color: "#f87171", marginBottom: 10 }}>{err}</div>}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
        <button style={S.dayBtn} disabled={!!busy}
          onClick={() => post("/people/sweep", {}, "Face scan")}>
          🔍 Scan faces now
        </button>
        <button style={showHidden ? S.aspectOn : S.aspectOff} onClick={() => setShowHidden(!showHidden)}>
          {showHidden ? "Showing hidden" : "Show hidden"}
        </button>
        {mergeFrom && (
          <span style={{ color: "#fcd34d", fontSize: 13 }}>
            Merging <b>{people.find((p) => p.id === mergeFrom)?.name || mergeFrom}</b> — click the person to keep…
            <button style={{ ...S.smallBtn, marginLeft: 8 }} onClick={() => setMergeFrom(null)}>cancel</button>
          </span>
        )}
      </div>

      {shown.length === 0 && (
        <div style={S.empty}>
          No people yet. Hit <b>Scan faces now</b> — the first pass over all footage takes a while.
        </div>
      )}

      <div style={S.grid}>
        {shown.map((p) => (
          <div key={p.id} style={{ ...S.card, opacity: p.hidden ? 0.55 : 1 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              {p.sampleFace ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${apiBase}/people/thumb?face=${encodeURIComponent(p.sampleFace)}`}
                  alt={p.name || "person"} width={72} height={72}
                  style={{ borderRadius: 12, objectFit: "cover", background: "#1e293b" }}
                  onClick={() => { if (mergeFrom && mergeFrom !== p.id) { post("/people/merge", { into: p.id, drop: mergeFrom }, "Merge"); setMergeFrom(null); } }}
                />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: 12, background: "#1e293b",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>👤</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {renaming === p.id ? (
                  <input autoFocus value={nameDraft} placeholder="Name this person"
                    style={S.titleInput}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => { post("/people/rename", { id: p.id, name: nameDraft }, "Rename"); setRenaming(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  />
                ) : (
                  <div style={{ ...S.titleText, fontSize: 16 }} title="Click to name"
                    onClick={() => { setRenaming(p.id); setNameDraft(p.name || ""); }}>
                    {p.name || "Unnamed"} <span style={S.titlePen}>✎</span>
                  </div>
                )}
                <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                  {p.faceCount} faces · {p.clipCount} clips
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button style={S.smallBtnPrimary} disabled={!!busy}
                title={`Build a highlight reel of ${p.name || "this person"} → Plex`}
                onClick={() => post("/people/reel", { id: p.id }, `Reel of ${p.name || p.id}`)}>
                🎬 Build reel
              </button>
              <button style={S.smallBtn} disabled={!!busy || mergeFrom === p.id}
                title="Same kid split into two clusters? Click here, then click the card to keep."
                onClick={() => setMergeFrom(p.id)}>
                ⇄ Merge into…
              </button>
              <button style={S.smallBtn} disabled={!!busy}
                onClick={() => post("/people/hide", { id: p.id, hidden: !p.hidden }, p.hidden ? "Unhide" : "Hide")}>
                {p.hidden ? "👁 Unhide" : "🙈 Hide"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
