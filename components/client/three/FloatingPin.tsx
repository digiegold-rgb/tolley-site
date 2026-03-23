"use client";

import { Float } from "@react-three/drei";

/**
 * Intersecting planes — dark glass with gold edges.
 * Abstract architectural form suggesting space and depth.
 */
export function FloatingPin({ position = [0, 0, 0] as [number, number, number] }) {
  return (
    <Float speed={0.6} rotationIntensity={0.1} floatIntensity={0.25}>
      <group position={position}>
        {/* Vertical plane */}
        <mesh rotation={[0, 0.4, 0]}>
          <planeGeometry args={[1.2, 1.2]} />
          <meshPhysicalMaterial
            color="#1a1a2e"
            metalness={0.0}
            roughness={0.05}
            transparent
            opacity={0.4}
            side={2}
          />
        </mesh>
        {/* Crossing plane */}
        <mesh rotation={[0, -0.8, 0.1]}>
          <planeGeometry args={[1.0, 1.0]} />
          <meshPhysicalMaterial
            color="#0E0E18"
            metalness={0.0}
            roughness={0.05}
            transparent
            opacity={0.3}
            side={2}
          />
        </mesh>
        {/* Gold edge accent — thin frame on vertical plane */}
        <mesh rotation={[0, 0.4, 0]}>
          <ringGeometry args={[0.58, 0.6, 4]} />
          <meshStandardMaterial
            color="#C9A84C"
            metalness={0.9}
            roughness={0.2}
            emissive="#E2C97E"
            emissiveIntensity={0.15}
          />
        </mesh>
      </group>
    </Float>
  );
}
