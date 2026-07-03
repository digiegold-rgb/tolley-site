"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { S } from "../styles";
import { Clip, Scene, TrimPlan, fmtGB } from "../types";

// Apple-style per-clip trim editor — but with the AI's eyes on the timeline.
// We load /trim/plan to get the per-scene score heatmap + the auto keeper windows,
// render the clip's seconds tinted green where the action is, and let the user
// either accept the AI's multi-window "Smart" cut or drag a single in/out range by
// hand. Saving trims the original down to the kept windows (lossless) and moves the
// fat original to TRASH — reclaimed instantly, restorable for a week.
//
// The actual apply + job-poll + undo-toast live in the parent (where the hooks are);
// this component just decides WHAT to keep and calls onApply(keepRanges, reencode).

const GATE = 0.45; // matches ACTION_MIN_SCORE; scenes below this are "B-roll" grey

function scoreColor(score: number, kept: boolean): string {
  // dead footage = flat grey; keepers ramp grey->amber->green with score
  if (!kept) return "rgba(120,120,130,0.28)";
  const s = Math.max(0, Math.min(1, score));
  const hue = 90 + s * 50;            // 90 (yellow-green) -> 140 (green)
  return `hsl(${hue}, 72%, ${34 + s * 16}%)`;
}

export function ClipTrimmer({ clip, apiBase, fileUrl, onApply, onClose }: {
  clip: Clip;
  apiBase: string;
  fileUrl: (u: string) => string;
  onApply: (keepRanges: number[][], reencode: boolean, estReclaimBytes: number) => void;
  onClose: () => void;
}) {
  const [plan, setPlan] = useState<TrimPlan | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [reencode, setReencode] = useState(false);
  // manual single-range [in,out] in seconds (initialised from the auto plan span)
  const [inS, setInS] = useState(0);
  const [outS, setOutS] = useState(0);
  const [cur, setCur] = useState(0);            // video playhead (s)
  const [drag, setDrag] = useState<null | "in" | "out">(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const dur = plan?.durationS || clip.durationS || 0;
  const autoRanges = plan?.keepRanges || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${apiBase}/trim/plan?name=${encodeURIComponent(clip.name)}`, { cache: "no-store" });
        if (!r.ok) throw new Error(`plan ${r.status}`);
        const p: TrimPlan = await r.json();
        if (cancelled) return;
        setPlan(p);
        const d = p.durationS || clip.durationS || 0;
        const lo = p.keepRanges?.[0]?.[0] ?? 0;
        const hi = p.keepRanges?.length ? p.keepRanges[p.keepRanges.length - 1][1] : d;
        setInS(+lo.toFixed(2));
        setOutS(+hi.toFixed(2));
        // No usable AI windows -> drop the user straight into manual mode.
        if (!p.keepRanges?.length) setMode("manual");
      } catch (e: any) {
        if (!cancelled) setLoadErr(e.message || "couldn't load plan");
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, clip.name, clip.durationS]);

  // ---- timeline geometry ----
  const pctOf = (t: number) => (dur ? (t / dur) * 100 : 0);
  const tFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el || !dur) return 0;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return +(frac * dur).toFixed(2);
  }, [dur]);

  // drag the in/out handles (manual mode)
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const t = tFromClientX(e.clientX);
      if (drag === "in") setInS(Math.min(t, outS - 0.5));
      else setOutS(Math.max(t, inS + 0.5));
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag, inS, outS, tFromClientX]);

  const seek = (t: number) => {
    const v = videoRef.current;
    if (v) { v.currentTime = Math.max(0, Math.min(dur, t)); setCur(t); }
  };
  const onTrackClick = (e: React.MouseEvent) => {
    if (drag) return;
    seek(tFromClientX(e.clientX));
  };
  const nudge = (which: "in" | "out", delta: number) => {
    if (which === "in") setInS((v) => Math.max(0, Math.min(outS - 0.5, +(v + delta).toFixed(2))));
    else setOutS((v) => Math.max(inS + 0.5, Math.min(dur, +(v + delta).toFixed(2))));
  };

  // ---- savings math ----
  const keptS = mode === "auto"
    ? autoRanges.reduce((n, [a, b]) => n + (b - a), 0)
    : Math.max(0, outS - inS);
  const frac = dur ? keptS / dur : 1;
  const origBytes = plan?.origBytes || 0;
  const estKept = Math.round(origBytes * frac);
  const estSaved = Math.max(0, origBytes - estKept);
  const worthIt = mode === "auto" ? autoRanges.length > 0 : outS - inS >= 0.5 && frac < 0.97;

  const ranges: number[][] = mode === "auto"
    ? autoRanges.map(([a, b]) => [a, b])
    : [[+inS.toFixed(2), +outS.toFixed(2)]];

  const videoSrc = clip.webUrl ? fileUrl(clip.webUrl) : (clip.url ? fileUrl(clip.url) : undefined);
  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modalBox, maxWidth: 920 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <span style={S.modalTitle}>✂️ Trim · {clip.name}</span>
          <button onClick={onClose} style={S.smallBtn}>✕ Close</button>
        </div>

        {loadErr && <div style={S.error}>Couldn’t load the AI plan: {loadErr}. You can still trim manually.</div>}

        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} src={videoSrc} controls playsInline preload="auto"
          onTimeUpdate={(e) => setCur((e.target as HTMLVideoElement).currentTime)}
          style={{ ...S.modalVideo, maxHeight: "44vh" }} />

        {/* ---- AI score heatmap + trim window ---- */}
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
            <span>0:00</span>
            <span style={{ color: "#22c55e" }}>● taller/greener bar = higher AI score (smile / sound / motion)</span>
            <span>{fmtT(dur)}</span>
          </div>
          <div
            ref={trackRef}
            onClick={onTrackClick}
            role="img"
            aria-label={plan?.scenes?.length
              ? `AI score timeline: ${plan.scenes.length} scenes, ${plan.scenes.filter((s) => (s.score ?? 0) >= GATE).length} above the keep threshold. Bar height encodes score.`
              : "AI score timeline"}
            style={{ position: "relative", height: 64, borderRadius: 8, overflow: "hidden",
                     background: "#0b1220", border: "1px solid #1e293b", cursor: "pointer", userSelect: "none" }}
          >
            {/* per-scene heatmap — score encoded BOTH by colour AND by bar height
                (WCAG 1.4.1: never colour alone). Keepers get a top accent tick. */}
            {(plan?.scenes || []).map((sc: Scene, i: number) => {
              const left = pctOf(sc.start);
              const w = pctOf((sc.end ?? sc.start) - sc.start);
              const score = Math.max(0, Math.min(1, sc.score ?? 0));
              const kept = (sc.score ?? 0) >= GATE;
              return (
                <div key={i} title={`${sc.start.toFixed(1)}–${(sc.end ?? 0).toFixed(1)}s · score ${(sc.score ?? 0).toFixed(2)}${kept ? " · keeper" : ""}`}
                  style={{ position: "absolute", left: `${left}%`, width: `${w}%`, top: 0, bottom: 0 }}>
                  {/* height bar = score (the non-colour cue) */}
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0,
                                height: `${Math.round(18 + score * 82)}%`,
                                background: scoreColor(sc.score ?? 0, kept) }} />
                  {/* keeper tick along the top edge */}
                  {kept && <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 3, background: "#22c55e" }} />}
                </div>
              );
            })}
            {!plan?.scenes?.length && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                            justifyContent: "center", color: "#64748b", fontSize: 12 }}>
                {plan ? "no scene scores for this clip — trim by hand" : "loading AI scores…"}
              </div>
            )}

            {/* AUTO: highlight every keeper window */}
            {mode === "auto" && autoRanges.map(([a, b], i) => (
              <div key={i} style={{ position: "absolute", left: `${pctOf(a)}%`, width: `${pctOf(b - a)}%`,
                top: 0, bottom: 0, border: "2px solid #22c55e", boxShadow: "inset 0 0 0 9999px rgba(34,197,94,0.10)",
                borderRadius: 4 }} />
            ))}

            {/* MANUAL: dim the cut-away ends + draggable in/out handles */}
            {mode === "manual" && (
              <>
                <div style={{ position: "absolute", left: 0, width: `${pctOf(inS)}%`, top: 0, bottom: 0, background: "rgba(2,6,23,0.72)" }} />
                <div style={{ position: "absolute", left: `${pctOf(outS)}%`, right: 0, top: 0, bottom: 0, background: "rgba(2,6,23,0.72)" }} />
                <div style={{ position: "absolute", left: `${pctOf(inS)}%`, width: `${pctOf(outS - inS)}%`, top: 0, bottom: 0, border: "2px solid #f59e0b", borderRadius: 4 }} />
                {(["in", "out"] as const).map((h) => (
                  <div key={h} onPointerDown={(e) => { e.stopPropagation(); setDrag(h); }}
                    title={`Drag to set ${h === "in" ? "start" : "end"}`}
                    style={{ position: "absolute", left: `calc(${pctOf(h === "in" ? inS : outS)}% - 7px)`, top: 0, bottom: 0,
                             width: 14, background: "#f59e0b", cursor: "ew-resize", borderRadius: 3,
                             display: "flex", alignItems: "center", justifyContent: "center", color: "#1c1917", fontSize: 10, fontWeight: 900 }}>
                    {h === "in" ? "⟸" : "⟹"}
                  </div>
                ))}
              </>
            )}

            {/* playhead */}
            <div style={{ position: "absolute", left: `${pctOf(cur)}%`, top: 0, bottom: 0, width: 2, background: "#fff", opacity: 0.85, pointerEvents: "none" }} />
          </div>
        </div>

        {/* ---- mode + controls ---- */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 12 }}>
          <button onClick={() => setMode("auto")} disabled={!autoRanges.length}
            style={mode === "auto" ? S.aspectOn : S.aspectOff}
            title="Keep exactly the windows the AI scored as worth keeping">
            ✨ Smart cut {autoRanges.length ? `(${autoRanges.length} window${autoRanges.length > 1 ? "s" : ""})` : ""}
          </button>
          <button onClick={() => setMode("manual")} style={mode === "manual" ? S.aspectOn : S.aspectOff}
            title="Drag a single in/out range by hand">
            ✂️ Manual range
          </button>

          {mode === "manual" && (
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 4 }}>
              <span style={{ fontSize: 12, color: "#cbd5e1" }}>In {fmtT(inS)}</span>
              <button onClick={() => nudge("in", -0.5)} style={S.smallBtn}>−</button>
              <button onClick={() => nudge("in", +0.5)} style={S.smallBtn}>+</button>
              <span style={{ fontSize: 12, color: "#cbd5e1", marginLeft: 8 }}>Out {fmtT(outS)}</span>
              <button onClick={() => nudge("out", -0.5)} style={S.smallBtn}>−</button>
              <button onClick={() => nudge("out", +0.5)} style={S.smallBtn}>+</button>
              <button onClick={() => seek(inS)} style={S.smallBtn} title="Jump to start">⤓ in</button>
              <button onClick={() => seek(outS - 0.1)} style={S.smallBtn} title="Jump to end">⤓ out</button>
            </div>
          )}

          <div style={{ flex: 1 }} />
          <label style={{ fontSize: 12, color: "#cbd5e1", display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
            title="Lossless copy is instant and snaps to keyframes (cuts land within ~1–2s). Exact cut re-encodes for frame-accurate boundaries — slower.">
            <input type="checkbox" checked={reencode} onChange={(e) => setReencode(e.target.checked)} style={{ accentColor: "#f59e0b" }} />
            Exact cut (re-encode)
          </label>
        </div>

        {/* ---- savings readout + apply ---- */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between",
                      marginTop: 14, paddingTop: 12, borderTop: "1px solid #1e293b" }}>
          <div style={{ fontSize: 13, color: "#e2e8f0" }}>
            Keeps <b>{keptS.toFixed(1)}s</b> of {dur.toFixed(0)}s
            {origBytes > 0 && (
              <> · <span style={{ color: "#94a3b8" }}>{fmtGB(origBytes)}</span>
                {" → "}<span style={{ color: "#94a3b8" }}>~{fmtGB(estKept)}</span>
                {"  "}<span style={{ color: "#22c55e", fontWeight: 700 }}>save ~{fmtGB(estSaved)}</span>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={S.smallBtn}>Cancel</button>
            <button
              onClick={() => onApply(ranges, reencode, estSaved)}
              disabled={!worthIt}
              style={worthIt ? S.dayBtn : S.dayBtnOff}
              title={worthIt ? "Trim the original to these windows and move the full file to trash (restorable for 7 days)"
                             : "Nothing meaningful to trim"}>
              ✂️ Save trimmed &amp; delete original
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
