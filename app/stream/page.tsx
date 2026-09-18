"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import CamSwitcher, { type StreamCam } from "@/components/stream/CamSwitcher";

// tolley.io/stream — one-handed phone remote for the house live pipeline.
// Gated like /hq: owner NextAuth session + MFA (validateWdAdmin). Commands go through /api/stream/* → DGX director.
// tolley.io stores no stream keys.

type Dest = "youtube" | "tiktok" | "whatnot";
type DestState = { enabled: boolean; configured: boolean; running: boolean; uptimeS: number; keyTail?: string };
type Status = {
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

type ChatMsg = { id: number; t: number; p: "yt" | "tt"; u: string; m: string; k: "chat" | "gift" | "join"; amt?: string };
type ChatState = { items: ChatMsg[]; last: number; youtube?: { connected: boolean; video: string; error: string }; tiktok?: { connected: boolean; user: string; error: string; viewers: number }; error?: string };

const DESTS: Dest[] = ["youtube", "tiktok", "whatnot"];
const LABEL: Record<Dest, string> = { youtube: "YouTube", tiktok: "TikTok", whatnot: "Whatnot" };

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
  const [sel, setSel] = useState<Record<Dest, boolean>>({ youtube: true, tiktok: false, whatnot: false });
  const [openStudio, setOpenStudio] = useState(true);
  const [selling, setSelling] = useState<NowSelling | null>(null);
  const [holdPct, setHoldPct] = useState(0);
  const [showAdv, setShowAdv] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatMeta, setChatMeta] = useState<ChatState | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showJoins, setShowJoins] = useState(false);
  const chatLast = useRef(0);
  const chatBox = useRef<HTMLDivElement | null>(null);
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
      if (j.armed) setSel({ youtube: !!j.destinations.youtube?.enabled, tiktok: !!j.destinations.tiktok?.enabled, whatnot: !!j.destinations.whatnot?.enabled });
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

  // "Now selling" — the active product lineup, if the clicker is running one.
  useEffect(() => {
    if (!authed) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/stream-lineup", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!stop) setSelling(j.active ?? null);
      } catch { /* keep polling */ }
    };
    void tick();
    const t = window.setInterval(() => void tick(), 10_000);
    return () => { stop = true; window.clearInterval(t); };
  }, [authed]);

  // Live chat: merged YouTube + TikTok feed, polled every 2 s while signed in.
  useEffect(() => {
    if (!authed) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/stream/chat?since=${chatLast.current}&limit=80`, { cache: "no-store" });
        if (!r.ok) return;
        const j: ChatState = await r.json();
        setChatMeta(j);
        if (j.items?.length) {
          chatLast.current = j.last;
          setChat((prev) => [...prev, ...j.items].slice(-300));
        }
      } catch { /* keep polling */ }
    };
    void tick();
    const t = window.setInterval(() => { if (!stop) void tick(); }, 2000);
    return () => { stop = true; window.clearInterval(t); };
  }, [authed]);
  useEffect(() => { const el = chatBox.current; if (el) el.scrollTop = el.scrollHeight; }, [chat, chatOpen]);

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
  const onAirCam = s?.cameras?.find((c) => c.onAir);
  const studioLane = !!s && !s.destinations.tiktok?.configured; // TikTok goes out through LIVE Studio on the PC

  return (
    <main style={S.wrap}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={S.h1}>📡 Stream</h1>
        <span style={{ fontSize: 13, color: "#9aa" }}>{live ? `LIVE ${fmt(s!.liveSinceS)}` : "off air"}</span>
      </div>

      {dgxDown && <div style={S.banner}>DGX unreachable: {offline}</div>}

      {/* status strip */}
      <div style={S.grid}>
        <Tile label={onAirCam ? `Camera · ${onAirCam.label || `Cam ${onAirCam.slot}`}` : "Camera"} ok={!!cam?.connected} text={cam?.connected ? `${onAirCam?.kbps ?? cam.kbps} kbps · ${fmt(cam.sinceS)}` : cam ? `gone ${fmt(cam.goneS)}` : "—"} />
        <Tile label="OBS" ok={!!s?.obs.connected} text={s ? `${s.obs.scene || "?"}${s.obs.streaming ? " · encoding" : ""}` : "—"} />
        {DESTS.map((d) => {
          // TikTok without a stream key runs through LIVE Studio on the PC: show the poller heartbeat instead.
          const ds = s?.destinations[d];
          if (s && !ds) return null; // older director: no such destination
          if (d === "whatnot" && !ds?.configured) return null; // Whatnot runs through the stream PC's OBS (WHIP), not a pusher
          if (d === "tiktok" && s && !ds?.configured) {
            const st = s.studio;
            return <Tile key={d} label="TikTok · LIVE Studio" ok={st.online && st.studioRunning}
              text={!st.online ? (st.ageS < 0 ? "PC not set up" : `PC offline ${fmt(st.ageS)}`) : st.studioRunning ? "LIVE Studio open" : st.obsRunning ? "PC ready · open LIVE Studio" : "PC on · OBS down"} />;
          }
          return <Tile key={d} label={LABEL[d]} ok={!!ds?.running} dim={!ds?.configured}
            text={!ds ? "—" : !ds.configured ? "no key" : ds.running ? `live ${fmt(ds.uptimeS)}` : ds.enabled ? "waiting" : "off"} />;
        })}
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
          <button key={d} onClick={() => toggleDest(d)} disabled={!s?.destinations[d]?.configured}
            style={{ ...S.chip, ...(sel[d] ? S.chipOn : {}), opacity: s?.destinations[d]?.configured ? 1 : 0.4 }}>
            {sel[d] ? "✓ " : ""}{LABEL[d]}
          </button>
        ))}
      </div>

      {/* Whatnot streams over WHIP through ITS OWN Show Tools page driving a local OBS (no RTMP key), so it is not a pusher here:
          the OBS on the wired Windows stream PC already shows the house program feed, and Whatnot's page points that OBS at the show. */}
      <details style={{ margin: "-4px 0 14px", fontSize: 13, color: "#bcc" }}>
        <summary style={{ cursor: "pointer" }}>🟣 Whatnot — goes out through the OBS on the stream PC</summary>
        <div style={{ display: "grid", gap: 6, marginTop: 8, lineHeight: 1.5 }}>
          <span>1. Here: <b>Go Live</b> with nothing ticked (LIVE Studio off) and start the cameras — the PC&apos;s OBS then shows the house picture (cuts, BRB and Privacy ride along).</span>
          <span>2. On the PC (Chrome Remote Desktop), in Chrome: Whatnot Seller Hub → Show OBS Tools → Connect → <b>Start Show</b>. Connect only right before the show; keep that tab open.</span>
          <span>3. Run the show from the Mac or the Whatnot app. End it in Whatnot first, then hold END STREAM here.</span>
        </div>
      </details>

      {!live && studioLane && s?.cameras && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#bcc", margin: "0 0 12px" }}>
          <input type="checkbox" checked={openStudio} onChange={(e) => setOpenStudio(e.target.checked)} />
          Open TikTok LIVE Studio on the PC
        </label>
      )}

      {/* main controls */}
      <div style={{ display: "grid", gap: 12 }}>
        {!live ? (
          <button style={{ ...S.btn, ...S.primary }} disabled={!!busy || dgxDown} onClick={() => cmd("go-live", { destinations: sel, studio: openStudio })}>
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

      {/* live chat (YouTube + TikTok merged) */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: "#8a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Chat ·
            <span style={{ color: chatMeta?.youtube?.connected ? "#2ecc71" : "#667" }}> ▶ YT</span>
            <span style={{ color: chatMeta?.tiktok?.connected ? "#2ecc71" : "#667" }}> ♪ TT{chatMeta?.tiktok?.connected && chatMeta.tiktok.viewers ? ` ${chatMeta.tiktok.viewers}👀` : ""}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={S.link} onClick={() => setShowJoins((v) => !v)}>{showJoins ? "hide joins" : "show joins"}</button>
            <button style={S.link} onClick={() => setChatOpen((v) => !v)}>{chatOpen ? "▾ small" : "▴ full screen"}</button>
          </div>
        </div>
        <div ref={chatBox} style={{ ...S.chat, height: chatOpen ? "70vh" : 220 }}>
          {chat.filter((c) => showJoins || c.k !== "join").length === 0 && (
            <div style={{ color: "#667", fontSize: 14 }}>{chatMeta?.error ? chatMeta.error : "No messages yet. YouTube connects when a live is found; TikTok when @digiegold is live."}</div>
          )}
          {chat.filter((c) => showJoins || c.k !== "join").map((c) => (
            <div key={`${c.p}-${c.id}`} style={{ ...S.msg, ...(c.k === "gift" ? S.msgGift : {}) }}>
              <span style={{ color: c.p === "yt" ? "#ff5c5c" : "#69e0ff", fontWeight: 700 }}>{c.p === "yt" ? "▶" : "♪"} </span>
              <span style={{ color: "#dfe", fontWeight: 600 }}>{c.u}</span>
              {c.k === "gift" && <span style={{ color: "#f5c542" }}> 🎁 {c.amt}</span>}
              <span style={{ color: c.k === "join" ? "#889" : "#fff" }}> {c.m}</span>
            </div>
          ))}
        </div>
      </div>

      {/* advanced */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 18 }}>
        <button onClick={() => setShowAdv((v) => !v)} style={S.link}>{showAdv ? "▾" : "▸"} advanced</button>
        <Link href="/stream/products" style={{ color: "#8ab", fontSize: 14, textDecoration: "none" }}>🛒 Product lineups</Link>
      </div>
      {showAdv && s && (
        <div style={{ fontSize: 13, color: "#bcc", display: "grid", gap: 6 }}>
          <div>Mimo URL: <code>{s.ingest.url}</code> · key ends …{s.ingest.keyTail}</div>
          <div>Auto-end after camera gone {s.limits.camGoneEndMin} min · max {s.limits.maxStreamMin} min · BRB after {s.limits.brbAfterS}s</div>
          <div>PC poller: {s.studio.online ? `online (${s.studio.host})` : "offline"} · LIVE Studio {s.studio.studioRunning ? "running" : "closed"} · Ending here force-closes LIVE Studio</div>
          <div>Chat YT: {chatMeta?.youtube?.video || "searching for a live…"} {chatMeta?.youtube?.error && `· ${chatMeta.youtube.error}`} · TT: {chatMeta?.tiktok?.error || (chatMeta?.tiktok?.connected ? "connected" : "not live")}</div>
          <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = (f.elements.namedItem("yturl") as HTMLInputElement).value; void fetch("/api/stream/chat/youtube", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: v }) }); }} style={{ display: "flex", gap: 6 }}>
            <input name="yturl" placeholder="paste YouTube live URL if chat can't find it" style={{ flex: 1, fontSize: 13, padding: 8, borderRadius: 8, border: "1px solid #334", background: "#111a2b", color: "#eef" }} />
            <button type="submit" style={{ ...S.btn, ...S.secondary, padding: "8px 10px", fontSize: 13 }}>set</button>
          </form>
          <form onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; const v = (f.elements.namedItem("ttuser") as HTMLInputElement).value; void fetch("/api/stream/chat/tiktok", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user: v }) }); }} style={{ display: "flex", gap: 6 }}>
            <input name="ttuser" placeholder={`TikTok @handle to follow (now @${chatMeta?.tiktok?.user || "digiegold"})`} style={{ flex: 1, fontSize: 13, padding: 8, borderRadius: 8, border: "1px solid #334", background: "#111a2b", color: "#eef" }} />
            <button type="submit" style={{ ...S.btn, ...S.secondary, padding: "8px 10px", fontSize: 13 }}>set</button>
          </form>
          <div>MediaMTX {s.mediamtx.ok ? "ok" : "DOWN"} · program {s.obs.programReady ? "ready" : "idle"} {s.obs.lastError && `· OBS: ${s.obs.lastError}`}</div>
          {s.cameras?.length ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {s.cameras.map((c) => (
                <button key={c.slot} style={{ ...S.btn, ...S.secondary, padding: "10px", fontSize: 14, flex: 1 }} disabled={!!busy}
                  onClick={() => { if (window.confirm(`Rotate the key for camera ${c.slot}? That phone must be re-set up (new key goes to Telegram).`)) void cmd("rotate-key", { slot: c.slot }); }}>
                  🔑 Cam {c.slot}{c.keyTail ? ` …${c.keyTail}` : ""}
                </button>
              ))}
            </div>
          ) : (
            <button style={{ ...S.btn, ...S.secondary, padding: "10px" }} disabled={!!busy} onClick={() => { if (window.confirm("Rotate the camera key? You must re-enter it in the camera app (sent to Telegram).")) void cmd("rotate-key"); }}>
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
  input: { fontSize: 14, padding: 10, borderRadius: 8, border: "1px solid #334", background: "#111a2b", color: "#eef" },
  selling: { display: "block", margin: "12px 0 0", padding: "10px 12px", borderRadius: 10, background: "#16233a", color: "#dfe", fontSize: 14, textDecoration: "none" },
  link: { background: "none", border: "none", color: "#8ab", fontSize: 14, padding: 0, cursor: "pointer" },
  chat: { background: "#0e1626", border: "1px solid #223", borderRadius: 12, padding: "8px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 },
  msg: { fontSize: 17, lineHeight: 1.3, wordBreak: "break-word" },
  msgGift: { background: "#2a2410", borderRadius: 8, padding: "4px 6px" },
};
