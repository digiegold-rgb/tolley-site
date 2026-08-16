'use client';

/**
 * DemoReel — the "NOW SHOWING" carousel on the cinema landing.
 *
 * A scroll-snap film strip of ~8 s excerpts (lib/vater/demo-clips.ts). Every
 * card is a FilmFrame; 16:9 library films and 9:16 shorts share one height so
 * the strip reads as one reel with mixed gauges. Clips autoplay MUTED and
 * looped only while on screen (IntersectionObserver), tap 🔊 to hear one,
 * and the whole card links to the real full-length piece.
 *
 * Numbers on the plates come from the joined LIVE_DEMOS record (all-in cost,
 * duration) — nothing is typed here. Shorts carry no $ because no reconciled
 * cost exists for them (contract rule 1).
 */

import * as React from 'react';

import type { LiveClip } from '@/lib/vater/demo-clips';
import { JELLY_TOKENS } from '../tokens';
import { FilmFrame, FILM_MEDIA_STYLE, MicroLabel } from '../cinema';

const t = JELLY_TOKENS.dark;

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function ClipCard({ clip, height, maxWidth, unmuted, onToggleSound }: {
  clip: LiveClip;
  height: number;
  maxWidth?: number;
  unmuted: boolean;
  onToggleSound: () => void;
}): React.ReactElement {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setInView(!!e && e.intersectionRatio > 0.5),
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (inView) {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked; poster stays */ });
    } else {
      el.pause();
    }
  }, [inView]);

  const isWide = clip.aspect === '16x9';
  /* One strip height for both gauges on desktop. On a phone a 16:9 card at
   * that height is wider than the screen, so wide cards are capped to the
   * viewport and take a shorter frame; tall cards keep the full height. */
  const cap = maxWidth ?? Infinity;
  let media = height - 40; // FilmFrame rails are 20px each
  let width = Math.round(isWide ? (media * 16) / 9 : (media * 9) / 16);
  if (width > cap) { width = cap; media = Math.round((width * 9) / 16); }
  const frameHeight = media + 40;
  const ownerLabel =
    clip.owner === 'trey' ? `TREY'S LIBRARY · #${clip.demoId}`
    : clip.owner === 'dgd' ? 'DIGITAL GOLD DIGGERS · EP 1'
    : 'OUR LADY · SHORTS';
  const meta = clip.demo
    ? `${clip.demo.duration} · ${usd(clip.demo.allInUsd)} all in`
    : clip.owner === 'dgd' ? `${clip.fullDuration} clip · Facebook`
    : `${clip.fullDuration} short · YouTube`;

  return (
    <div
      className="jsl-reel-card"
      style={{ width, flex: '0 0 auto', scrollSnapAlign: 'center', position: 'relative' }}
      data-testid={`demo-clip-${clip.id}`}
    >
      <FilmFrame height={frameHeight} radius={14} glow={unmuted}>
        <video
          ref={ref}
          src={clip.src}
          poster={clip.poster}
          muted={!unmuted}
          loop
          playsInline
          preload="metadata"
          style={FILM_MEDIA_STYLE}
          aria-label={`Excerpt: ${clip.title}`}
        />
        {/* caption plate */}
        <div
          style={{
            /* top plate: the renders carry burned-in captions along the bottom */
            position: 'absolute', left: 0, right: 0, top: 0,
            padding: isWide ? '12px 52px 26px 14px' : '10px 44px 40px 10px',
            background: 'linear-gradient(180deg, rgba(10,10,20,0.92) 0%, rgba(10,10,20,0.55) 60%, rgba(10,10,20,0) 100%)',
            display: 'flex', flexDirection: 'column', gap: 4, pointerEvents: 'none',
          }}
        >
          <MicroLabel tone="cyan" size={9.5} tracking="0.2em" style={{ whiteSpace: 'normal', textAlign: 'left' }}>{ownerLabel}</MicroLabel>
          <div
            style={{
              fontWeight: 600, fontSize: isWide ? 14 : 12, lineHeight: 1.25, color: t.text, textAlign: 'left',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {clip.title}
          </div>
          <div style={{ fontSize: 11, color: JELLY_TOKENS.cyan, fontWeight: 500, fontVariantNumeric: 'tabular-nums', textAlign: 'left' }}>{meta}</div>
        </div>
        {/* full-piece link over the whole card */}
        <a
          href={clip.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open the full piece: ${clip.title}`}
          style={{ position: 'absolute', inset: 0 }}
        />
        {/* sound toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          aria-label={unmuted ? 'Mute' : 'Unmute'}
          aria-pressed={unmuted}
          style={{
            position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 999,
            border: `1px solid ${unmuted ? 'rgba(179,166,255,0.6)' : t.border}`,
            background: unmuted ? 'rgba(143,125,255,0.25)' : 'rgba(10,10,20,0.55)',
            color: t.text, cursor: 'pointer', fontSize: 13, lineHeight: '28px', padding: 0,
            backdropFilter: t.glassBlur,
          }}
        >
          {unmuted ? '🔊' : '🔇'}
        </button>
      </FilmFrame>
    </div>
  );
}

export function DemoReel({ clips }: { clips: readonly LiveClip[] }): React.ReactElement {
  const stripRef = React.useRef<HTMLDivElement>(null);
  const [soundId, setSoundId] = React.useState<string | null>(null);
  const [height, setHeight] = React.useState(320);
  const [maxWidth, setMaxWidth] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => { setHeight(mq.matches ? 300 : 320); setMaxWidth(mq.matches ? window.innerWidth - 64 : undefined); };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const scrollBy = (dir: 1 | -1) => {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  const arrow = (dir: 1 | -1) => (
    <button
      type="button"
      onClick={() => scrollBy(dir)}
      aria-label={dir === 1 ? 'Next clips' : 'Previous clips'}
      className="jc-pill-ghost"
      style={{
        width: 40, height: 40, borderRadius: 999, border: `1px solid ${t.borderStrong}`,
        background: 'rgba(10,10,20,0.4)', color: t.text, cursor: 'pointer', fontSize: 18, lineHeight: 1,
        backdropFilter: t.glassBlur, flex: '0 0 auto',
      }}
    >
      {dir === 1 ? '→' : '←'}
    </button>
  );

  return (
    <div style={{ position: 'relative' }} data-testid="demo-reel">
      <div
        ref={stripRef}
        className="jsl-reel-strip"
        style={{
          display: 'flex', alignItems: 'center', gap: 16, overflowX: 'auto', scrollSnapType: 'x mandatory',
          padding: '18px 36px 24px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }}
      >
        {clips.map((c) => (
          <ClipCard
            key={c.id}
            clip={c}
            height={height}
            maxWidth={maxWidth}
            unmuted={soundId === c.id}
            onToggleSound={() => setSoundId((s) => (s === c.id ? null : c.id))}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 4 }}>
        {arrow(-1)}
        <MicroLabel tone="faint" size={10.5} style={{ whiteSpace: 'normal', textAlign: 'center' }}>
          {clips.length} excerpts · tap 🔊 to hear · tap a card for the full piece
        </MicroLabel>
        {arrow(1)}
      </div>
    </div>
  );
}
