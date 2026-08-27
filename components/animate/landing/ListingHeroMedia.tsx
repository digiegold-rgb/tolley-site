'use client';

/**
 * ListingHeroMedia — the hero of tolley.io/realestateanimated.
 *
 * A muted, looping before→after demo (public/realestateanimated/brand/
 * demo-before-after.mp4, produced by the P0 smoke on one of Jared's real
 * listing photos) with its poster. Under it, a CSS before/after slider of the
 * two stills from the same render; the slider hides itself if either still is
 * missing, so the page never shows a broken image.
 */
import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';
import { FilmFrame } from '../cinema';

const t = JELLY_TOKENS.dark;

export const HERO_VIDEO = '/realestateanimated/brand/demo-before-after.mp4';
export const HERO_POSTER = '/realestateanimated/brand/demo-poster.jpg';
export const BEFORE_STILL = '/realestateanimated/brand/demo-before.jpg';
export const AFTER_STILL = '/realestateanimated/brand/demo-after.jpg';

export function ListingHeroMedia(): React.ReactElement {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = React.useState(true);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, []);

  return (
    <div data-slot="hero" style={{ display: 'grid', gap: 14 }}>
      <FilmFrame glow height={undefined} style={{ aspectRatio: '16 / 9', width: '100%' }}>
        {videoOk ? (
          <video
            ref={ref}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            poster={HERO_POSTER}
            aria-label="Before and after: an empty room becomes a furnished room"
            data-testid="listing-hero-video"
            onError={() => setVideoOk(false)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: t.cardAlt }}
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: t.cardAlt, color: t.textSecondary, fontFamily: JELLY_TOKENS.font, fontSize: 16, textAlign: 'center', padding: 20 }}>
            The demo video could not load. Refresh the page, or scroll down for the before / after stills.
          </div>
        )}
        <div style={{ position: 'absolute', left: 14, bottom: 12, display: 'flex', gap: 8, alignItems: 'center', fontFamily: JELLY_TOKENS.font }}>
          <span data-slot="frame-label" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 13, padding: '5px 9px', borderRadius: 6, letterSpacing: '0.02em' }}>AI-generated · virtually staged</span>
        </div>
      </FilmFrame>
      <BeforeAfterSlider before={BEFORE_STILL} after={AFTER_STILL} />
    </div>
  );
}

export function BeforeAfterSlider({ before, after }: { before: string; after: string }): React.ReactElement | null {
  const [pos, setPos] = React.useState(52);
  const [ok, setOk] = React.useState<{ b: boolean | null; a: boolean | null }>({ b: null, a: null });

  React.useEffect(() => {
    const probe = (src: string, key: 'b' | 'a') => {
      const img = new Image();
      img.onload = () => setOk((o) => ({ ...o, [key]: true }));
      img.onerror = () => setOk((o) => ({ ...o, [key]: false }));
      img.src = src;
    };
    probe(before, 'b');
    probe(after, 'a');
  }, [before, after]);

  if (ok.b === false || ok.a === false) return null;

  return (
    <div data-testid="listing-before-after" style={{ display: 'grid', gap: 8, opacity: ok.b && ok.a ? 1 : 0, transition: 'opacity .4s' }}>
      <div
        className="jrl-ba"
        style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 14, overflow: 'hidden', border: `1px solid ${t.border}`, background: t.cardAlt, userSelect: 'none' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="After — virtually staged" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, width: `${pos}%`, overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt="Before — the empty room" draggable={false} style={{ position: 'absolute', inset: 0, width: '100vw', maxWidth: 'none', height: '100%', objectFit: 'cover' }} className="jrl-ba-before" />
        </div>
        <div aria-hidden style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${pos}% - 1px)`, width: 2, background: '#fff', boxShadow: '0 0 12px rgba(0,0,0,0.6)' }} />
        <div aria-hidden style={{ position: 'absolute', top: '50%', left: `${pos}%`, transform: 'translate(-50%, -50%)', width: 44, height: 44, borderRadius: 999, background: JELLY_TOKENS.gradPrimary, color: JELLY_TOKENS.onGradient, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 18, boxShadow: JELLY_TOKENS.brandGlow }}>
          ⇔
        </div>
        <span style={{ position: 'absolute', left: 12, top: 12, fontSize: 13, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '4px 8px', borderRadius: 6, fontFamily: JELLY_TOKENS.font }}>BEFORE</span>
        <span style={{ position: 'absolute', right: 12, top: 12, fontSize: 13, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '4px 8px', borderRadius: 6, fontFamily: JELLY_TOKENS.font }}>AFTER</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Slide to compare before and after"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', margin: 0 }}
        />
      </div>
      <div style={{ fontSize: 14, color: t.textFaint, fontFamily: JELLY_TOKENS.font, textAlign: 'center' }}>Drag to compare · same room, same walls, same windows — only the furniture is new</div>
    </div>
  );
}

/** Jared's photo, or initials if the file is not there yet. Never a broken image. */
export function ProofAvatar({ src, name, size = 88 }: { src: string; name: string; size?: number }): React.ReactElement {
  const [ok, setOk] = React.useState(true);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: 999, overflow: 'hidden', flex: 'none', background: JELLY_TOKENS.gradPrimary, display: 'grid', placeItems: 'center', boxShadow: t.halo, border: `2px solid ${JELLY_TOKENS.brandOutline}` }}>
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} width={size} height={size} onError={() => setOk(false)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <span aria-label={name} style={{ fontFamily: JELLY_TOKENS.font, fontWeight: 800, fontSize: size * 0.38, color: JELLY_TOKENS.onGradient }}>{initials}</span>
      )}
    </div>
  );
}
