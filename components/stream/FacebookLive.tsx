"use client";

import { useEffect, useRef, useState } from "react";

export type FacebookMeta = { verified?: boolean; pageId?: string; pageName?: string; videoId?: string; title?: string; phase?: string; liveNow?: boolean | null; ingest?: "manual" | "graph"; goLive?: "" | "pending" | "live" | "failed"; goLiveError?: string; error?: string; checkedAt?: number };

const DEFAULT_SERVER = "rtmps://live-api-s.facebook.com:443/rtmp/";
const KEY_PATTERN = "FB-[0-9]{5,40}-[0-9]-[A-Za-z0-9_-]{8,200}";

export default function FacebookLive({ meta, armed, programReady, sending, enabled, keyTail, refresh, available = true }: {
  meta?: FacebookMeta; armed: boolean; programReady: boolean; sending: boolean; enabled: boolean; keyTail?: string; refresh: () => Promise<void>; available?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("Treasure Hauls live show");
  const [videoId, setVideoId] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [checkedPicture, setCheckedPicture] = useState(false);
  const [server, setServer] = useState(DEFAULT_SERVER);
  const [streamKey, setStreamKey] = useState("");
  const [backupKey, setBackupKey] = useState("");
  const [holdPct, setHoldPct] = useState(0);
  const holdTimer = useRef<number | null>(null);
  const holdStart = useRef(0);
  const fresh = available && !!meta?.verified && Date.now() / 1000 - (meta.checkedAt || 0) < 45;
  const keyed = fresh && meta?.phase === "KEYED"; // pasted Live Producer key; Meta shows the video only after it goes live
  const preview = fresh && (meta?.phase === "UNPUBLISHED" || keyed);
  const live = fresh && meta?.liveNow === true;
  async function action(path: string, body: unknown): Promise<boolean> {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/stream/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : result.error || "Facebook request failed");
      if (path === "facebook/golive" || path === "facebook/end") setCheckedPicture(false);
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
    if (!canGoLive || holdTimer.current) return;
    holdStart.current = Date.now();
    holdTimer.current = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - holdStart.current) / 1000) * 100);
      setHoldPct(p);
      if (p >= 100) { holdEnd(); void action("facebook/golive", { confirm: true, title }); }
    }, 50);
  }
  const goingLive = fresh && meta?.goLive === "pending";
  const manualSending = keyed && enabled;
  const canGoLive = fresh && armed && programReady && checkedPicture && !live && !goingLive && !manualSending && !busy;

  // A previous picture check cannot carry into a new house session or a disconnected feed.
  useEffect(() => { setCheckedPicture(false); }, [armed, programReady, meta?.videoId, available, fresh]);
  useEffect(() => {
    if (!canGoLive) holdEnd();
    return () => { if (holdTimer.current) window.clearInterval(holdTimer.current); };
  }, [canGoLive]);

  function keyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); if (canGoLive) holdBegin(); }
  }
  function keyUp(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); holdEnd(); }
  }
  async function applyKey() {
    if (await action("facebook/key", { server, key: streamKey, backup: backupKey })) { setStreamKey(""); setBackupKey(""); }
  }
  const button = { background: "#193b66", color: "#eaf3ff", border: "1px solid #416c9b", borderRadius: 8, padding: "11px 12px", fontSize: 14, cursor: "pointer" };
  const input = { width: "100%", boxSizing: "border-box" as const, background: "#111a2b", color: "#eef", border: "1px solid #456", borderRadius: 8, padding: 10, fontSize: 14 };
  return <section aria-labelledby="facebook-heading" style={{ margin: "14px 0", padding: 16, border: "1px solid #416c9b", borderRadius: 12, fontSize: 14, lineHeight: 1.5 }}>
    <style jsx>{`button:disabled { opacity: 0.45; cursor: not-allowed; }`}</style>
    <h2 id="facebook-heading" style={{ margin: 0, fontSize: 18 }}>Facebook</h2>
    <p style={{ margin: "4px 0 12px", color: "#9ab" }}>{meta?.pageName || "Treasure Hauls Facebook Page"}</p>

    {live ? <div>
      <p role="status" style={{ color: "#80e2b0" }}>● Live on Facebook</p>
      {!enabled && <button style={button} disabled={busy || !armed || !programReady} onClick={() => {
        if (window.confirm("This Facebook show is already public. Resume sending the house picture and audio to it?")) void action("facebook/send", { videoId: meta?.videoId, confirmLive: meta?.videoId });
      }}>Resume public Facebook feed</button>}
      <button style={{ ...button, width: "100%", padding: "14px 12px", fontSize: 16, background: "#5a1f1a", border: "1px solid #c0392b", marginTop: 8 }} disabled={busy}
        onClick={() => { if (window.confirm("End the Facebook show for viewers and stop sending to Facebook?")) void action("facebook/end", {}); }}>■ End Facebook show</button>
    </div> : goingLive ? <p role="status">Going live on Facebook… This can take up to two minutes.</p>
    : !fresh ? <p role="status">{!meta ? "Facebook setup is unavailable." : "Checking Facebook status…"}</p>
    : !armed ? <p style={{ margin: 0 }}><b>1 · Arm the house</b><br /><span style={{ color: "#bcc" }}>Use the green button at the top.</span></p>
    : !programReady ? <p role="status" style={{ margin: 0 }}><b>2 · Start your camera</b><br /><span style={{ color: "#bcc" }}>Waiting for the house picture.</span></p>
    : !checkedPicture ? <div>
      <p style={{ margin: "0 0 10px" }}><b>2 · Check picture and sound</b><br /><span style={{ color: "#bcc" }}>Check the house feed in Windows OBS before viewers join.</span></p>
      <a href="https://remotedesktop.google.com/access" target="_blank" rel="noopener noreferrer" style={{ color: "#bdddff", display: "inline-block", marginBottom: 12 }}>Open stream PC ↗</a>
      <button style={{ ...button, width: "100%" }} onClick={() => setCheckedPicture(true)}>Picture and sound are good →</button>
    </div> : manualSending ? <div>
      <p><b>3 · Go live in Facebook</b><br />Your manual preview is sending. Check it in Live Producer, then click Go live there when ready.</p>
      <a href="https://www.facebook.com/live/producer/?page_id=1156652300855210" target="_blank" rel="noopener noreferrer" style={{ color: "#bdddff" }}>Open Facebook Live Producer ↗</a>
    </div> : <div>
      <p style={{ margin: "0 0 10px" }}><b>3 · Go live when ready</b><br /><span style={{ color: "#bcc" }}>Hold for one second to start the Facebook show for viewers.</span></p>
      <label style={{ display: "block", color: "#bcc" }}>Show title<input aria-label="Facebook show title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} style={input} /></label>
      <button style={{ ...button, width: "100%", marginTop: 10, padding: "16px 12px", fontSize: 17, fontWeight: 700, touchAction: "none", userSelect: "none", border: "1px solid #3b82f6", background: `linear-gradient(90deg,#1877f2 ${holdPct}%,#123c78 ${holdPct}%)` }}
        disabled={!canGoLive} onPointerDown={holdBegin} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}
        onKeyDown={keyDown} onKeyUp={keyUp} onBlur={holdEnd}>● Hold to GO LIVE on Facebook</button>
      {keyed && <small style={{ display: "block", color: "#9ab", marginTop: 8 }}>This starts a new Facebook show instead of the saved manual preview.</small>}
      <button style={{ background: "none", border: 0, color: "#bdddff", padding: "8px 0", cursor: "pointer" }} onClick={() => setCheckedPicture(false)}>Back to picture check</button>
    </div>}

    {(error || meta?.error || (meta?.goLive === "failed" && meta.goLiveError)) && <p role="alert" style={{ color: "#ffd3bc" }}>{error || meta?.error || meta?.goLiveError}</p>}
    {fresh && enabled && !live && !goingLive && <div style={{ marginTop: 10 }}>
      <p style={{ color: "#bcc", margin: "4px 0" }}>{sending ? "Feed is sending; Facebook has not confirmed a live show." : "Facebook sender is waiting."}</p>
      <button style={button} disabled={busy} onClick={() => void action("destinations", { facebook: false })}>Stop Facebook sender</button>
    </div>}

    <details style={{ marginTop: 14 }} open={advanced} onToggle={e => setAdvanced(e.currentTarget.open)}>
      <summary style={{ color: "#9ab", cursor: "pointer" }}>Manual setup &amp; details</summary>
      <p style={{ color: "#9ab" }}>Optional: use this if you want to publish from Facebook Live Producer yourself.</p>
      {meta?.videoId && <p style={{ color: "#9ab", overflowWrap: "anywhere" }}>Selected show: {meta.title || meta.videoId} · {keyed ? "Stream key loaded" : meta.phase || "Unknown"}{keyTail ? ` · key …${keyTail}` : ""}</p>}
      {!live && !enabled && <div>
        <label>Show title<input aria-label="Manual Facebook show title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} style={input} /></label>
        <button style={{ ...button, marginTop: 8 }} disabled={busy || !fresh} onClick={() => void action("facebook/prepare", { title })}>{preview && !keyed ? "Refresh preview" : "Create Facebook preview"}</button>
        {preview && <div style={{ marginTop: 8 }}>
          <button style={button} disabled={busy || !armed || !programReady || !checkedPicture} onClick={() => void action("facebook/send", { videoId: meta?.videoId })}>{keyed ? "Send house feed to Live Producer" : "Send house feed to preview"}</button>
          {!checkedPicture && <p style={{ color: "#9ab" }}>Complete the picture and sound check above before sending.</p>}
        </div>}
      </div>}
      <p><a href="https://www.facebook.com/live/producer/?page_id=1156652300855210" target="_blank" rel="noopener noreferrer" style={{ color: "#bdddff" }}>Open Facebook Live Producer ↗</a></p>
      <p style={{ color: "#9ab" }}>After sending, check the preview in Live Producer and click Go live there when ready. End the Facebook show before stopping its sender.</p>
    {advanced && <form onSubmit={e => { e.preventDefault(); void action("facebook/select", { videoId }); }}>
      <label>Live-video ID from Live Producer<input aria-label="Facebook live-video ID" value={videoId} onChange={e => setVideoId(e.target.value)} inputMode="numeric" pattern="[0-9]{5,40}" required style={input} /></label>
      <button style={{ ...button, marginTop: 8 }} disabled={busy || enabled || !fresh}>Select show</button>
      <p style={{ color: "#9ab" }}>Use this for an existing live show whose comments you want to follow. Only the bound Treasure Hauls Page is accepted. A show made in Live Producer is not visible here until it is live; paste its stream key instead.</p>
    </form>}
    {advanced && <form onSubmit={e => { e.preventDefault(); void applyKey(); }} style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #2b3f5c" }}>
      <p style={{ margin: "0 0 6px" }}><b>Paste stream key from Live Producer</b></p>
      <label>Server URL<input aria-label="Facebook server URL" value={server} onChange={e => setServer(e.target.value)} required pattern="rtmps://[^\s]+" style={input} /></label>
      <label>Stream key<input aria-label="Facebook stream key" type="password" autoComplete="off" value={streamKey} onChange={e => setStreamKey(e.target.value.trim())} required pattern={KEY_PATTERN} placeholder="FB-…" style={input} /></label>
      <label>Backup stream key (optional)<input aria-label="Facebook backup stream key" type="password" autoComplete="off" value={backupKey} onChange={e => setBackupKey(e.target.value.trim())} pattern={KEY_PATTERN} style={input} /></label>
      <button style={{ ...button, marginTop: 8 }} disabled={busy || enabled || !fresh}>Use this stream key</button>
      <p style={{ color: "#9ab" }}>In Live Producer choose Go live → Streaming software and copy the Server URL and Stream key here. The key stays on the Spark and is shown above only by its last characters. Facebook allows about four hours between the first preview and going live; if Live Producer reset the key, paste the new one. Stop the Facebook sender before changing keys.</p>
    </form>}
    </details>
  </section>;
}
