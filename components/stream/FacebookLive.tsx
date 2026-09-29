"use client";

import { useState } from "react";

export type FacebookMeta = { verified?: boolean; pageId?: string; pageName?: string; videoId?: string; title?: string; phase?: string; liveNow?: boolean | null; error?: string; checkedAt?: number };

export default function FacebookLive({ meta, armed, programReady, sending, enabled, refresh }: {
  meta?: FacebookMeta; armed: boolean; programReady: boolean; sending: boolean; enabled: boolean; refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("Treasure Hauls live show");
  const [videoId, setVideoId] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const fresh = !!meta?.verified && Date.now() / 1000 - (meta.checkedAt || 0) < 45;
  const preview = fresh && meta?.phase === "UNPUBLISHED";
  const live = fresh && meta?.liveNow === true;
  async function action(path: string, body: unknown) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/stream/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === "string" ? result.detail : result.error || "Facebook request failed");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Facebook request failed"); }
    finally { setBusy(false); }
  }
  const button = { background: "#193b66", color: "#eaf3ff", border: "1px solid #416c9b", borderRadius: 8, padding: "11px 12px", fontSize: 14, cursor: "pointer" };
  const input = { width: "100%", boxSizing: "border-box" as const, background: "#111a2b", color: "#eef", border: "1px solid #456", borderRadius: 8, padding: 10, fontSize: 14 };
  return <section aria-labelledby="facebook-heading" style={{ margin: "14px 0", padding: 16, border: "1px solid #416c9b", borderRadius: 12, fontSize: 14, lineHeight: 1.5 }}>
    <style jsx>{`button:disabled { opacity: 0.45; cursor: not-allowed; }`}</style>
    <h2 id="facebook-heading" style={{ margin: 0, fontSize: 18 }}>Facebook LIVE</h2>
    <p style={{ margin: "6px 0" }}>{meta?.pageName || "Treasure Hauls Facebook Page"} · <b>{!meta ? "Setup unavailable" : !fresh ? "Status unverified" : live ? "Live on Facebook" : preview ? "Unpublished preview" : "Offline"}</b></p>
    <p style={{ color: "#bcc" }}>1. Create a preview here. 2. Arm the house with destinations off and check the camera. 3. Send the feed, check it in Facebook Live Producer, then click <b>Go live there when ready</b>.</p>
    <label>Show title<input aria-label="Facebook show title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} style={input} /></label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      <button style={button} disabled={busy || !meta || enabled || live} onClick={() => void action("facebook/prepare", { title })}>{busy ? "Working…" : preview ? "Refresh preview" : "Create Facebook preview"}</button>
      <button style={button} disabled={busy || !preview || !armed || !programReady || enabled} onClick={() => void action("facebook/send", { videoId: meta?.videoId })}>Send house feed to preview</button>
      {live && !enabled && <button style={button} disabled={busy || !armed || !programReady} onClick={() => {
        if (window.confirm("This Facebook show is already public. Resume sending the house picture and audio to it?")) void action("facebook/send", { videoId: meta?.videoId, confirmLive: meta?.videoId });
      }}>Resume public Facebook feed</button>}
      {enabled && <button style={button} disabled={busy} onClick={() => void action("destinations", { facebook: false })}>Stop Facebook sender</button>}
    </div>
    <p style={{ marginBottom: 4 }}><a href="https://www.facebook.com/live/producer/?page_id=1156652300855210" target="_blank" rel="noopener noreferrer" style={{ color: "#bdddff" }}>Open Facebook Live Producer ↗</a></p>
    <p style={{ color: "#bcc", margin: "6px 0" }}>{sending ? "House feed is sending. Check picture and audio in Live Producer." : enabled ? "Sender is waiting for the house feed." : "Facebook sender is off."} Creating a preview does not start a public show. End the Facebook show in Live Producer before ending the house.</p>
    {!enabled && <p style={{ color: "#9ab", margin: "6px 0" }}>{!armed ? "Arm the house below to enable sending the preview." : !programReady ? "Waiting for the house program before sending." : "House program is ready to send."}</p>}
    {meta?.videoId && <p style={{ color: "#9ab", margin: "6px 0", overflowWrap: "anywhere" }}>Selected show: {meta.title || meta.videoId} · ID {meta.videoId}</p>}
    {(error || meta?.error) && <p role="alert" style={{ color: "#ffd3bc" }}>{error || meta?.error}</p>}
    <button style={{ background: "none", border: 0, color: "#bdddff", padding: "8px 0" }} onClick={() => setAdvanced(!advanced)}>{advanced ? "Hide" : "Select an existing Facebook show"}</button>
    {advanced && <form onSubmit={e => { e.preventDefault(); void action("facebook/select", { videoId }); }}>
      <label>Live-video ID from Live Producer<input aria-label="Facebook live-video ID" value={videoId} onChange={e => setVideoId(e.target.value)} inputMode="numeric" pattern="[0-9]{5,40}" required style={input} /></label>
      <button style={{ ...button, marginTop: 8 }} disabled={busy || enabled || !meta}>Select show</button>
      <p style={{ color: "#9ab" }}>Use this for a preview made in Facebook or an existing live show whose comments you want to follow. Only the bound Treasure Hauls Page is accepted.</p>
    </form>}
  </section>;
}
