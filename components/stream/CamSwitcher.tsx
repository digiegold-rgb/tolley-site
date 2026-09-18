"use client";

import { useCallback, useEffect, useState } from "react";

// Camera switcher for the house live pipeline — used on /stream and on the product clicker.
// Tap a tile (or press 1–4) to cut; 🎙 moves the audio lock. Renders nothing until the director reports
// `cameras` in /status, so it is safe against an older director.

export type StreamCam = {
  slot: number;
  label?: string;
  connected: boolean;
  kbps?: number;
  onAir?: boolean;
  audio?: boolean;
  keyTail?: string;
};

type Props = {
  /** Cameras from a /status the parent already polls. Omit to let the switcher poll on its own. */
  cameras?: StreamCam[] | null;
  armed?: boolean;
  /** Called with the director's reply after a cut, so the parent can refresh its own status. */
  onStatus?: (status: unknown) => void;
  compact?: boolean;
};

function typing(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

export default function CamSwitcher({ cameras, armed, onStatus, compact }: Props) {
  const selfPoll = cameras === undefined;
  const [own, setOwn] = useState<{ cameras?: StreamCam[]; armed?: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(0);
  const [pending, setPending] = useState<number | null>(null);
  const [failedAt, setFailedAt] = useState<Record<number, number>>({});

  const cams = (selfPoll ? own?.cameras : cameras) ?? null;
  const isArmed = !!(selfPoll ? own?.armed : armed);

  useEffect(() => {
    if (!selfPoll) return;
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch("/api/stream/status", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!stop) setOwn({ cameras: Array.isArray(j.cameras) ? j.cameras : undefined, armed: !!j.armed });
      } catch { /* keep polling */ }
    };
    void load();
    const t = window.setInterval(() => void load(), 3000);
    return () => { stop = true; window.clearInterval(t); };
  }, [selfPoll]);

  // Thumbnails only refresh while something is actually publishing.
  const anyUp = isArmed && !!cams?.some((c) => c.connected);
  useEffect(() => {
    if (!anyUp) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [anyUp]);

  const post = useCallback(async (path: string, slot: number) => {
    setBusy(slot);
    if (path === "camera") setPending(slot);
    try {
      const r = await fetch(`/api/stream/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot }) });
      const j = await r.json().catch(() => null);
      if (r.ok && j) {
        if (selfPoll && Array.isArray(j.cameras)) setOwn({ cameras: j.cameras, armed: !!j.armed });
        onStatus?.(j);
      }
    } catch { /* next poll shows the truth */ } finally {
      setBusy(0);
      setPending(null);
    }
  }, [onStatus, selfPoll]);

  // 1–4 cut cameras (never while typing, never with a modifier held).
  useEffect(() => {
    if (!cams?.length) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || typing()) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > 4) return;
      const cam = cams!.find((c) => c.slot === n);
      if (!cam || !cam.connected) return;
      e.preventDefault();
      void post("camera", n);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cams, post]);

  if (!cams?.length) return null;

  return (
    <div style={{ margin: compact ? 0 : "14px 0 0" }}>
      {!compact && <div style={C.head}>Cameras · tap or press 1–{Math.min(4, cams.length)} to cut</div>}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${compact ? cams.length : 2}, 1fr)`, gap: 8 }}>
        {cams.map((c) => {
          const onAir = pending ? pending === c.slot : !!c.onAir;
          const showThumb = c.connected && isArmed && tick - (failedAt[c.slot] ?? -99) > 10;
          return (
            <div key={c.slot} style={{ ...C.tile, ...(onAir ? C.onAir : {}), opacity: c.connected ? 1 : 0.45 }}>
              <button
                style={{ ...C.cut, aspectRatio: compact ? "16 / 10" : "9 / 12" }}
                disabled={!c.connected || !!busy}
                onClick={() => void post("camera", c.slot)}
                aria-label={`Cut to camera ${c.slot}`}
              >
                {showThumb && (
                  // eslint-disable-next-line @next/next/no-img-element -- 1 fps authenticated JPEG from the director; next/image would cache it
                  <img
                    src={`/api/stream/thumb/cam${c.slot}.jpg?t=${tick}`}
                    alt=""
                    style={C.img}
                    onError={() => setFailedAt((f) => ({ ...f, [c.slot]: tick }))}
                  />
                )}
                <span style={C.num}>{c.slot}</span>
                {onAir && <span style={C.badge}>ON AIR</span>}
              </button>
              <div style={C.foot}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.label || `Cam ${c.slot}`}{c.connected ? ` · ${c.kbps ?? 0}k` : " · off"}
                </span>
                <button
                  style={{ ...C.mic, ...(c.audio ? C.micOn : {}) }}
                  disabled={!c.connected || !!c.audio || !!busy}
                  title={c.audio ? "Audio comes from this camera" : "Take audio from this camera"}
                  onClick={() => void post("camera/audio", c.slot)}
                >
                  🎙
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const C: Record<string, React.CSSProperties> = {
  head: { fontSize: 13, color: "#8a9", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  tile: { background: "#111a2b", borderRadius: 12, padding: 4, border: "2px solid transparent" },
  onAir: { borderColor: "#e74c3c", boxShadow: "0 0 0 2px rgba(231,76,60,.25)" },
  cut: { position: "relative", display: "block", width: "100%", border: "none", borderRadius: 9, background: "#0a0f1a", overflow: "hidden", cursor: "pointer", padding: 0, touchAction: "manipulation" },
  img: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" },
  num: { position: "absolute", left: 8, top: 6, fontSize: 22, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px #000" },
  badge: { position: "absolute", right: 6, top: 6, fontSize: 11, fontWeight: 800, background: "#e74c3c", color: "#fff", borderRadius: 6, padding: "2px 6px" },
  foot: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, fontSize: 12, color: "#bcc", padding: "4px 4px 2px" },
  mic: { border: "1px solid #334", background: "#0e1626", borderRadius: 8, fontSize: 13, padding: "2px 6px", cursor: "pointer", opacity: 0.55 },
  micOn: { opacity: 1, borderColor: "#2ecc71", background: "#123222" },
};
