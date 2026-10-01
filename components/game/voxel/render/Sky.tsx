"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { BiomeKit } from "../types";

function SkyGradient({ sky, horizon }: { sky: string; horizon: string }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (mesh.current) mesh.current.position.copy(camera.position);
  });
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { sky: { value: new THREE.Color(sky) }, horizon: { value: new THREE.Color(horizon) } },
        vertexShader: "varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "varying vec3 v;uniform vec3 sky;uniform vec3 horizon;void main(){float t=smoothstep(-.15,.6,normalize(v).y);gl_FragColor=vec4(mix(horizon,sky,t),1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}",
      }),
    [sky, horizon],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh ref={mesh} renderOrder={-1} material={material} frustumCulled={false}>
      <sphereGeometry args={[150, 24, 16]} />
    </mesh>
  );
}

function StarField({ count = 1800 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 20260930;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // deterministic, so re-renders are stable
    for (let i = 0; i < count; i++) {
      const r = 60 + rnd() * 80,
        a = rnd() * Math.PI * 2,
        b = Math.acos(rnd() * 2 - 1);
      positions[i * 3] = r * Math.sin(b) * Math.cos(a);
      positions[i * 3 + 1] = r * Math.cos(b);
      positions[i * 3 + 2] = r * Math.sin(b) * Math.sin(a);
      const tint = rnd();
      colors[i * 3] = 0.8 + tint * 0.2;
      colors[i * 3 + 1] = 0.85 + tint * 0.15;
      colors[i * 3 + 2] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ camera, clock }) => {
    if (!points.current) return;
    points.current.position.copy(camera.position);
    points.current.rotation.y = clock.elapsedTime * 0.01;
  });
  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={0.9} vertexColors sizeAttenuation toneMapped={false} />
    </points>
  );
}

export function Sky({ kit }: { kit: BiomeKit }) {
  return (
    <>
      <color attach="background" args={[kit.sky]} />
      {kit.fog && <fog attach="fog" args={[kit.fog, kit.fogNear, kit.fogFar]} />}
      {kit.id === "void" ? <StarField /> : <SkyGradient sky={kit.sky} horizon={kit.skyLow} />}
      <hemisphereLight args={[kit.sky, kit.skyLow, kit.ambient]} />
    </>
  );
}
