"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clip, Disposition, DISPOSITIONS } from "../types";

// Full-screen one-clip-at-a-time triage. The queue is a snapshot taken when the
// mode opens (advancing never reshuffles). Actions are optimistic — the parent
// updates its state + fires the API call in the background, we just advance.
export function ReviewMode({ queue, fileUrl, onTag, onDelete, onClose }: {
  queue: Clip[];
  fileUrl: (u: string) => string;
  onTag: (name: string, d: Disposition) => void;
  onDelete: (name: string) => void;
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [muted, setMuted] = useState(true); // muted is required for mobile autoplay
  const [acted, setActed] = useState<Record<string, string>>({}); // name -> what we did (for the back label)

  const cur = queue[i];
  const next = queue[i + 1];
  const done = i >= queue.length;

  const srcOf = (c: Clip) => {
    const u = c.webUrl || c.previewUrl || c.url;
    return u ? fileUrl(u) : null;
  };

  const advance = useCallback(() => { setI((x) => x + 1); setMuted(true); }, []);
  const back = useCallback(() => { setI((x) => Math.max(0, x - 1)); setMuted(true); }, []);

  const tag = useCallback((d: Disposition) => {
    if (!cur) return;
    onTag(cur.name, d);
    setActed((a) => ({ ...a, [cur.name]: d }));
    advance();
  }, [cur, onTag, advance]);

  const del = useCallback(() => {
    if (!cur) return;
    // no confirm — the parent queues an 8s undo toast for every delete
    onDelete(cur.name);
    setActed((a) => ({ ...a, [cur.name]: "deleted" }));
    advance();
  }, [cur, onDelete, advance]);

  // Keyboard shortcuts (desktop): r/k/w/p tag, x/Del delete, arrows nav, Esc exit.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === "escape") { onClose(); return; }
      if (done) return;
      if (k === "r") tag("recap");
      else if (k === "k") tag("keep");
      else if (k === "w") tag("work");
      else if (k === "p") tag("private");
      else if (k === "x" || k === "delete") del();
      else if (k === "arrowright" || k === " ") { e.preventDefault(); advance(); }
      else if (k === "arrowleft") back();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [done, tag, del, advance, back, onClose]);

  const curSrc = cur ? srcOf(cur) : null;
  const nextSrc = useMemo(() => (next ? srcOf(next) : null), [next]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={R.backdrop}>
      <div style={R.head}>
        <span style={R.progress}>{done ? `${queue.length} reviewed` : `${i + 1} of ${queue.length}`}</span>
        {cur && !done && (
          <span style={R.clipMeta} title={cur.name}>
            {cur.name}{cur.durationS ? ` · ${Math.round(cur.durationS)}s` : ""}
            {acted[cur.name] && <span style={R.actedTag}> · {acted[cur.name]}</span>}
          </span>
        )}
        <button onClick={onClose} style={R.closeBtn} title="Exit review (Esc)">✕</button>
      </div>

      {done ? (
        <div style={R.doneWrap}>
          <div style={{ fontSize: 44 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>All reviewed</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", maxWidth: 360, textAlign: "center" }}>
            Everything is tagged. Clips marked 🎬 Recap go into tonight&apos;s 9:30 PM build.
          </div>
          <button onClick={onClose} style={R.doneBtn}>Done</button>
        </div>
      ) : (
        <>
          <div style={R.videoWrap} onClick={() => setMuted((m) => !m)}>
            {curSrc ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video key={cur.name} src={curSrc} autoPlay muted={muted} playsInline loop controls={false}
                poster={cur.thumbUrl ? fileUrl(cur.thumbUrl) : undefined} style={R.video} />
            ) : (
              <div style={R.noPreview}>No preview available — {cur.name}</div>
            )}
            <span style={R.muteHint}>{muted ? "🔇 tap for sound" : "🔊"}</span>
          </div>
          {/* warm the next clip while this one plays */}
          {nextSrc && <video src={nextSrc} preload="auto" muted style={{ display: "none" }} />}

          <div style={R.actions}>
            <div style={R.dispRow}>
              {DISPOSITIONS.map((d) => (
                <button key={d.id} onClick={() => tag(d.id)} title={`${d.hint} (${d.id[0]})`}
                  style={cur.disposition === d.id && cur.reviewed ? R.dispBtnOn : R.dispBtn}>
                  <span style={{ fontSize: 20 }}>{d.icon}</span>
                  <span style={R.dispLbl}>{d.label}</span>
                </button>
              ))}
            </div>
            <div style={R.navRow}>
              <button onClick={back} disabled={i === 0} style={R.navBtn} title="Previous (←)">← Back</button>
              <button onClick={del} style={R.delBtn} title="Delete permanently (x)">🗑 Delete</button>
              <button onClick={advance} style={R.navBtn} title="Skip — leave unreviewed (→)">Skip →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const R: Record<string, any> = {
  backdrop: { position: "fixed", inset: 0, background: "#05070d", zIndex: 60, display: "flex", flexDirection: "column" },
  head: { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", flexShrink: 0 },
  progress: { fontSize: 13, fontWeight: 800, color: "#fcd34d", whiteSpace: "nowrap" },
  clipMeta: { flex: 1, fontSize: 12, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  actedTag: { color: "#34d399", fontWeight: 700 },
  closeBtn: { width: 40, height: 40, borderRadius: 10, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", color: "white", cursor: "pointer", fontSize: 16, flexShrink: 0 },
  videoWrap: { flex: 1, minHeight: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", cursor: "pointer" },
  video: { maxWidth: "100%", maxHeight: "100%", width: "100%", height: "100%", objectFit: "contain" },
  noPreview: { color: "rgba(255,255,255,0.45)", fontSize: 14, padding: 20, textAlign: "center" },
  muteHint: { position: "absolute", bottom: 10, right: 12, fontSize: 12, fontWeight: 700, color: "white", background: "rgba(0,0,0,0.55)", borderRadius: 8, padding: "4px 10px", pointerEvents: "none" },
  actions: { flexShrink: 0, padding: "10px 12px calc(12px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 8, background: "#0a0e17", borderTop: "1px solid rgba(255,255,255,0.08)" },
  dispRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 },
  dispBtn: { minHeight: 58, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, cursor: "pointer" },
  dispBtnOn: { minHeight: 58, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, fontSize: 12, fontWeight: 800, color: "#1a1206", background: "linear-gradient(90deg,#f59e0b,#f97316)", border: "1px solid transparent", borderRadius: 12, cursor: "pointer" },
  dispLbl: { fontSize: 11.5 },
  navRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
  navBtn: { minHeight: 48, fontSize: 13.5, fontWeight: 700, color: "white", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, cursor: "pointer" },
  delBtn: { minHeight: 48, fontSize: 13.5, fontWeight: 700, color: "#fca5a5", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 12, cursor: "pointer" },
  doneWrap: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 },
  doneBtn: { marginTop: 10, minHeight: 48, fontSize: 14, fontWeight: 800, color: "#1a1206", background: "linear-gradient(90deg,#f59e0b,#f97316)", border: "none", borderRadius: 12, padding: "0 28px", cursor: "pointer" },
};
