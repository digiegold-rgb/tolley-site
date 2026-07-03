"use client";

/**
 * YouTubeBackdrop — WebGL ambient backdrop for /vater/youtube.
 *
 * Three slow-drifting emissive orbs (sky, fuchsia, amber) sit behind the UI
 * with Bloom post-processing for soft glow. A mouse-following point light
 * gives the scene a sense of depth as the cursor moves. Reuses the existing
 * ParticleField + device tiering + reduced-motion guards from ClientScene.
 */

import { Component, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import type { Mesh, PointLight } from "three";
import { ParticleField } from "@/components/client/three/ParticleField";
import { useReducedMotion } from "@/components/client/three/useReducedMotion";
import { useMobileDetect } from "@/components/client/three/useMobileDetect";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function DriftOrb({
  color,
  basePosition,
  driftRadius,
  speed,
  size,
}: {
  color: string;
  basePosition: [number, number, number];
  driftRadius: number;
  speed: number;
  size: number;
}) {
  const ref = useRef<Mesh>(null);
  const phase = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * speed + phase.current;
    ref.current.position.x = basePosition[0] + Math.cos(t) * driftRadius;
    ref.current.position.y = basePosition[1] + Math.sin(t * 0.7) * driftRadius * 0.6;
    ref.current.position.z = basePosition[2] + Math.sin(t * 0.4) * driftRadius * 0.3;
  });

  return (
    <mesh ref={ref} position={basePosition}>
      <sphereGeometry args={[size, 48, 48]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.45}
        roughness={0.25}
        metalness={0.35}
        transparent
        opacity={0.6}
      />
    </mesh>
  );
}

function MouseLight() {
  const ref = useRef<PointLight>(null);
  const { pointer, viewport } = useThree();

  useFrame((_, delta) => {
    if (!ref.current) return;
    const targetX = pointer.x * viewport.width * 0.5;
    const targetY = pointer.y * viewport.height * 0.5;
    ref.current.position.x = lerp(ref.current.position.x, targetX, delta * 4);
    ref.current.position.y = lerp(ref.current.position.y, targetY, delta * 4);
  });

  return (
    <pointLight
      ref={ref}
      position={[0, 0, 3]}
      intensity={1.4}
      distance={12}
      decay={1.3}
      color="#c7d2fe"
    />
  );
}

function BackdropScene({ tier }: { tier: "minimal" | "full" }) {
  return (
    <>
      <ambientLight intensity={0.12} color="#1e1b4b" />
      <MouseLight />

      {/* Orbs — match the Scene visuals accent palette */}
      <DriftOrb
        color="#38bdf8"
        basePosition={[-4, 1.8, -4]}
        driftRadius={1.2}
        speed={0.1}
        size={0.28}
      />
      <DriftOrb
        color="#e879f9"
        basePosition={[3.8, -1.6, -4.5]}
        driftRadius={1.3}
        speed={0.08}
        size={0.32}
      />
      <DriftOrb
        color="#fbbf24"
        basePosition={[0, 2.8, -5]}
        driftRadius={1}
        speed={0.12}
        size={0.22}
      />

      <ParticleField count={tier === "full" ? 180 : 100} />

      <EffectComposer>
        <Bloom
          intensity={0.3}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.92}
          mipmapBlur
        />
      </EffectComposer>
    </>
  );
}

function BackdropInner() {
  const reduced = useReducedMotion();
  const tier = useMobileDetect();

  if (reduced || tier === "none") return null;

  return (
    <div className="yt-backdrop-canvas" aria-hidden="true">
      <Canvas
        dpr={tier === "full" ? [1, 1.5] : 1}
        gl={{
          antialias: tier === "full",
          alpha: true,
          powerPreference: "high-performance",
        }}
        camera={{ position: [0, 0, 6], fov: 55 }}
        style={{ pointerEvents: "none" }}
      >
        <BackdropScene tier={tier === "full" ? "full" : "minimal"} />
      </Canvas>
    </div>
  );
}

export default function YouTubeBackdrop() {
  return (
    <ErrorBoundary>
      <BackdropInner />
    </ErrorBoundary>
  );
}
