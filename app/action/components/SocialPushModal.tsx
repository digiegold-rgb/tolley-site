"use client";

import { useEffect, useRef, useState } from "react";
import { S } from "../styles";

// One video queued for the Social Suite. mediaUrl/thumbnailUrl must be PUBLIC
// (Cloudflare tunnel) absolute URLs — the platforms pull them server-side, so
// the Tailscale LAN base would be unreachable to them.
export type SocialPushTarget = {
  title: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  sourceRefId: string;
  hint: string;          // context line fed to the caption generator
  warmUrl?: string;      // 720p web copy to pre-warm so platform pulls don't hit a cold cache
};

const PLATFORMS: { id: string; label: string }[] = [
  { id: "youtube", label: "▶️ YouTube" },
  { id: "tiktok", label: "🎵 TikTok" },
  { id: "instagram", label: "📸 Instagram" },
  { id: "facebook", label: "👥 Facebook" },
  { id: "pinterest", label: "📌 Pinterest" },
  { id: "backatyou", label: "🏠 Back At You" },
];
// The caption generator only knows these five (backatyou reuses the FB voice).
const CAPTION_PLATFORMS = new Set(["youtube", "tiktok", "instagram", "facebook", "pinterest"]);

export function SocialPushModal({ target, onClose }: { target: SocialPushTarget; onClose: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(PLATFORMS.map((p) => p.id)));
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [queuedId, setQueuedId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const draftedFor = useRef<string | null>(null);

  // Pre-warm the 720p web copy: a 2-byte ranged GET makes the action API build
  // the cached web version in the background, so a platform pulling the URL
  // minutes later gets the light transcode instead of a cold-cache raw file.
  useEffect(() => {
    if (!target.warmUrl) return;
    const ctrl = new AbortController();
    fetch(target.warmUrl, { headers: { Range: "bytes=0-1" }, signal: ctrl.signal })
      .then((r) => r.body?.cancel())
      .catch(() => { /* best-effort */ });
    return () => ctrl.abort();
  }, [target.warmUrl]);

  // Auto-draft the caption once per target (editable afterwards).
  const draft = async () => {
    setDrafting(true);
    setErr("");
    try {
      const r = await fetch("/api/action/social-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "caption",
          platforms: [...selected].filter((p) => CAPTION_PLATFORMS.has(p)),
          topic: target.title,
          hint: target.hint,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `caption ${r.status}`);
      setCaption(d.caption || "");
      setHashtags(Array.isArray(d.hashtags) ? d.hashtags : []);
    } catch (e: any) {
      setErr(`Caption draft failed (${e.message}) — write one below or retry.`);
    } finally { setDrafting(false); }
  };
  useEffect(() => {
    if (draftedFor.current === target.sourceRefId) return;
    draftedFor.current = target.sourceRefId;
    draft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.sourceRefId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const push = async () => {
    setPushing(true);
    setErr("");
    try {
      const r = await fetch("/api/action/social-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "queue",
          mediaUrl: target.mediaUrl,
          thumbnailUrl: target.thumbnailUrl,
          title: target.title,
          caption,
          hashtags,
          platforms: [...selected],
          sourceRefId: target.sourceRefId,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || `queue ${r.status}`);
      setQueuedId(d.id || "ok");
    } catch (e: any) {
      setErr(`Queue failed: ${e.message}`);
    } finally { setPushing(false); }
  };

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modalBox, width: "min(520px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <span style={S.modalTitle}>📣 Push to Social — {target.title}</span>
          <button onClick={onClose} style={{ ...S.smallBtn, cursor: "pointer", background: "transparent" }}>✕</button>
        </div>

        {queuedId ? (
          <div style={{ padding: "10px 2px" }}>
            <p style={{ margin: "0 0 6px", fontSize: 15, color: "#6ee7b7", fontWeight: 700 }}>
              ✓ Queued for {selected.size} platform{selected.size === 1 ? "" : "s"}
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              Nothing posts by itself — open the Social Suite and hit <b>Post now</b> on the row when you&apos;re ready.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose} style={{ ...S.smallBtn, minHeight: 42, cursor: "pointer", background: "transparent" }}>Done</button>
              <a href="/social" style={{ ...S.smallBtnPrimary, minHeight: 42, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                Open /social ↗
              </a>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {PLATFORMS.map((p) => (
                <button key={p.id} onClick={() => toggle(p.id)}
                  style={selected.has(p.id) ? S.dispOn : S.dispOff}>
                  <span style={S.dispLbl}>{p.label}</span>
                </button>
              ))}
            </div>

            <textarea
              value={drafting ? "Drafting caption…" : caption}
              disabled={drafting}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              placeholder="Caption"
              style={{
                width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, color: "white",
                fontSize: 14, padding: "10px 12px", outline: "none", resize: "vertical",
                fontFamily: "inherit", opacity: drafting ? 0.6 : 1,
              }}
            />
            {hashtags.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, color: "#93c5fd", lineHeight: 1.6 }}>
                {hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
              </div>
            )}
            {err && <div style={{ marginTop: 8, fontSize: 12.5, color: "#fca5a5" }}>{err}</div>}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 14 }}>
              <button onClick={draft} disabled={drafting} style={{ ...S.smallBtn, cursor: "pointer", background: "transparent", opacity: drafting ? 0.5 : 1 }}
                title="Re-draft the caption + hashtags with Qwen (local, free)">
                ♻ Redraft caption
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={onClose} style={{ ...S.smallBtn, minHeight: 42, cursor: "pointer", background: "transparent" }}>Cancel</button>
                <button onClick={push} disabled={pushing || drafting || selected.size === 0}
                  style={{ ...S.smallBtnPrimary, minHeight: 42, opacity: pushing || drafting || selected.size === 0 ? 0.5 : 1 }}
                  title="Adds this video to the /social queue. Nothing posts until you hit Post now there.">
                  {pushing ? "Queuing…" : `Queue for ${selected.size} platform${selected.size === 1 ? "" : "s"}`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
