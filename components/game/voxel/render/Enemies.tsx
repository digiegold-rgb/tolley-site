"use client";
/* Enemy, boss and projectile bodies read the simulation every frame; they are not React state. */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { EnemyState, VoxelGame } from "../model";
import { BOSSES } from "../types";

const STEEL = "#8f9ab0",
  DARK = "#2f3542",
  YELLOW = "#ffc63a",
  RED = "#ff3b3b";

/** Shared gear shape: a disc with eight teeth. */
function useGear(radius = 0.45) {
  return useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const disc = new THREE.CylinderGeometry(radius, radius, radius * 0.35, 12);
    disc.rotateX(Math.PI / 2);
    parts.push(disc);
    for (let i = 0; i < 8; i++) {
      const tooth = new THREE.BoxGeometry(radius * 0.42, radius * 0.42, radius * 0.35);
      const a = (i / 8) * Math.PI * 2;
      tooth.rotateZ(a);
      tooth.translate(Math.cos(a) * radius * 1.05, Math.sin(a) * radius * 1.05, 0);
      parts.push(tooth);
    }
    const hole = new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, radius * 0.4, 8);
    hole.rotateX(Math.PI / 2);
    parts.push(hole);
    return mergeGeometries(parts);
  }, [radius]);
}
/** Minimal merge (positions/normals only) so we avoid pulling in the examples utils. */
export function mergeGeometries(list: THREE.BufferGeometry[]) {
  const nonIndexed = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of nonIndexed) count += g.attributes.position.count;
  const pos = new Float32Array(count * 3),
    nor = new Float32Array(count * 3);
  let o = 0;
  for (const g of nonIndexed) {
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return out;
}

function BoltBot({ e, game }: { e: EnemyState; game: VoxelGame }) {
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.MeshLambertMaterial>(null);
  const eye = useRef<THREE.MeshBasicMaterial>(null);
  const treads = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current || !body.current || !eye.current || !treads.current) return;
    g.current.visible = !e.dead;
    if (e.dead) return;
    g.current.position.set(e.at.x, e.at.y, e.at.z);
    g.current.rotation.y = THREE.MathUtils.lerp(g.current.rotation.y, g.current.rotation.y + Math.atan2(Math.sin(e.yaw - g.current.rotation.y), Math.cos(e.yaw - g.current.rotation.y)), 0.2);
    body.current.emissive.set(e.flash > 0 ? "#ffffff" : "#000000");
    body.current.emissiveIntensity = e.flash > 0 ? 0.8 : 0;
    eye.current.color.set(e.stun > 0.4 ? "#7dd3fc" : "#ff3b3b");
    const bob = e.stun > 0 ? 0 : Math.abs(Math.sin(game.time * 9)) * 0.06;
    treads.current.position.y = bob;
    g.current.scale.setScalar(1 + (e.hp < e.max ? 0 : 0));
  });
  return (
    <group ref={g}>
      <group ref={treads}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.9, 0.36, 0.9]} />
          <meshLambertMaterial color={DARK} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.62, 0]} castShadow>
          <boxGeometry args={[0.76, 0.5, 0.7]} />
          <meshLambertMaterial ref={body} color={STEEL} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.02, 0]} castShadow>
          <boxGeometry args={[0.56, 0.4, 0.56]} />
          <meshLambertMaterial color={YELLOW} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.04, 0.29]}>
          <boxGeometry args={[0.34, 0.14, 0.04]} />
          <meshBasicMaterial ref={eye} color={RED} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.34, 0]}>
          <boxGeometry args={[0.06, 0.28, 0.06]} />
          <meshLambertMaterial color={STEEL} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshBasicMaterial color={RED} toneMapped={false} />
        </mesh>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.62, 0]}>
            <boxGeometry args={[0.16, 0.3, 0.3]} />
            <meshLambertMaterial color={DARK} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Foreman({ game }: { game: VoxelGame }) {
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.MeshLambertMaterial>(null);
  const visor = useRef<THREE.MeshBasicMaterial>(null);
  const button = useRef<THREE.MeshBasicMaterial>(null);
  const buttonMesh = useRef<THREE.Mesh>(null);
  const arms = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  const kit = BOSSES.foreman;
  useFrame(() => {
    const b = game.boss;
    if (!g.current || !b || !body.current || !visor.current || !button.current || !arms.current || !buttonMesh.current || !light.current) return;
    g.current.visible = b.state !== "dead";
    if (b.state === "dead") return;
    g.current.position.set(b.at.x, b.at.y, b.at.z);
    g.current.rotation.y = THREE.MathUtils.lerp(g.current.rotation.y, g.current.rotation.y + Math.atan2(Math.sin(b.yaw - g.current.rotation.y), Math.cos(b.yaw - g.current.rotation.y)), 0.18);
    const shake = b.state === "windup" ? Math.sin(game.time * 60) * 0.06 : 0;
    g.current.position.x += shake;
    const tilt = b.state === "charge" ? 0.25 : b.state === "stagger" ? -0.35 : 0;
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, tilt, 0.2);
    body.current.emissive.set(b.flash > 0 ? "#ffffff" : "#000000");
    body.current.emissiveIntensity = b.flash > 0 ? 0.9 : 0;
    visor.current.color.set(b.state === "charge" || b.state === "windup" ? "#ff3b3b" : b.state === "stagger" ? "#7dd3fc" : "#ffd23a");
    const open = b.state === "stagger";
    const pulse = open ? 0.75 + Math.sin(game.time * 14) * 0.25 : 0.25;
    button.current.color.setRGB(1, pulse * 0.35, pulse * 0.2);
    buttonMesh.current.scale.setScalar(open ? 1.25 + Math.sin(game.time * 14) * 0.12 : 1);
    light.current.intensity = open ? 6 : 0;
    arms.current.rotation.x = b.state === "charge" ? -0.9 : b.state === "stagger" ? 0.6 : Math.sin(game.time * 2) * 0.1;
  });
  return (
    <group ref={g}>
      {/* legs */}
      {[-0.65, 0.65].map((x) => (
        <mesh key={x} position={[x, 0.45, 0]} castShadow>
          <boxGeometry args={[0.7, 0.9, 0.9]} />
          <meshLambertMaterial color={DARK} toneMapped={false} />
        </mesh>
      ))}
      {/* torso */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <boxGeometry args={[kit.hw * 2, 1.4, 1.7]} />
        <meshLambertMaterial ref={body} color="#4b5365" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.55, 0.86]}>
        <boxGeometry args={[1.6, 0.9, 0.06]} />
        <meshLambertMaterial color={YELLOW} toneMapped={false} />
      </mesh>
      {/* head + visor */}
      <mesh position={[0, 2.5, 0.1]} castShadow>
        <boxGeometry args={[1.2, 0.8, 1]} />
        <meshLambertMaterial color={STEEL} toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.52, 0.62]}>
        <boxGeometry args={[0.9, 0.26, 0.06]} />
        <meshBasicMaterial ref={visor} color={YELLOW} toneMapped={false} />
      </mesh>
      {/* hard hat */}
      <mesh position={[0, 3.0, 0.05]} castShadow>
        <boxGeometry args={[1.4, 0.28, 1.2]} />
        <meshLambertMaterial color={YELLOW} toneMapped={false} />
      </mesh>
      <mesh position={[0, 3.24, 0]}>
        <boxGeometry args={[0.9, 0.3, 0.8]} />
        <meshLambertMaterial color={YELLOW} toneMapped={false} />
      </mesh>
      {/* arms */}
      <group ref={arms} position={[0, 2.1, 0]}>
        {[-1.45, 1.45].map((x) => (
          <group key={x} position={[x, -0.6, 0.2]}>
            <mesh castShadow>
              <boxGeometry args={[0.5, 1.3, 0.5]} />
              <meshLambertMaterial color={STEEL} toneMapped={false} />
            </mesh>
            <mesh position={[0, -0.85, 0]} castShadow>
              <boxGeometry args={[0.7, 0.5, 0.7]} />
              <meshLambertMaterial color={DARK} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
      {/* the weak point: a big red button on his back */}
      <mesh ref={buttonMesh} position={[0, 1.7, -0.95]}>
        <boxGeometry args={[0.6, 0.6, 0.3]} />
        <meshBasicMaterial ref={button} color={RED} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 1.7, -1.6]} color="#ff5a3c" intensity={0} distance={7} decay={1.5} />
    </group>
  );
}

function Gears({ game }: { game: VoxelGame }) {
  const geometry = useGear(0.5);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    let n = 0;
    for (const pr of game.projectiles) {
      dummy.position.set(pr.x, pr.y, pr.z);
      dummy.rotation.set(0, Math.atan2(pr.vx, pr.vz), pr.spin);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      m.setColorAt(n, color.set(pr.owner === "hero" ? "#7de3ff" : "#ffbd58"));
      if (++n >= 8) break;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, 8]} frustumCulled={false}>
      <meshLambertMaterial toneMapped={false} />
    </instancedMesh>
  );
}

export function Enemies({ game }: { game: VoxelGame }) {
  return (
    <>
      {game.enemies.map((e) => (
        <BoltBot key={e.id} e={e} game={game} />
      ))}
      {game.boss && <Foreman game={game} />}
      <Gears game={game} />
    </>
  );
}
