"use client";

import { useEffect, useRef, useState } from "react";
import { S } from "../styles";
import { Clip, Disposition, DISPOSITIONS, isShortClip } from "../types";

export function ClipCard({ c, busy, privateView, previewSrc, fullSrc, thumbSrc, selectable, selected, onSelect, onLongPress, onExpand, onTag, onDelete, onTrim }: {
  c: Clip; busy: boolean; privateView?: boolean;
  previewSrc?: string | null; fullSrc?: string | null; thumbSrc?: string | null;
  selectable?: boolean; selected?: boolean;
  onSelect?: () => void; onLongPress?: () => void;
  onExpand: () => void; onTag: (d: Disposition) => void; onDelete: () => void;
  onTrim?: () => void;
}) {
  // Click the thumbnail to load an inline player right in the card. We prefer the
  // 720p web copy (fullSrc) because it carries AUDIO — the 480p preview proxy is
  // silent (encoded with -an), so playing it left clips sounding broken. Only fall
  // back to the muted proxy if no web copy exists yet. ⛶ opens the full-res modal.
  // In select mode the thumbnail toggles selection instead; long-press (500ms)
  // on mobile enters select mode with this clip selected.
  const inlineSrc = fullSrc || previewSrc;
  const inlineMuted = !fullSrc;  // only the silent proxy needs muting
  const [open, setOpen] = useState(false);
  const short = isShortClip(c);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  // --- hover-skim: on desktop, playing a muted preview under the cursor lets you
  // triage the grid without clicking into each clip. Prefer the lightweight silent
  // 480p proxy. Gated on a real hover pointer + prefers-reduced-motion. "Seen" is a
  // local visual hint only (fades the NEW tag) — it never mutates server state.
  const skimSrc = previewSrc || fullSrc;
  const [hoverPlay, setHoverPlay] = useState(false);
  const [seen, setSeen] = useState(false);
  const [canSkim, setCanSkim] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setCanSkim(hover && !reduce);
  }, []);
  const startSkim = () => { if (canSkim && !open && !selectable && skimSrc) { setHoverPlay(true); setSeen(true); } };
  const endSkim = () => setHoverPlay(false);

  const startPress = () => {
    if (!onLongPress || selectable) return;
    longFired.current = false;
    pressTimer.current = setTimeout(() => { longFired.current = true; onLongPress(); }, 500);
  };
  const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };

  const thumbClick = () => {
    if (longFired.current) { longFired.current = false; return; } // long-press already handled
    if (selectable) { onSelect?.(); return; }
    if (inlineSrc) setOpen(true); else onExpand();
  };

  return (
    <div style={{
      ...(short ? { ...S.clipCard, ...S.clipCardShort } : S.clipCard),
      ...(selected ? { outline: "2px solid #f59e0b", outlineOffset: 1 } : {}),
    }}>
      <div style={S.clipThumbWrap}
        onMouseEnter={startSkim} onMouseLeave={endSkim}>
        {open && inlineSrc && !selectable ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={inlineSrc} controls autoPlay muted={inlineMuted} playsInline preload="auto"
            poster={thumbSrc || undefined} style={S.clipVideo} />
        ) : hoverPlay && skimSrc && !selectable ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video src={skimSrc} autoPlay muted loop playsInline preload="auto"
            poster={thumbSrc || undefined} style={S.clipVideo}
            onClick={thumbClick} />
        ) : (
          <button onClick={thumbClick}
            onTouchStart={startPress} onTouchEnd={cancelPress} onTouchMove={cancelPress}
            style={{ ...S.clipThumb, backgroundImage: thumbSrc ? `url(${thumbSrc})` : undefined }}
            title={selectable ? "Toggle selection" : canSkim ? "Hover to skim · click to play with sound" : "Preview clip"}>
            {!selectable && <span style={S.playIcon}>▶</span>}
            {selectable && <span style={selected ? S.selectCheckOn : S.selectCheck}>{selected ? "✓" : ""}</span>}
            {short && <span style={{ ...S.shortTag, ...(selectable ? { left: 38 } : {}) }}>⚡ {Math.round(c.durationS!)}s — review &amp; delete</span>}
            {!c.reviewed && !privateView && !short && !selectable && (
              <span style={{ ...S.newTag, ...(seen ? { opacity: 0.4 } : {}) }} title={seen ? "Skimmed this session" : undefined}>NEW</span>
            )}
            {c.durationS && !short ? <span style={S.clipDur}>{Math.round(c.durationS)}s</span> : null}
          </button>
        )}
        {!selectable && <button onClick={onExpand} style={S.expandBtn} title="Open full quality" disabled={!c.url}>⛶</button>}
        {!selectable && onTrim && !c.trimmed && (
          <button onClick={onTrim} style={{ ...S.expandBtn, right: 38 }}
            title="Trim to the good parts &amp; reclaim space">✂️</button>
        )}
      </div>
      <div style={S.clipName} title={c.name}>{c.name}</div>
      <div style={S.dispRow}>
        {DISPOSITIONS.map((d) => (
          <button key={d.id} title={d.hint} disabled={busy || selectable} onClick={() => onTag(d.id)}
            style={c.disposition === d.id ? S.dispOn : S.dispOff}>
            <span style={{ fontSize: 13 }}>{d.icon}</span>
            <span style={S.dispLbl}>{d.label}</span>
          </button>
        ))}
        <button title="Delete permanently" disabled={busy || selectable} onClick={onDelete} style={S.dispDel}>🗑</button>
      </div>
      {busy && <div style={S.clipBusy}>saving…</div>}
    </div>
  );
}
