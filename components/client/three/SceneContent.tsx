"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group } from "three";
import { FloatingHouse } from "./FloatingHouse";
import { FloatingKey } from "./FloatingKey";
import { FloatingPin } from "./FloatingPin";
import { FloatingDollar } from "./FloatingDollar";
import { ParticleField } from "./ParticleField";
import type { DeviceTier } from "./useMobileDetect";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function SceneContent({ tier }: { tier: DeviceTier }) {
  const groupRef = useRef<Group>(null);
  const { pointer } = useThree();

  const scrollRef = useRef({ current: 0, target: 0 });

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPct = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    scrollRef.current.target = scrollPct;
    scrollRef.current.current = lerp(scrollRef.current.current, scrollRef.current.target, delta * 3);

    const s = scrollRef.current.current;

    // Mouse parallax — very subtle, luxury = unhurried
    const mx = pointer.x * 0.2;
    const my = pointer.y * 0.1;
    groupRef.current.rotation.y = lerp(groupRef.current.rotation.y, mx * 0.08, delta * 1.5);
    groupRef.current.rotation.x = lerp(groupRef.current.rotation.x, -my * 0.04, delta * 1.5);

    // Slow vertical drift with scroll
    groupRef.current.position.y = lerp(groupRef.current.position.y, s * -1.5, delta * 2);

    const children = groupRef.current.children;
    if (children.length < 4) return;

    // Arch prism (0) — drifts left slowly
    children[0].position.x = lerp(children[0].position.x, -2.2 + s * -1, delta * 1.5);
    children[0].scale.setScalar(lerp(children[0].scale.x, 1 - s * 0.2, delta * 1.5));

    // Gold arc (1) — drifts right
    children[1].position.x = lerp(children[1].position.x, 2.8 + s * 0.8, delta * 1.5);
    children[1].scale.setScalar(lerp(children[1].scale.x, 1 - s * 0.15, delta * 1.5));

    // Glass planes (2) — scale up mid-scroll
    const glassScale = s > 0.25 && s < 0.55 ? 1.3 : 0.9;
    children[2].scale.setScalar(lerp(children[2].scale.x, glassScale, delta * 1.5));

    // Dollar (3) — comes forward in data zone
    const dollarZ = s > 0.45 && s < 0.75 ? 0.5 : -1.5;
    children[3].position.z = lerp(children[3].position.z, dollarZ, delta * 1.5);
    const dollarScale = s > 0.45 && s < 0.75 ? 1.1 : 0.6;
    children[3].scale.setScalar(lerp(children[3].scale.x, dollarScale, delta * 1.5));

    // End zone: slow convergence
    if (s > 0.7) {
      const convergeFactor = (s - 0.7) / 0.3;
      for (let i = 0; i < 4; i++) {
        children[i].position.x = lerp(children[i].position.x, 0, delta * convergeFactor * 2);
      }
    }
  });

  if (tier === "minimal") {
    return (
      <>
        <ambientLight intensity={0.03} color="#C9A84C" />
        <ParticleField count={80} />
      </>
    );
  }

  return (
    <>
      {/* Luxury architectural lighting rig */}
      <ambientLight intensity={0.04} color="#C9A84C" />
      <directionalLight position={[5, 8, -3]} intensity={0.7} color="#F5F0E8" />
      <pointLight position={[-4, 2, 4]} intensity={0.25} color="#4A9EAF" />
      <spotLight
        position={[0, 10, 0]}
        angle={0.3}
        penumbra={0.8}
        intensity={0.35}
        color="#E2C97E"
      />
      {/* Rim light from behind — catches gold edges */}
      <directionalLight position={[-3, 2, -5]} intensity={0.4} color="#C9A84C" />

      <group ref={groupRef}>
        {/* Architectural prism — center left */}
        <group position={[-2.2, 0.3, 0]}>
          <FloatingHouse />
        </group>
        {/* Gold arc — center right */}
        <group position={[2.8, 0, -0.5]}>
          <FloatingKey />
        </group>
        {/* Glass planes — upper center */}
        <group position={[0.5, 1.5, -1.5]}>
          <FloatingPin />
        </group>
        {/* Dollar — lower left */}
        <group position={[-1.2, -1.2, -1.5]}>
          <FloatingDollar />
        </group>
      </group>

      <ParticleField count={150} />
    </>
  );
}
