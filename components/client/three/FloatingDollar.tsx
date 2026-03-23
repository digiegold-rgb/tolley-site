"use client";

import { Float, Text } from "@react-three/drei";

/**
 * Gold metallic dollar sign — subtle premium accent.
 */
export function FloatingDollar({ position = [0, 0, 0] as [number, number, number] }) {
  return (
    <Float speed={0.7} rotationIntensity={0.08} floatIntensity={0.2}>
      <Text
        position={position}
        fontSize={0.8}
        fontWeight={700}
        anchorX="center"
        anchorY="middle"
      >
        $
        <meshStandardMaterial
          color="#C9A84C"
          metalness={0.85}
          roughness={0.25}
          emissive="#E2C97E"
          emissiveIntensity={0.12}
        />
      </Text>
    </Float>
  );
}
