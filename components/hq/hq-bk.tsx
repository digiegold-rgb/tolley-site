"use client";

import { useCallback, useEffect, useState } from "react";

/** Bitcoin Kids production command center — the DGX pushes a snapshot to
 *  /api/hq/bk; Jared steers from here (notes post back for the next render). */

type Shot = {
  id: string;
  kind: string;
  dur: number;
  speaker: string | null;
  line: string | null;
  scene: string;
  cast: string[];
};
type Episode = {
  slug: string;
  title?: string;
  segment_note?: string;
  status: string;
  shots?: Shot[];
  keyframes?: number;
  clips?: number;
};
type Atom = {
  id: string;
  type: string;
  anecdote: string;
  lesson: string;
  arc: string;
  ep: number;
  source: string;
};
type Production = {
  updated: string;
  transcription: { total: number; done: number; failed: number; hours: number; low_confidence: number };
  live: { total: number; downloaded: number; hours: number };
  story: { atoms: number; by_type: Record<string, number>; by_arc: Record<string, number>; top_atoms: Atom[] };
  characters: { locked: string[]; style: string; protagonist: string };
  episodes: Episode[];
  review: { file: string; mb: number; mtime: string; url?: string | null }[];
  blockers: string[];
};
type Note = { id: string; text: string; area: string; at: string; done?: boolean };
type Payload = { production: Production | null; pushedAt: string | null; notes: { items: Note[] } };

const MUTED = "#6e6e73";
const BORDER = "#e5e5ea";
const card: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: 14,
};
const h: React.CSSProperties = {
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: MUTED,
  margin: "22px 0 10px",
};

const ARC_ORDER = ["curiosity", "basement-rig", "barn", "warehouse", "contractors", "business", "wind-down", "unknown"];
const NOTE_AREAS = ["story", "character", "visual", "audio", "pacing", "general"];

function ago(iso: string | null) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

function Bar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: MUTED }}>{label}</span>
        <strong>
          {done.toLocaleString()} / {total.toLocaleString()} ({pct}%)
        </strong>
      </div>
      <div style={{ height: 7, background: "#f0f0f2", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#0a7d32" : "#0071e3" }} />
      </div>
    </div>
  );
}

export function HqBk() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openEp, setOpenEp] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteArea, setNoteArea] = useState("story");
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hq/bk");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as Payload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const addNote = useCallback(async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    const items = [
      ...(data?.notes?.items ?? []),
      { id: `n-${Date.now()}`, text: noteText.trim(), area: noteArea, at: new Date().toISOString() },
    ];
    await fetch("/api/hq/bk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "notes", items }),
    });
    setNoteText("");
    setSaving(false);
    void load();
  }, [noteText, noteArea, data, load]);

  if (error) return <div style={{ color: "#b3261e", padding: 20 }}>BK: {error}</div>;
  if (!data) return <div style={{ padding: 20, color: MUTED }}>Loading production state…</div>;

  const p = data.production;
  if (!p) {
    return (
      <div style={{ ...card, margin: 20 }}>
        <strong>No production snapshot yet.</strong>
        <div style={{ color: MUTED, fontSize: 13, marginTop: 8 }}>
          Push one from the DGX: <code>cd ~/bitcoin-kids &amp;&amp; BK_PUSH=1 node bk-status.mjs</code>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Story atoms", value: p.story.atoms.toLocaleString(), sub: "mined from real footage" },
    { label: "Archive hours", value: `${(p.transcription.hours + p.live.hours).toFixed(0)}h`, sub: "transcribed + queued" },
    { label: "Episodes", value: String(p.episodes.length), sub: p.episodes.filter((e) => e.status === "in-review").length + " in review" },
    { label: "Cast locked", value: String(p.characters.locked.length), sub: p.characters.protagonist + " + crew" },
  ];

  return (
    <div style={{ padding: "4px 0 40px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20 }}>⚡ Bitcoin Kids — Production</h2>
          <div style={{ color: MUTED, fontSize: 13, marginTop: 3 }}>
            {p.characters.style} · snapshot {ago(data.pushedAt)}
          </div>
        </div>
        <button className="btn" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {/* headline stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12, marginTop: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: 26, fontWeight: 600 }}>{s.value}</div>
            <div style={{ fontSize: 13 }}>{s.label}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* blockers */}
      {p.blockers.length > 0 && (
        <>
          <h3 style={h}>Waiting on Jared</h3>
          <div style={{ ...card, background: "#fff4e5", borderColor: "#f0d9b5" }}>
            {p.blockers.map((b) => (
              <div key={b} style={{ fontSize: 13, padding: "4px 0", color: "#8a5300" }}>
                ⚠️ {b}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ingest */}
      <h3 style={h}>Source archive</h3>
      <div style={card}>
        <Bar done={p.transcription.done} total={p.transcription.total} label="Files transcribed (NAS + downloads)" />
        <Bar done={p.live.downloaded} total={p.live.total} label={`Livestreams ingested (${p.live.hours}h of tape)`} />
        <div style={{ fontSize: 12, color: MUTED }}>
          {p.transcription.hours}h transcribed · {p.transcription.low_confidence} flagged low-confidence · {p.transcription.failed} failed
        </div>
      </div>

      {/* story bible */}
      <h3 style={h}>Storybook — mined from the real footage</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        {ARC_ORDER.filter((a) => p.story.by_arc[a]).map((a) => (
          <div key={a} style={{ ...card, padding: 10 }}>
            <div style={{ fontSize: 19, fontWeight: 600 }}>{p.story.by_arc[a]}</div>
            <div style={{ fontSize: 12, color: MUTED, textTransform: "capitalize" }}>{a.replace("-", " ")}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {Object.entries(p.story.by_type).map(([t, n]) => (
          <span key={t} style={{ fontSize: 12, padding: "3px 9px", borderRadius: 20, background: "#f0f0f2", color: "#3a3a3c" }}>
            {t} · {n}
          </span>
        ))}
      </div>
      <div style={{ ...card, maxHeight: 380, overflowY: "auto" }}>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 8 }}>
          Top episode candidates (potential 4-5). Every one traces to real tape.
        </div>
        {p.story.top_atoms.map((a) => (
          <div key={a.id} style={{ padding: "9px 0", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
              <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: "#e8f8ee", color: "#0a7d32" }}>{a.type}</span>
              <span style={{ fontSize: 11, color: MUTED }}>{a.arc}</span>
              <span style={{ fontSize: 11, color: MUTED, marginLeft: "auto" }}>★ {a.ep}</span>
            </div>
            <div style={{ fontSize: 13 }}>{a.anecdote}</div>
            {a.lesson && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Lesson: {a.lesson}</div>}
          </div>
        ))}
      </div>

      {/* episodes + shot editor */}
      <h3 style={h}>Episodes</h3>
      {p.episodes.map((e) => (
        <div key={e.slug} style={{ ...card, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15 }}>{e.title ?? e.slug}</strong>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 20,
                background: e.status === "in-review" ? "#e8f8ee" : "#fff4e5",
                color: e.status === "in-review" ? "#0a7d32" : "#8a5300",
              }}
            >
              {e.status}
            </span>
            <span style={{ fontSize: 12, color: MUTED }}>
              {e.shots?.length ?? 0} shots · {e.keyframes ?? 0} keyframes · {e.clips ?? 0} clips
            </span>
            <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setOpenEp(openEp === e.slug ? null : e.slug)}>
              {openEp === e.slug ? "Hide" : "Shot list"}
            </button>
          </div>
          {e.segment_note && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{e.segment_note}</div>}
          {openEp === e.slug && (
            <div style={{ marginTop: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
              {(e.shots ?? []).map((s, i) => (
                <div key={s.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid #f4f4f6` }}>
                  <div style={{ fontSize: 11, color: MUTED, width: 58, flexShrink: 0 }}>
                    {String(i + 1).padStart(2, "0")} · {s.dur}s
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 2 }}>
                      <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 4, background: "#f0f0f2" }}>{s.kind}</span>
                      {s.speaker && <span style={{ fontSize: 11, color: "#0071e3" }}>{s.speaker}</span>}
                      {s.cast.map((c) => (
                        <span key={c} style={{ fontSize: 11, color: "#8a5300" }}>
                          +{c}
                        </span>
                      ))}
                    </div>
                    {s.line && <div style={{ fontSize: 13 }}>&ldquo;{s.line}&rdquo;</div>}
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{s.scene}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* review queue */}
      <h3 style={h}>Review queue</h3>
      <div style={card}>
        {p.review.length === 0 && <div style={{ fontSize: 13, color: MUTED }}>Nothing rendered yet.</div>}
        {p.review.map((r) => (
          <div key={r.file} style={{ padding: "6px 0", borderBottom: `1px solid #f4f4f6` }}>
            <div
              onClick={() => r.url && setPlaying(playing === r.file ? null : r.file)}
              style={{
                display: "flex", gap: 10, alignItems: "center", fontSize: 13,
                cursor: r.url ? "pointer" : "default",
              }}
            >
              <span>{playing === r.file ? "▼" : "▶"}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", color: r.url ? "#0071e3" : undefined }}>
                {r.file}
              </span>
              <span style={{ color: MUTED, fontSize: 12 }}>{r.mb} MB</span>
              <span style={{ color: MUTED, fontSize: 12 }}>{ago(r.mtime)}</span>
            </div>
            {playing === r.file && r.url && (
              <div style={{ marginTop: 8 }}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                  src={r.url}
                  controls
                  autoPlay
                  style={{ width: "100%", maxWidth: 860, borderRadius: 10, background: "#000", display: "block" }}
                />
                <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: MUTED, display: "inline-block", marginTop: 5 }}>
                  Open full size ↗
                </a>
              </div>
            )}
          </div>
        ))}
        <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>
          Masters live on the DGX at <code>~/bitcoin-kids/review/</code>; previews go to Telegram.
        </div>
      </div>

      {/* direction notes */}
      <h3 style={h}>Direction notes → next render</h3>
      <div style={card}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {NOTE_AREAS.map((a) => (
            <button
              key={a}
              className="btn"
              onClick={() => setNoteArea(a)}
              style={
                noteArea === a
                  ? { background: "#0071e3", color: "#fff", borderColor: "#0071e3" }
                  : undefined
              }
            >
              {a}
            </button>
          ))}
        </div>
        <textarea
          value={noteText}
          onChange={(ev) => setNoteText(ev.target.value)}
          placeholder="e.g. more motion in explainer shots — no static frames over 4s"
          style={{ width: "100%", minHeight: 70, padding: 10, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}
        />
        <button className="btn btn-primary" onClick={() => void addNote()} disabled={saving || !noteText.trim()} style={{ marginTop: 8 }}>
          {saving ? "Saving…" : "Add note"}
        </button>
        <div style={{ marginTop: 14 }}>
          {(data.notes?.items ?? []).slice().reverse().map((n) => (
            <div key={n.id} style={{ padding: "7px 0", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 20, background: "#f0f0f2" }}>{n.area}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{ago(n.at)}</span>
              </div>
              <div style={{ fontSize: 13, marginTop: 3 }}>{n.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
