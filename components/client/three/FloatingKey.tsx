"use client";

import { Float } from "@react-three/drei";

/**
 * Gold arc / ring segment — abstract luxury accent.
 * Thin metallic arc that catches light beautifully.
 */
export function FloatingKey({ position = [0, 0, 0] as [number, number, number] }) {
  return (
    <Float speed={1.0} rotationIntensity={0.2} floatIntensity={0.4}>
      <group position={position} rotation={[0.3, 0, 0.5]}>
        {/* Primary arc — partial torus */}
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[0.8, 0.04, 8, 32, Math.PI * 1.3]} />
          <meshStandardMaterial
            color="#C9A84C"
            metalness={0.9}
            roughness={0.15}
            envMapIntensity={1.5}
          />
        </mesh>
        {/* Inner ring — thinner, slightly darker */}
        <mesh rotation={[0.2, 0, 0.3]}>
          <torusGeometry args={[0.55, 0.02, 8, 24, Math.PI * 0.9]} />
          <meshStandardMaterial
            color="#D4B978"
            metalness={0.95}
            roughness={0.1}
            emissive="#E2C97E"
            emissiveIntensity={0.1}
          />
        </mesh>
      </group>
    </Float>
  );
}
