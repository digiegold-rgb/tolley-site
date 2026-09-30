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

type ChatMsg = { id: number; t: number; p: "yt" | "tt" | "fb"; source?: string; eventId?: string; u: string; m: string; k: "chat" | "gift" | "join"; amt?: string };
type ChatState = { epoch?: string; reset?: boolean; sources?: Partial<Record<ChatMsg["p"], string>>; facebook?: FacebookMeta & { connected: boolean }; items: ChatMsg[]; last: number; youtube?: { connected: boolean; video: string; error: string }; tiktok?: { connected: boolean; user: string; error: string; viewers: number }; error?: string };

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
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatMeta, setChatMeta] = useState<ChatState | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showJoins, setShowJoins] = useState(false);
  const chatLast = useRef(0);
  const chatEpoch = useRef("");
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

  // Live chat: merged YouTube + Facebook + TikTok feed, polled every 2 s while signed in.
  useEffect(() => {
    if (!authed) return;
    let stop = false, polling = false;
    const tick = async () => {
      if (polling) return;
      polling = true;
      try {
        const r = await fetch(`/api/stream/chat?since=${chatLast.current}&limit=80&epoch=${encodeURIComponent(chatEpoch.current)}`, { cache: "no-store" });
        if (!r.ok) throw new Error("Chat unavailable");
        const j: ChatState = await r.json();
        if (stop) return;
        setChatMeta(j);
        const reset = !!j.reset || !!(j.epoch && chatEpoch.current && j.epoch !== chatEpoch.current);
        if (j.epoch) chatEpoch.current = j.epoch;
        chatLast.current = j.last;
        setChat(prev => {
          const retained = (reset ? [] : prev).filter(m => !j.sources || !m.source || m.source === j.sources[m.p]);
          const seen = new Set(retained.map(m => `${m.p}:${m.source}:${m.eventId || m.id}`));
          return [...retained, ...(j.items || []).filter(m => {
            const key = `${m.p}:${m.source}:${m.eventId || m.id}`;
            if (seen.has(key)) return false;
            seen.add(key); return true;
          })].slice(-300);
        });
      } catch { setChatMeta(prev => prev ? { ...prev, error: "Chat connection interrupted; reconnecting…" } : { items: [], last: 0, error: "Chat connection interrupted; reconnecting…" }); }
      finally { polling = false; }
    };
    void tick();
    const t = window.setInterval(() => { if (!stop && !document.hidden) void tick(); }, 2000);
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
    if (status?.armed) void cmd("destinations", { [d]: next[d] });
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
        <span style={{ fontSize: 13, color: "#9aa" }}>{dgxDown ? "Status unavailable" : broadcastLabel(s)}</span>
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
            text={!ds ? "—" : !ds.configured ? "no key" : ds.running ? `sending ${fmt(ds.uptimeS)}` : ds.enabled ? "waiting" : "off"} />;
        })}
      </div>

      <div style={{ margin: "14px 0" }}><a href="/stream/assistant" style={{ display: "inline-block", padding: "12px 18px", border: "1px solid #63c9a4", borderRadius: 8 }}>Show Assistant</a><span style={{ marginLeft: 12, color: "#9ab", fontSize: 13 }}>Greetings, thank-yous &amp; inventory answers</span></div>
      <p style={{ fontSize: 13, color: "#9ab", lineHeight: 1.6 }}>Sending video does not confirm a platform is live. Confirm Whatnot in Seller Hub. <Link href="/stream/growth">Schedule, clips & profit →</Link> · <Link href="/stream/coach">Stream Coach ✦</Link> · <Link href="/stream/stock">Stock & sourcing →</Link></p>
      <Link href="/stream/slideshow" style={S.selling}>▷ Whatnot product slideshow — OBS, phone, or TV</Link>
      <div style={{ marginBottom: 12 }}><Tile label="NAS recording" ok={s?.recording?.state === "recording"} text={s?.recording ? `${s.recording.state}${s.recording.ageS !== null ? ` · updated ${s.recording.ageS}s ago` : ""}${s.recording.error ? ` · ${s.recording.error}` : ""}` : "Health not reported"}/></div>

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

      <FacebookLive meta={s?.facebook} armed={live} programReady={!!s?.obs.programReady}
        enabled={!!s?.destinations.facebook?.enabled} sending={!!s?.destinations.facebook?.running} refresh={load} />

      {/* Whatnot streams over WHIP through ITS OWN Show Tools page driving a local OBS (no RTMP key), so it is not a pusher here:
          the OBS on the wired Windows stream PC already shows the house program feed, and Whatnot's page points that OBS at the show. */}
      <section aria-labelledby="whatnot-start-heading" style={{ margin: "-4px 0 14px", padding: 16, border: "1px solid #66508a", borderRadius: 12, fontSize: 14, color: "#dce" }}>
        <h2 id="whatnot-start-heading" style={{ margin: 0, fontSize: 18 }}>🟣 Start tonight&apos;s Whatnot show</h2>
        <div style={{ display: "grid", gap: 6, marginTop: 8, lineHeight: 1.5 }}>
          <span>1. <b>Arm house</b> with destinations off and LIVE Studio unchecked. Start the camera; check picture and audio in Windows OBS.</span>
          <span>2. Remote into the <b>Windows stream PC</b>. In OBS select <b>Whatnot Live (Recommended)</b>. In Chrome open Whatnot Seller Hub → Show OBS Tools → Connect.</span>
          <span>3. Select <b>tonight&apos;s show</b> and click <b>Start Show in Show Tools</b>. Keep that tab open. No show key needs to be pasted here.</span>
          <span>Arming the house does not start Whatnot. End the show in Whatnot first, then hold END STREAM here.</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, margin: "6px 0" }}>
            <a href="https://remotedesktop.google.com/access" target="_blank" rel="noopener noreferrer" style={{ color: "#bdddff", textDecoration: "underline" }}>Open Chrome Remote Desktop ↗</a>
            <Link href="/stream/guide" style={{ color: "#bdddff", textDecoration: "underline" }}>Setup, delay test & troubleshooting →</Link>
          </div>
          <span>Product slides for OBS, a phone, or a TV (no login): <Link href="/stream/slideshow">open the slideshow</Link> — <code>https://www.tolley.io/stream/slideshow</code>. Add <code>?bg=transparent</code> in the OBS Browser Source if the page background should drop out. Tonight&apos;s list is <code>public/stream/shows/tonight.json</code>.</span>
        </div>
      </section>

      {!live && studioLane && s?.cameras && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#bcc", margin: "0 0 12px" }}>
          <input type="checkbox" checked={openStudio} onChange={(e) => setOpenStudio(e.target.checked)} />
          Open TikTok LIVE Studio on the PC
        </label>
      )}

      {/* main controls */}
      <div style={{ display: "grid", gap: 12 }}>
        {!live ? (
          <button style={{ ...S.btn, ...S.primary }} disabled={!!busy || dgxDown} onClick={() => cmd("go-live", { destinations: { ...sel, facebook: false }, studio: openStudio })}>
            {busy === "go-live" ? "…" : "▶ Arm house"}
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

      <p style={{ color: "#9ab", fontSize: 13, marginTop: 18 }}>Combined live chat: YouTube, Facebook and TikTok. Facebook follows the selected show above. YouTube is connected to Digital Gold Jelly Studio. Keep Whatnot chat open in Seller Hub. <Link href="/stream/guide">Streaming guide →</Link></p>
      {/* live chat (YouTube + Facebook + TikTok merged) */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: "#8a9", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Chat ·
            <span style={{ color: chatMeta?.youtube?.connected ? "#2ecc71" : "#667" }}> ▶ YT</span>
            <span style={{ color: chatMeta?.facebook?.connected ? "#2ecc71" : "#667" }}> f FB</span>
            <span style={{ color: chatMeta?.tiktok?.connected ? "#2ecc71" : "#667" }}> ♪ TT{chatMeta?.tiktok?.connected && chatMeta.tiktok.viewers ? ` ${chatMeta.tiktok.viewers}👀` : ""}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={S.link} onClick={() => setShowJoins((v) => !v)}>{showJoins ? "hide joins" : "show joins"}</button>
            <button style={S.link} onClick={() => setChatOpen((v) => !v)}>{chatOpen ? "▾ small" : "▴ full screen"}</button>
          </div>
        </div>
        {(chatMeta?.error || chatMeta?.facebook?.error) && <p role="status" style={{ color: "#ffd3bc", fontSize: 13 }}>{chatMeta.error || chatMeta.facebook?.error}</p>}
        <div ref={chatBox} style={{ ...S.chat, height: chatOpen ? "70vh" : 220 }}>
          {chat.filter((c) => showJoins || c.k !== "join").length === 0 && (
            <div style={{ color: "#667", fontSize: 14 }}>{chatMeta?.error ? chatMeta.error : "No messages yet. Messages appear when the selected platform shows are live and viewers comment."}</div>
          )}
          {chat.filter((c) => showJoins || c.k !== "join").map((c) => (
            <div key={`${c.p}-${c.id}`} title={c.source || ""} style={{ ...S.msg, ...(c.k === "gift" ? S.msgGift : {}) }}>
              <span style={{ color: c.p === "yt" ? "#ff5c5c" : c.p === "fb" ? "#82b8ff" : "#69e0ff", fontWeight: 700 }}>{c.p === "yt" ? "YouTube" : c.p === "fb" ? "Facebook" : "TikTok"} </span>
              <time dateTime={new Date(c.t * 1000).toISOString()} style={{ fontSize: 11, color: "#9ab" }}>{new Date(c.t * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} </time>
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
