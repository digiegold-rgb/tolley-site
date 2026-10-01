"use client";

import Link from "next/link";
import { broadcastLabel } from "@/lib/live/core";
import { useCallback, useEffect, useRef, useState } from "react";

import FacebookLive, { type FacebookMeta } from "@/components/stream/FacebookLive";
import CamSwitcher, { type StreamCam } from "@/components/stream/CamSwitcher";

// tolley.io/stream — one-handed phone remote for the house live pipeline.
// Gated like /hq: owner NextAuth session + MFA (validateWdAdmin). Commands go through /api/stream/* → DGX director.
// tolley.io stores no stream keys.

type Dest = "youtube" | "tiktok" | "whatnot" | "facebook";
type DestState = { enabled: boolean; configured: boolean; running: boolean; uptimeS: number; keyTail?: string };
type Status = {
  facebook?: FacebookMeta;
  recording?: { state: string; ageS: number | null; bytes: number; error?: string };
  armed: boolean;
  privacy: boolean;
  liveSinceS: number;
  camera: { connected: boolean; kbps: number; sinceS: number; goneS: number };
  obs: { connected: boolean; scene: string; streaming: boolean; programReady: boolean; lastError: string };
  mediamtx: { ok: boolean };
  // `whatnot`, `cameras` and `keyTail` only exist on a multi-cam director — everything new is optional.
  destinations: Partial<Record<Dest, DestState>>;
  cameras?: StreamCam[];
  limits: { camGoneEndMin: number; maxStreamMin: number; brbAfterS: number };
  ingest: { url: string; keyTail: string };
  studio: { online: boolean; ageS: number; studioRunning: boolean; obsRunning: boolean; host: string };
  events: { t: number; kind: string; msg: string }[];
};

const DESTS: Dest[] = ["youtube", "tiktok", "whatnot"];
const LABEL: Record<Dest, string> = { youtube: "YouTube", tiktok: "TikTok", whatnot: "Whatnot", facebook: "Facebook" };

type NowSelling = { slug: string; name: string; currentIndex: number; total: number; currentTitle: string | null };

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
  const [sel, setSel] = useState<Record<Dest, boolean>>({ youtube: false, tiktok: false, whatnot: false, facebook: false });
  const [openStudio, setOpenStudio] = useState(false);
  const [selling, setSelling] = useState<NowSelling | null>(null);
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
      if (j.armed) setSel({ youtube: !!j.destinations.youtube?.enabled, tiktok: !!j.destinations.tiktok?.enabled, whatnot: !!j.destinations.whatnot?.enabled, facebook: !!j.destinations.facebook?.enabled });
    } catch (e) {
      setChecking(false);
      setOffline(e instanceof Error ? e.message : "network error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!authed) return;
    void load();
    const t = window.setInterval(() => { if (!document.hidden) void load(); }, 3000);
    return () => window.clearInterval(t);
  }, [authed, load]);

  // "Now selling" — the active product lineup, if the clicker is running one.
  useEffect(() => {
    if (!authed) return;
    let stop = false, polling = false;
    const tick = async () => {
      if (polling) return;
      polling = true;
      try {
        const r = await fetch("/api/stream-lineup", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!stop) setSelling(j.active ?? null);
      } catch { /* keep polling */ }
      finally { polling = false; }
    };
    void tick();
    const t = window.setInterval(() => void tick(), 10_000);
    return () => { stop = true; window.clearInterval(t); };
  }, [authed]);

  async function cmd(path: string, body?: unknown) {
    setBusy(path);
    try {
      const r = await fetch(`/api/stream/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      if (r.status === 401) { setAuthed(false); return; }
      const j = await r.json();
      if (!r.ok) setOffline(j.error || `HTTP ${r.status}`);
      else { setOffline(""); if (typeof j?.armed === "boolean") setStatus(j); else void load(); }
    } catch (e) {
      setOffline(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy("");
    }
  }

  function toggleDest(d: Dest) {
    const next = { ...sel, [d]: !sel[d] };
    setSel(next);
    if (status?.armed) void cmd("destinations", { [d]: next[d] });
  }

  // Hold-to-end: 1 s press so a pocket tap can't kill the live.
  function holdBegin() {
    if (holdTimer.current || busy || offline || !status?.armed) return;
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

  useEffect(() => {
    if (!status?.armed || busy || offline) holdEnd();
    return () => { if (holdTimer.current) window.clearInterval(holdTimer.current); };
  }, [status?.armed, busy, offline]);

  if (checking) {
    return <main style={S.wrap}><h1 style={S.h1}>House controls</h1><div style={{ color: "#9aa" }}>Loading…</div></main>;
  }

  if (!authed) {
    // Same gate as /hq: owner account + authenticator (NextAuth admin session). No PIN.
    return (
      <main style={S.wrap}>
        <h1 style={S.h1}>House controls</h1>
        <p style={{ color: "#9aa", fontSize: 15 }}>Use your owner account and authenticator to continue.</p>
        <a href="/login?callbackUrl=/stream" style={{ ...S.btn, ...S.primary, display: "block", textAlign: "center", textDecoration: "none" }}>Sign in securely</a>
      </main>
    );
  }

  const s = status;
  const cam = s?.camera;
  const dgxDown = !!offline;
  const live = !!s?.armed;
  const onAirCam = s?.cameras?.find((c) => c.onAir);
  const studioLane = !!s && !s.destinations.tiktok?.configured; // TikTok goes out through LIVE Studio on the PC

  return (
    <main style={S.wrap}>
      <style jsx>{`
        .tools { position: relative; }
        .tools summary { list-style: none; cursor: pointer; padding: 8px 12px; border: 1px solid #33465e; border-radius: 10px; color: #bdd1e5; font-size: 14px; }
        .tools summary::-webkit-details-marker { display: none; }
        .tools-menu { display: none; position: absolute; right: 0; top: 100%; width: min(320px, calc(100vw - 32px)); padding: 16px; border: 1px solid #33465e; border-radius: 12px; background: #152238; box-shadow: 0 12px 32px #0008; z-index: 10; }
        .tools[open] .tools-menu, .tools:hover .tools-menu, .tools:focus-within .tools-menu { display: grid; gap: 12px; }
        .tools-menu :global(a) { color: #bddfff; text-decoration: none; }
        .tools-menu :global(small) { display: block; color: #9ab; line-height: 1.5; margin-top: 4px; }
        button:disabled { opacity: .45; cursor: not-allowed; }
      `}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1 style={{ ...S.h1, fontSize: 20, margin: 0 }} aria-live="polite">{dgxDown ? "Status unavailable" : broadcastLabel(s)}</h1>
        <details className="tools"
          onPointerEnter={e => { if (e.pointerType === "mouse") e.currentTarget.open = true; }}
          onPointerLeave={e => { if (e.pointerType === "mouse" && !e.currentTarget.contains(document.activeElement)) e.currentTarget.open = false; }}
          onFocus={e => { if ((e.target as HTMLElement).matches(":focus-visible")) e.currentTarget.open = true; }}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) e.currentTarget.open = false; }}
          onKeyDown={e => { if (e.key === "Escape") { e.currentTarget.open = false; (document.activeElement as HTMLElement)?.blur(); } }}>
          <summary aria-label="Help and tools">Help &amp; tools</summary>
          <nav className="tools-menu" aria-label="Show tools">
            <p style={{ margin: 0, fontSize: 13, color: "#bcc", lineHeight: 1.6 }}>Sending video does not confirm a platform is live. Confirm Whatnot in Seller Hub.</p>
            <Link href="/stream/growth">Schedule, clips &amp; profit →</Link>
            <Link href="/stream/coach">Stream Coach ✦</Link>
            <Link href="/stream/stock">Stock &amp; sourcing →</Link>
            <Link href="/stream/slideshow">Product display →<small>Optional product cards for OBS, a phone, or a TV.</small></Link>
            <Link href="/stream/guide">Setup &amp; troubleshooting →</Link>
          </nav>
        </details>
      </div>

      {dgxDown && <div role="alert" style={S.banner}>Could not refresh house status: {offline}</div>}

      {/* House controls come first. Arming still uses the selected destinations. */}
      <div style={{ display: "grid", gap: 10 }}>
        {!live ? (
          <button style={{ ...S.btn, ...S.primary }} disabled={!s || !!busy || dgxDown} onClick={() => cmd("go-live", { destinations: { ...sel, facebook: false }, studio: openStudio })}>
            {busy === "go-live" ? "Arming…" : "▶ Arm house"}
          </button>
        ) : (
          <>
            <button style={{ ...S.btn, ...(s?.privacy ? S.warnOn : S.secondary) }} disabled={!!busy || dgxDown} onClick={() => cmd("privacy", { on: !s?.privacy })}>
              {s?.privacy ? "🔒 Privacy ON — tap to resume" : "🔒 Privacy"}
            </button>
            <button style={{ ...S.btn, ...S.danger, background: `linear-gradient(90deg,#c0392b ${holdPct}%,#5a1f1a ${holdPct}%)` }}
              onPointerDown={holdBegin} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd} onBlur={holdEnd}
              onKeyDown={e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); holdBegin(); } }}
              onKeyUp={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); holdEnd(); } }}
              disabled={!!busy || dgxDown}>
              {busy === "end" ? "Ending…" : "■ Hold to END STREAM"}
            </button>
            <small style={{ color: "#9ab" }}>End your platform shows before ending the house.</small>
          </>
        )}
      </div>

      {selling && (
        <a href={`/stream/products/${selling.slug}`} style={S.selling}>
          🛒 Now selling: <b>{selling.currentTitle || "—"}</b> ({Math.min(selling.currentIndex + 1, selling.total)}/{selling.total})
        </a>
      )}

      <CamSwitcher cameras={s?.cameras ?? null} armed={live} onStatus={(j) => { const st = j as Status; if (typeof st?.armed === "boolean") setStatus(st); }} />

      {/* destinations */}
      <div style={{ display: "flex", gap: 8, margin: "14px 0" }}>
        {DESTS.filter((d) => !(s && !s.destinations[d]) && !(d === "tiktok" && s && !s.destinations.tiktok?.configured) && !(d === "whatnot" && !s?.destinations.whatnot?.configured)).map((d) => (
          <button key={d} onClick={() => toggleDest(d)} disabled={!!busy || dgxDown || !s?.destinations[d]?.configured}
            style={{ ...S.chip, ...(sel[d] ? S.chipOn : {}), opacity: s?.destinations[d]?.configured ? 1 : 0.4 }}>
            {sel[d] ? "✓ " : ""}{LABEL[d]}
          </button>
        ))}
      </div>

      <FacebookLive meta={s?.facebook} armed={live} programReady={!!s?.obs.programReady}
        enabled={!!s?.destinations.facebook?.enabled} sending={!!s?.destinations.facebook?.running} keyTail={s?.destinations.facebook?.keyTail} refresh={load} available={!dgxDown} />

      <div style={{ display: "flex", margin: "18px 0" }}>
        <Link href="/stream/assistant" style={{ ...S.btn, ...S.secondary, width: "100%", textAlign: "center", textDecoration: "none", padding: "14px 16px", fontSize: 16 }}>Show Assistant</Link>
      </div>

      <details style={{ margin: "16px 0", color: "#bcc", fontSize: 14, lineHeight: 1.6 }}>
        <summary style={{ cursor: "pointer", color: "#cdb8ee" }}>Whatnot setup</summary>
        <ol style={{ paddingLeft: 20 }}>
          <li>Arm the house with destinations off. Start the camera and check picture and sound in Windows OBS.</li>
          <li>Open the Windows stream PC. In OBS choose <b>Whatnot Live (Recommended)</b>. In Chrome open Seller Hub → Show OBS Tools → Connect.</li>
          <li>Choose tonight&apos;s show and click <b>Start Show</b>. Keep that tab open. Confirm the show is live in Whatnot.</li>
        </ol>
        <a href="https://remotedesktop.google.com/access" target="_blank" rel="noopener noreferrer" style={{ color: "#bdddff" }}>Open Chrome Remote Desktop ↗</a>
      </details>

      {/* advanced */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 18 }}>
        <button onClick={() => setShowAdv((v) => !v)} style={S.link}>{showAdv ? "▾" : "▸"} House details</button>
        <Link href="/stream/products" style={{ color: "#8ab", fontSize: 14, textDecoration: "none" }}>🛒 Product lineups</Link>
      </div>
      {showAdv && s && (
        <div style={{ fontSize: 13, color: "#bcc", display: "grid", gap: 6 }}>
          <div style={S.grid}>
            <Tile label={onAirCam ? `Camera · ${onAirCam.label || `Cam ${onAirCam.slot}`}` : "Camera"} ok={!!cam?.connected} text={cam?.connected ? `${onAirCam?.kbps ?? cam.kbps} kbps · ${fmt(cam.sinceS)}` : "Disconnected"} />
            <Tile label="OBS" ok={!!s.obs.connected} text={`${s.obs.scene || "Unknown"}${s.obs.streaming ? " · encoding" : ""}`} />
            {DESTS.map(d => { const ds = s.destinations[d]; return ds?.configured ? <Tile key={d} label={LABEL[d]} ok={ds.running} text={ds.running ? `Sending ${fmt(ds.uptimeS)}` : ds.enabled ? "Waiting" : "Off"} /> : null; })}
            <Tile label="NAS recording" ok={s.recording?.state === "recording"} text={s.recording ? `${s.recording.state}${s.recording.ageS !== null ? ` · updated ${s.recording.ageS}s ago` : ""}${s.recording.error ? ` · ${s.recording.error}` : ""}` : "Health not reported"} />
          </div>
          {!live && studioLane && <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0" }}>
            <input type="checkbox" checked={openStudio} onChange={e => setOpenStudio(e.target.checked)} /> Open TikTok LIVE Studio when arming
          </label>}
          <div>Mimo URL: <code>{s.ingest.url}</code> · key ends …{s.ingest.keyTail}</div>
          <div>Auto-end after camera gone {s.limits.camGoneEndMin} min · max {s.limits.maxStreamMin} min · BRB after {s.limits.brbAfterS}s</div>
          <div>PC poller: {s.studio.online ? `online (${s.studio.host})` : "offline"} · LIVE Studio {s.studio.studioRunning ? "running" : "closed"} · Ending here force-closes LIVE Studio</div>
          <div>MediaMTX {s.mediamtx.ok ? "ok" : "DOWN"} · program {s.obs.programReady ? "ready" : "idle"} {s.obs.lastError && `· OBS: ${s.obs.lastError}`}</div>
          {s.cameras?.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {s.cameras.map((c) => (
                <button key={c.slot} style={{ ...S.btn, ...S.secondary, padding: "10px", fontSize: 14, flex: 1 }} disabled={!!busy || live}
                  onClick={() => { if (window.confirm(`Rotate the key for camera ${c.slot}? That phone must be re-set up (new key goes to Telegram).`)) void cmd("rotate-key", { slot: c.slot }); }}>
                  🔑 Cam {c.slot}{c.keyTail ? ` …${c.keyTail}` : ""}
                </button>
              ))}
            </div>
          ) : (
            <button style={{ ...S.btn, ...S.secondary, padding: "10px" }} disabled={!!busy || live} onClick={() => { if (window.confirm("Rotate the camera key? You must re-enter it in the camera app (sent to Telegram).")) void cmd("rotate-key"); }}>
              🔑 Rotate camera key
            </button>
          )}
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
  wrap: { maxWidth: 480, boxSizing: "border-box", margin: "0 auto", padding: "16px 16px 40px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#eef", background: "#0b1220", minHeight: "100vh" },
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
  selling: { display: "block", margin: "12px 0 0", padding: "10px 12px", borderRadius: 10, background: "#16233a", color: "#dfe", fontSize: 14, textDecoration: "none" },
  link: { background: "none", border: "none", color: "#8ab", fontSize: 14, padding: 0, cursor: "pointer" },
};
