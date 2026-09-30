"use client";

import { useRef, useState } from "react";

export type FacebookMeta = { verified?: boolean; pageId?: string; pageName?: string; videoId?: string; title?: string; phase?: string; liveNow?: boolean | null; ingest?: "manual" | "graph"; goLive?: "" | "pending" | "live" | "failed"; goLiveError?: string; error?: string; checkedAt?: number };

const DEFAULT_SERVER = "rtmps://live-api-s.facebook.com:443/rtmp/";
const KEY_PATTERN = "FB-[0-9]{5,40}-[0-9]-[A-Za-z0-9_-]{8,200}";

export default function FacebookLive({ meta, armed, programReady, sending, enabled, keyTail, refresh }: {
  meta?: FacebookMeta; armed: boolean; programReady: boolean; sending: boolean; enabled: boolean; keyTail?: string; refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("Treasure Hauls live show");
  const [videoId, setVideoId] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [streamKey, setStreamKey] = useState("");
  const [backupKey, setBackupKey] = useState("");
  const [holdPct, setHoldPct] = useState(0);
  const holdTimer = useRef<number | null>(null);
  const holdStart = useRef(0);
  const fresh = !!meta?.verified && Date.now() / 1000 - (meta.checkedAt || 0) < 45;
  const keyed = fresh && meta?.phase === "KEYED"; // pasted Live Producer key; Meta shows the video only after it goes live
  const preview = fresh && (meta?.phase === "UNPUBLISHED" || keyed);
  const live = fresh && meta?.liveNow === true;
  async function action(path: string, body: unknown): Promise<boolean> {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/stream/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : result.error || "Facebook request failed");
      await refresh();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Facebook request failed"); return false; }
    finally { setBusy(false); }
  }
  // Hold-to-go-live: a one-second press (same as END STREAM) so a pocket tap cannot publish a show.
  function holdEnd() {
    if (holdTimer.current) window.clearInterval(holdTimer.current);
    holdTimer.current = null;
    setHoldPct(0);
  }
  function holdBegin() {
    holdStart.current = Date.now();
    holdTimer.current = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - holdStart.current) / 1000) * 100);
      setHoldPct(p);
      if (p >= 100) { holdEnd(); void action("facebook/golive", { confirm: true, title }); }
    }, 50);
  }
  const goingLive = fresh && meta?.goLive === "pending";
  const canGoLive = fresh && armed && programReady && !live && !goingLive && !busy;
  const goLiveHelp = !meta ? "" : live ? "Live on Facebook. Viewers see the house program; end it here when the show is over."
    : goingLive ? `Sending to Facebook and publishing as soon as Facebook receives video (up to about two minutes).${meta.goLiveError ? " " + meta.goLiveError : ""}`
    : !fresh ? "Facebook status is unverified; wait for the next check." : !armed ? "Arm the house first." : !programReady ? "Waiting for the house picture."
    : keyed ? "Ready. Going live here makes a Spark Facebook show and publishes it; the pasted Live Producer key is set aside." : "Ready. One hold creates the Facebook show, sends the house feed and publishes it. Nothing else to click in Facebook.";
  async function applyKey() {
    if (await action("facebook/key", { server, key: streamKey, backup: backupKey })) { setStreamKey(""); setBackupKey(""); }
  }
  const button = { background: "#193b66", color: "#eaf3ff", border: "1px solid #416c9b", borderRadius: 8, padding: "11px 12px", fontSize: 14, cursor: "pointer" };
  const input = { width: "100%", boxSizing: "border-box" as const, background: "#111a2b", color: "#eef", border: "1px solid #456", borderRadius: 8, padding: 10, fontSize: 14 };
  return <section aria-labelledby="facebook-heading" style={{ margin: "14px 0", padding: 16, border: "1px solid #416c9b", borderRadius: 12, fontSize: 14, lineHeight: 1.5 }}>
    <style jsx>{`button:disabled { opacity: 0.45; cursor: not-allowed; }`}</style>
    <h2 id="facebook-heading" style={{ margin: 0, fontSize: 18 }}>Facebook LIVE</h2>
    <p style={{ margin: "6px 0" }}>{meta?.pageName || "Treasure Hauls Facebook Page"} · <b>{!meta ? "Setup unavailable" : !fresh ? "Status unverified" : live ? "Live on Facebook" : keyed ? "Stream key loaded" : preview ? "Unpublished preview" : "Offline"}</b></p>
    <p style={{ color: "#bcc" }}>1. Create a preview here, or paste the stream key from Live Producer (below). 2. Arm the house with destinations off and check the camera. 3. Send the feed, check it in Facebook Live Producer, then click <b>Go live there when ready</b>.</p>
    <label>Show title<input aria-label="Facebook show title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} style={input} /></label>
    <div style={{ marginTop: 10 }}>
      {!live && <button style={{ ...button, width: "100%", padding: "16px 12px", fontSize: 17, fontWeight: 700, touchAction: "none", border: "1px solid #3b82f6", background: `linear-gradient(90deg,#1877f2 ${holdPct}%,#123c78 ${holdPct}%)` }}
        disabled={!canGoLive} onPointerDown={holdBegin} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}>
        {goingLive ? "Going live on Facebook…" : "● Hold to GO LIVE on Facebook"}</button>}
      {live && <button style={{ ...button, width: "100%", padding: "14px 12px", fontSize: 16, background: "#5a1f1a", border: "1px solid #c0392b" }} disabled={busy}
        onClick={() => { if (window.confirm("End the Facebook show for viewers and stop sending to Facebook?")) void action("facebook/end", {}); }}>■ End Facebook show</button>}
      <p style={{ color: "#9ab", margin: "6px 0" }}>{goLiveHelp}</p>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      <button style={button} disabled={busy || !meta || enabled || live} onClick={() => void action("facebook/prepare", { title })}>{busy ? "Working…" : preview && !keyed ? "Refresh preview" : "Create Facebook preview"}</button>
      <button style={button} disabled={busy || !preview || !armed || !programReady || enabled} onClick={() => void action("facebook/send", { videoId: meta?.videoId })}>{keyed ? "Send house feed to Live Producer" : "Send house feed to preview"}</button>
      {live && !enabled && <button style={button} disabled={busy || !armed || !programReady} onClick={() => {
        if (window.confirm("This Facebook show is already public. Resume sending the house picture and audio to it?")) void action("facebook/send", { videoId: meta?.videoId, confirmLive: meta?.videoId });
      }}>Resume public Facebook feed</button>}
      {enabled && <button style={button} disabled={busy} onClick={() => void action("destinations", { facebook: false })}>Stop Facebook sender</button>}
    </div>
    <p style={{ marginBottom: 4 }}><a href="https://www.facebook.com/live/producer/?page_id=1156652300855210" target="_blank" rel="noopener noreferrer" style={{ color: "#bdddff" }}>Open Facebook Live Producer ↗</a></p>
    <p style={{ color: "#bcc", margin: "6px 0" }}>{sending ? "House feed is sending. Check picture and audio in Live Producer." : enabled ? "Sender is waiting for the house feed." : "Facebook sender is off."} Creating a preview does not start a public show. End the Facebook show in Live Producer before ending the house.</p>
    {!enabled && <p style={{ color: "#9ab", margin: "6px 0" }}>{!armed ? "Arm the house below to enable sending the preview." : !programReady ? "Waiting for the house program before sending." : "House program is ready to send."}</p>}
    {meta?.videoId && <p style={{ color: "#9ab", margin: "6px 0", overflowWrap: "anywhere" }}>Selected show: {meta.title || meta.videoId} · ID {meta.videoId}{keyTail ? ` · key …${keyTail}` : ""}{keyed ? " · Facebook lists this show here only after you go live in Live Producer." : ""}</p>}
    {(error || meta?.error || (meta?.goLive === "failed" && meta.goLiveError)) && <p role="alert" style={{ color: "#ffd3bc" }}>{error || meta?.error || meta?.goLiveError}</p>}
    <button style={{ background: "none", border: 0, color: "#bdddff", padding: "8px 0" }} onClick={() => setAdvanced(!advanced)}>{advanced ? "Hide" : "Use a show made in Facebook"}</button>
    {advanced && <form onSubmit={e => { e.preventDefault(); void action("facebook/select", { videoId }); }}>
      <label>Live-video ID from Live Producer<input aria-label="Facebook live-video ID" value={videoId} onChange={e => setVideoId(e.target.value)} inputMode="numeric" pattern="[0-9]{5,40}" required style={input} /></label>
      <button style={{ ...button, marginTop: 8 }} disabled={busy || enabled || !meta}>Select show</button>
      <p style={{ color: "#9ab" }}>Use this for an existing live show whose comments you want to follow. Only the bound Treasure Hauls Page is accepted. A show made in Live Producer is not visible here until it is live; paste its stream key instead.</p>
    </form>}
    {advanced && <form onSubmit={e => { e.preventDefault(); void applyKey(); }} style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #2b3f5c" }}>
      <p style={{ margin: "0 0 6px" }}><b>Paste stream key from Live Producer</b></p>
      <label>Server URL<input aria-label="Facebook server URL" value={server} onChange={e => setServer(e.target.value)} required pattern="rtmps://[^\s]+" style={input} /></label>
      <label>Stream key<input aria-label="Facebook stream key" type="password" autoComplete="off" value={streamKey} onChange={e => setStreamKey(e.target.value.trim())} required pattern={KEY_PATTERN} placeholder="FB-…" style={input} /></label>
      <label>Backup stream key (optional)<input aria-label="Facebook backup stream key" type="password" autoComplete="off" value={backupKey} onChange={e => setBackupKey(e.target.value.trim())} pattern={KEY_PATTERN} style={input} /></label>
      <button style={{ ...button, marginTop: 8 }} disabled={busy || enabled || !meta}>Use this stream key</button>
      <p style={{ color: "#9ab" }}>In Live Producer choose Go live → Streaming software and copy the Server URL and Stream key here. The key stays on the Spark and is shown above only by its last characters. Facebook allows about four hours between the first preview and going live; if Live Producer reset the key, paste the new one. Stop the Facebook sender before changing keys.</p>
    </form>}
  </section>;
}
