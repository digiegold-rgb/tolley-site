"use client";

import { useRef } from "react";
import { Float } from "@react-three/drei";
import { Group } from "three";

/**
 * Architectural gold prism — beveled building silhouette.
 * Replaces the childish house with a premium geometric form.
 */
export function FloatingHouse({ position = [0, 0, 0] as [number, number, number] }) {
  const group = useRef<Group>(null);

  return (
    <Float speed={0.8} rotationIntensity={0.15} floatIntensity={0.3}>
      <group ref={group} position={position} rotation={[0.1, 0.3, 0]}>
        {/* Main tower — tall beveled prism */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.6, 1.8, 0.4]} />
          <meshStandardMaterial
            color="#C9A84C"
            metalness={0.85}
            roughness={0.25}
            envMapIntensity={1.2}
          />
        </mesh>
        {/* Secondary block — offset shorter prism */}
        <mesh position={[0.5, -0.3, 0.1]}>
          <boxGeometry args={[0.5, 1.2, 0.35]} />
          <meshStandardMaterial
            color="#8B7432"
            metalness={0.8}
            roughness={0.3}
            envMapIntensity={1.0}
          />
        </mesh>
        {/* Accent step — base terrace */}
        <mesh position={[0.15, -0.85, 0.25]}>
          <boxGeometry args={[1.3, 0.12, 0.6]} />
          <meshStandardMaterial
            color="#D4B978"
            metalness={0.9}
            roughness={0.2}
            envMapIntensity={1.4}
          />
        </mesh>
        {/* Thin vertical accent line */}
        <mesh position={[-0.35, 0, 0.21]}>
          <boxGeometry args={[0.02, 1.6, 0.02]} />
          <meshStandardMaterial
            color="#E2C97E"
            emissive="#E2C97E"
            emissiveIntensity={0.25}
            metalness={0.95}
            roughness={0.1}
          />
        </mesh>
      </group>
    </Float>
  );
}
