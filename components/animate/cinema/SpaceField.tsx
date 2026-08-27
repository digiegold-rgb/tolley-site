'use client';

/* <SpaceField/> — the "space dust" behind every Jelly Studio surface.
 * Port of the handoff's space-field.js (plain three.js, no R3F): three
 * additive-blended point bands (violet / cyan / pale) in different depth
 * planes, slow counter-rotation, scroll pushes the bands forward at
 * different rates (parallax), the camera eases toward the pointer.
 *
 * Guards: prefers-reduced-motion → one static frame; <480px → nothing;
 * <768px → sparse; DPR capped at 1.5; RAF paused while the tab is hidden;
 * full dispose on unmount; ErrorBoundary → null (never takes the page down). */

import * as React from 'react';
import { useReducedMotion } from '@/components/client/three/useReducedMotion';
import { useMobileDetect } from '@/components/client/three/useMobileDetect';

export type SpaceFieldDensity = 'full' | 'sparse';

export interface SpaceFieldProps {
  density?: SpaceFieldDensity;
  /** 0–1 overall opacity multiplier (studio uses ~0.6 so it stays behind data). */
  strength?: number;
  style?: React.CSSProperties;
}

/** `--jb-*` custom property → 0xRRGGBB, or `fallback` when unset / not a hex. */
function readCssHex(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback;
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const m = /^#?([0-9a-f]{6})$/i.exec(raw);
    return m ? Number.parseInt(m[1], 16) : fallback;
  } catch {
    return fallback;
  }
}

const COUNTS: Record<SpaceFieldDensity, [number, number, number]> = {
  full: [900, 500, 180],
  sparse: [420, 220, 80],
};

class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function SpaceFieldCanvas({ density = 'full', strength = 1, style }: SpaceFieldProps) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const tier = useMobileDetect();

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || tier === 'none') return;
    let dead = false;
    let cleanup: (() => void) | null = null;

    import('three').then((THREE) => {
      if (dead || !ref.current) return;
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene();
      const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 120);
      cam.position.z = 14;

      const [nFar, nMid, nNear] = COUNTS[tier === 'minimal' ? 'sparse' : density];
      const disposables: { dispose(): void }[] = [];
      const mkPoints = (n: number, spread: number, size: number, color: number, opacity: number) => {
        const g = new THREE.BufferGeometry();
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n * 3; i += 3) {
          arr[i] = (Math.random() - 0.5) * spread * 2.4;
          arr[i + 1] = (Math.random() - 0.5) * spread * 1.6;
          arr[i + 2] = (Math.random() - 0.5) * spread;
        }
        g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        const m = new THREE.PointsMaterial({
          color,
          size,
          transparent: true,
          opacity: opacity * strength,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
        });
        disposables.push(g, m);
        const p = new THREE.Points(g, m);
        scene.add(p);
        return p;
      };
      /* three.js wants numeric hex, not a CSS var(). Read the brand pair off
       * the document at mount (set by app/realestateanimated/layout.tsx via
       * the --jb-* variables) and fall back to the Jelly violet / cyan. */
      const brandHex = readCssHex('--jb-brand', 0x8f7dff);
      const cyanHex = readCssHex('--jb-cyan', 0x6fd6ff);
      const far = mkPoints(nFar, 30, 0.05, brandHex, 0.55);
      const mid = mkPoints(nMid, 22, 0.09, cyanHex, 0.5);
      const near = mkPoints(nNear, 16, 0.16, 0xcfc4ff, 0.65);

      let mx = 0;
      let my = 0;
      const onMove = (e: PointerEvent) => {
        mx = (e.clientX / window.innerWidth - 0.5) * 2;
        my = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      const resize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h, false);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      };
      resize();
      const clock = new THREE.Clock();
      let raf = 0;
      const frame = () => {
        const t = clock.getElapsedTime();
        const doc = document.documentElement;
        const sp = doc.scrollHeight > window.innerHeight ? window.scrollY / (doc.scrollHeight - window.innerHeight) : 0;
        far.rotation.y = t * 0.008;
        far.position.z = sp * 5;
        mid.rotation.y = -t * 0.012;
        mid.position.z = sp * 9;
        near.rotation.y = t * 0.016;
        near.position.z = sp * 13;
        cam.position.x += (mx * 0.7 - cam.position.x) * 0.03;
        cam.position.y += (-my * 0.5 - cam.position.y) * 0.03;
        cam.lookAt(0, 0, 0);
        renderer.render(scene, cam);
      };
      const tick = () => {
        if (dead) return;
        frame();
        raf = requestAnimationFrame(tick);
      };
      const onVis = () => {
        if (document.hidden) cancelAnimationFrame(raf);
        else if (!reduced) tick();
      };

      if (reduced) {
        // one honest frame — depth without motion
        frame();
      } else {
        window.addEventListener('pointermove', onMove, { passive: true });
        document.addEventListener('visibilitychange', onVis);
        tick();
      }
      window.addEventListener('resize', resize);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVis);
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
      };
    }).catch(() => {
      /* WebGL unavailable — the CSS backdrop alone is fine */
    });

    return () => {
      dead = true;
      if (cleanup) cleanup();
    };
  }, [density, strength, reduced, tier]);

  if (tier === 'none') return null;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-testid="space-field"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none', zIndex: 0, ...style }}
    />
  );
}

export default function SpaceField(props: SpaceFieldProps) {
  return (
    <Boundary>
      <SpaceFieldCanvas {...props} />
    </Boundary>
  );
}
