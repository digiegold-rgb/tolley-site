"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// tolley.io/stream — one-handed phone remote for the house live pipeline.
// Gated like /hq: owner NextAuth session + MFA (validateWdAdmin). Commands go through /api/stream/* → DGX director.
// tolley.io stores no stream keys.

type Dest = "youtube" | "tiktok";
type Status = {
  armed: boolean;
  privacy: boolean;
  liveSinceS: number;
  camera: { connected: boolean; kbps: number; sinceS: number; goneS: number };
  obs: { connected: boolean; scene: string; streaming: boolean; programReady: boolean; lastError: string };
  mediamtx: { ok: boolean };
  destinations: Record<Dest, { enabled: boolean; configured: boolean; running: boolean; uptimeS: number }>;
  limits: { camGoneEndMin: number; maxStreamMin: number; brbAfterS: number };
  ingest: { url: string; keyTail: string };
  events: { t: number; kind: string; msg: string }[];
};

const DESTS: Dest[] = ["youtube", "tiktok"];
const LABEL: Record<Dest, string> = { youtube: "YouTube", tiktok: "TikTok" };

function fmt(s: number) {
  if (!s) return "0:00";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
}

export default function StreamPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<Status | null>(null);
  const [offline, setOffline] = useState<string>("");
  const [busy, setBusy] = useState("");
  const [sel, setSel] = useState<Record<Dest, boolean>>({ youtube: true, tiktok: false });
  const [holdPct, setHoldPct] = useState(0);
  const [showAdv, setShowAdv] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const holdStart = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/stream/status", { cache: "no-store" });
      if (r.status === 401) { setAuthed(false); setChecking(false); return; }
      const j = await r.json();
      setAuthed(true);
      setChecking(false);
      if (!r.ok) { setOffline(j.error || `HTTP ${r.status}`); return; }
      setOffline("");
      setStatus(j);
      if (j.armed) setSel({ youtube: j.destinations.youtube.enabled, tiktok: j.destinations.tiktok.enabled });
    } catch (e) {
      setChecking(false);
      setOffline(e instanceof Error ? e.message : "network error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!authed) return;
    void load();
    const t = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(t);
  }, [authed, load]);

  async function cmd(path: string, body?: unknown) {
    setBusy(path);
    try {
      const r = await fetch(`/api/stream/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      if (r.status === 401) { setAuthed(false); return; }
      const j = await r.json();
      if (r.ok) { setStatus(j); setOffline(""); } else setOffline(j.error || `HTTP ${r.status}`);
    } catch (e) {
      setOffline(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy("");
    }
  }

  function toggleDest(d: Dest) {
    const next = { ...sel, [d]: !sel[d] };
    setSel(next);
    if (status?.armed) void cmd("destinations", next);
  }

  // Hold-to-end: 1 s press so a pocket tap can't kill the live.
  function holdBegin() {
    holdStart.current = Date.now();
    holdTimer.current = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - holdStart.current) / 1000) * 100);
      setHoldPct(p);
      if (p >= 100) { holdEnd(); void cmd("end", { reason: "kill switch (tolley.io/stream)" }); }
    }, 50);
  }
  function holdEnd() {
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHoldPct(0);
  }

  if (checking) {
    return <main style={S.wrap}><h1 style={S.h1}>📡 Stream</h1><div style={{ color: "#9aa" }}>Loading…</div></main>;
  }

  if (!authed) {
    // Same gate as /hq: owner account + authenticator (NextAuth admin session). No PIN.
    return (
      <main style={S.wrap}>
        <h1 style={S.h1}>📡 Stream</h1>
        <p style={{ color: "#9aa", fontSize: 15 }}>Use your owner account and authenticator to continue.</p>
        <a href="/login?callbackUrl=/stream" style={{ ...S.btn, ...S.primary, display: "block", textAlign: "center", textDecoration: "none" }}>Sign in securely</a>
      </main>
    );
  }

  const s = status;
  const cam = s?.camera;
  const dgxDown = !!offline;
  const live = !!s?.armed;

  return (
    <main style={S.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={S.h1}>📡 Stream</h1>
        <span style={{ fontSize: 13, color: "#9aa" }}>{live ? `LIVE ${fmt(s!.liveSinceS)}` : "off air"}</span>
      </div>

      {dgxDown && <div style={S.banner}>DGX unreachable: {offline}</div>}

      {/* status strip */}
      <div style={S.grid}>
        <Tile label="Camera" ok={!!cam?.connected} text={cam?.connected ? `${cam.kbps} kbps · ${fmt(cam.sinceS)}` : cam ? `gone ${fmt(cam.goneS)}` : "—"} />
        <Tile label="OBS" ok={!!s?.obs.connected} text={s ? `${s.obs.scene || "?"}${s.obs.streaming ? " · encoding" : ""}` : "—"} />
        {DESTS.map((d) => (
          <Tile key={d} label={LABEL[d]} ok={!!s?.destinations[d].running} dim={!s?.destinations[d].configured}
            text={!s ? "—" : !s.destinations[d].configured ? "no key" : s.destinations[d].running ? `live ${fmt(s.destinations[d].uptimeS)}` : s.destinations[d].enabled ? "waiting" : "off"} />
        ))}
      </div>

      {/* destinations */}
      <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
        {DESTS.map((d) => (
          <button key={d} onClick={() => toggleDest(d)} disabled={!s?.destinations[d].configured}
            style={{ ...S.chip, ...(sel[d] ? S.chipOn : {}), opacity: s?.destinations[d].configured ? 1 : 0.4 }}>
            {sel[d] ? "✓ " : ""}{LABEL[d]}
          </button>
        ))}
      </div>

      {/* main controls */}
      <div style={{ display: "grid", gap: 12 }}>
        {!live ? (
          <button style={{ ...S.btn, ...S.primary }} disabled={!!busy || dgxDown} onClick={() => cmd("go-live", { destinations: sel })}>
            {busy === "go-live" ? "…" : "▶ Go Live"}
          </button>
        ) : (
          <button
            style={{ ...S.btn, ...S.danger, background: `linear-gradient(90deg,#c0392b ${holdPct}%,#5a1f1a ${holdPct}%)` }}
            onPointerDown={holdBegin} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}
            disabled={!!busy}>
            {busy === "end" ? "ending…" : "■ Hold to END STREAM"}
          </button>
        )}
        <button style={{ ...S.btn, ...(s?.privacy ? S.warnOn : S.secondary) }} disabled={!live || !!busy} onClick={() => cmd("privacy", { on: !s?.privacy })}>
          {s?.privacy ? "🔒 Privacy ON — tap to resume" : "🔒 Privacy"}
        </button>
      </div>

      {/* advanced */}
      <button onClick={() => setShowAdv((v) => !v)} style={{ ...S.link, marginTop: 18 }}>{showAdv ? "▾" : "▸"} advanced</button>
      {showAdv && s && (
        <div style={{ fontSize: 13, color: "#bcc", display: "grid", gap: 6 }}>
          <div>Mimo URL: <code>{s.ingest.url}</code> · key ends …{s.ingest.keyTail}</div>
          <div>Auto-end after camera gone {s.limits.camGoneEndMin} min · max {s.limits.maxStreamMin} min · BRB after {s.limits.brbAfterS}s</div>
          <div>MediaMTX {s.mediamtx.ok ? "ok" : "DOWN"} · program {s.obs.programReady ? "ready" : "idle"} {s.obs.lastError && `· OBS: ${s.obs.lastError}`}</div>
          <button style={{ ...S.btn, ...S.secondary, padding: "10px" }} disabled={!!busy} onClick={() => { if (window.confirm("Rotate the camera key? You must re-enter it in Mimo (sent to Telegram).")) void cmd("rotate-key"); }}>
            🔑 Rotate camera key
          </button>
          <div style={{ marginTop: 6, color: "#8a9" }}>Recent</div>
          {s.events.slice(0, 12).map((e, i) => (
            <div key={i} style={{ color: "#9ab" }}>{new Date(e.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {e.msg}</div>
          ))}
        </div>
      )}
    </main>
  );
}

function Tile({ label, ok, text, dim }: { label: string; ok: boolean; text: string; dim?: boolean }) {
  return (
    <div style={{ ...S.tile, opacity: dim ? 0.5 : 1 }}>
      <div style={{ fontSize: 11, color: "#8a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: ok ? "#2ecc71" : "#e74c3c", marginRight: 6 }} />
        {label}
      </div>
      <div style={{ fontSize: 15, marginTop: 4 }}>{text}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 480, margin: "0 auto", padding: "16px 16px 40px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#eef", background: "#0b1220", minHeight: "100vh" },
  h1: { fontSize: 22, margin: "6px 0 14px" },
  btn: { fontSize: 18, fontWeight: 600, padding: "18px 16px", borderRadius: 14, border: "none", cursor: "pointer", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" },
  primary: { background: "#2ecc71", color: "#062" },
  secondary: { background: "#1c2940", color: "#dde" },
  warnOn: { background: "#f5c542", color: "#432" },
  danger: { color: "#fff" },
  chip: { flex: 1, padding: "12px 10px", borderRadius: 10, border: "1px solid #334", background: "#111a2b", color: "#bcc", fontSize: 15 },
  chipOn: { background: "#1f3a5f", borderColor: "#4a90e2", color: "#fff" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  tile: { background: "#111a2b", borderRadius: 12, padding: "10px 12px" },
  banner: { background: "#5a1f1a", color: "#ffd", padding: "10px 12px", borderRadius: 10, marginBottom: 12, fontSize: 14 },
  link: { background: "none", border: "none", color: "#8ab", fontSize: 14, padding: 0, cursor: "pointer" },
};
