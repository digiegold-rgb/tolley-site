'use client';

/* <CinemaBackdrop/> — the fixed, click-through stage every Jelly surface sits
 * on: nebula wash, space dust (three.js), and — on hero-level pages — the
 * projector beam wedge from the top-left plus a cyan corner glow.
 * Renders position:fixed at z-index 0; put your content in a z-index:1 wrapper. */

import * as React from 'react';
import { JELLY_TOKENS } from '../tokens';
import { useTheme } from '../theme-context';
import { SpaceFieldLazy } from './SpaceFieldLazy';

export interface CinemaBackdropProps {
  /** Projector beam + corner glow (landing / legal / demo). Off inside the studio. */
  beam?: boolean;
  /** Particle density; the studio uses 'sparse' so data stays legible. */
  density?: 'full' | 'sparse';
  /** Force the dark palette (public pages have no theme toggle). */
  forceDark?: boolean;
}

export function CinemaBackdrop({ beam = false, density = 'full', forceDark = false }: CinemaBackdropProps): React.ReactElement {
  const { t: themed, dark } = useTheme();
  const t = forceDark ? JELLY_TOKENS.dark : themed;
  const isDark = forceDark || dark;
  return (
    <div aria-hidden="true" data-testid="cinema-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden', background: t.body }}>
      <div style={{ position: 'absolute', inset: 0, background: t.heroWash }} />
      <SpaceFieldLazy density={density} strength={isDark ? 1 : 0.55} />
      {beam && (
        <>
          <div
            className="jc-flicker"
            style={{
              position: 'absolute', top: '-12%', left: '-6%', width: '80vw', height: '80vh',
              background: `conic-gradient(from 118deg at 0% 0%, transparent 0deg, rgba(143,125,255,${isDark ? 0.16 : 0.22}) 10deg, rgba(111,214,255,${isDark ? 0.07 : 0.12}) 22deg, transparent 34deg)`,
            }}
          />
          <div style={{ position: 'absolute', bottom: '-25%', right: '-15%', width: '60vw', height: '60vw', borderRadius: '50%', background: `radial-gradient(circle, rgba(111,214,255,${isDark ? 0.08 : 0.14}), transparent 65%)` }} />
        </>
      )}
    </div>
  );
}
