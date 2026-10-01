"use client";
/* Decorative props: instanced, never collide. Gears spin, stacks and vents breathe smoke. */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VoxelGame } from "../model";
import type { BiomeKit, Entity } from "../types";
import { mergeGeometries } from "./Enemies";

type Prop = Extract<Entity, { kind: "prop" }>;

function useProps(game: VoxelGame) {
  return useMemo(() => {
    const by: Record<Prop["type"], Prop[]> = { gear: [], stack: [], lamp: [], vent: [], crane: [] };
    for (const e of game.def.entities) if (e.kind === "prop") by[e.type].push(e);
    return by;
  }, [game]);
}

function gearGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const disc = new THREE.CylinderGeometry(1, 1, 0.3, 14);
  disc.rotateX(Math.PI / 2);
  parts.push(disc);
  for (let i = 0; i < 10; i++) {
    const t = new THREE.BoxGeometry(0.38, 0.38, 0.3);
    const a = (i / 10) * Math.PI * 2;
    t.rotateZ(a);
    t.translate(Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0);
    parts.push(t);
  }
  const hub = new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8);
  hub.rotateX(Math.PI / 2);
  parts.push(hub);
  return mergeGeometries(parts);
}

function Gears({ list, game }: { list: Prop[]; game: VoxelGame }) {
  const geometry = useMemo(() => gearGeometry(), []);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    list.forEach((p, i) => {
      dummy.position.set(p.at.x, p.at.y, p.at.z);
      dummy.rotation.set(0, p.rot ?? 0, game.time * (i % 2 ? 0.8 : -0.6));
      dummy.scale.setScalar(p.scale ?? 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  if (!list.length) return null;
  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, list.length]} castShadow>
      <meshLambertMaterial color="#ffbd58" toneMapped={false} />
    </instancedMesh>
  );
}

function Stacks({ list, game }: { list: Prop[]; game: VoxelGame }) {
  const towers = useRef<THREE.InstancedMesh>(null);
  const bands = useRef<THREE.InstancedMesh>(null);
  const smoke = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const H = 17,
    PUFFS = 10;
  useFrame(() => {
    if (!towers.current || !bands.current || !smoke.current) return;
    list.forEach((p, i) => {
      dummy.position.set(p.at.x, p.at.y + H / 2, p.at.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      towers.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.at.x, p.at.y + H - 1.2, p.at.z);
      dummy.scale.set(1.25, 0.4, 1.25);
      dummy.updateMatrix();
      bands.current!.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < PUFFS; j++) {
        const t = ((game.time * 0.35 + j / PUFFS + i * 0.13) % 1 + 1) % 1;
        dummy.position.set(p.at.x + Math.sin(t * 6 + j) * (0.6 + t * 2.2), p.at.y + H + t * 9, p.at.z + Math.cos(t * 5 + j) * (0.6 + t * 2.2));
        const s = (0.8 + t * 2.4) * (1 - t * 0.35);
        dummy.scale.set(s, s, s);
        dummy.rotation.set(t * 3, j, t * 2);
        dummy.updateMatrix();
        smoke.current!.setMatrixAt(i * PUFFS + j, dummy.matrix);
      }
    });
    towers.current.instanceMatrix.needsUpdate = true;
    bands.current.instanceMatrix.needsUpdate = true;
    smoke.current.instanceMatrix.needsUpdate = true;
  });
  if (!list.length) return null;
  return (
    <>
      <instancedMesh ref={towers} args={[undefined, undefined, list.length]} castShadow>
        <boxGeometry args={[3, H, 3]} />
        <meshLambertMaterial color="#5d6577" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={bands} args={[undefined, undefined, list.length]}>
        <boxGeometry args={[3, 1, 3]} />
        <meshLambertMaterial color="#ffc63a" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={smoke} args={[undefined, undefined, list.length * PUFFS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#dfe6f0" transparent opacity={0.55} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function Lamps({ list }: { list: Prop[] }) {
  const posts = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const placed = useRef(false);
  useFrame(() => {
    if (placed.current || !posts.current || !heads.current) return;
    list.forEach((p, i) => {
      dummy.position.set(p.at.x, p.at.y + 1.3, p.at.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      posts.current!.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.at.x, p.at.y + 2.75, p.at.z);
      dummy.updateMatrix();
      heads.current!.setMatrixAt(i, dummy.matrix);
    });
    posts.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    placed.current = true;
  });
  if (!list.length) return null;
  return (
    <>
      <instancedMesh ref={posts} args={[undefined, undefined, list.length]} castShadow>
        <boxGeometry args={[0.18, 2.6, 0.18]} />
        <meshLambertMaterial color="#2f3542" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, list.length]}>
        <boxGeometry args={[0.6, 0.4, 0.6]} />
        <meshBasicMaterial color="#fff1a8" toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function Vents({ list, game }: { list: Prop[]; game: VoxelGame }) {
  const grates = useRef<THREE.InstancedMesh>(null);
  const steam = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const PUFFS = 6;
  useFrame(() => {
    if (!grates.current || !steam.current) return;
    list.forEach((p, i) => {
      dummy.position.set(p.at.x, p.at.y + 0.1, p.at.z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      grates.current!.setMatrixAt(i, dummy.matrix);
      const burst = (game.time * 0.5 + i * 0.37) % 1; // hiss for the first 40% of each cycle
      for (let j = 0; j < PUFFS; j++) {
        const t = (burst * 2.5 - j / PUFFS + 1) % 1;
        const on = burst < 0.4 && t > 0 && t < 0.4 * 2.5;
        const s = on ? 0.3 + t * 0.9 : 0;
        dummy.position.set(p.at.x + Math.sin(j * 2.1) * t * 0.6, p.at.y + 0.3 + t * 2.6, p.at.z + Math.cos(j * 2.1) * t * 0.6);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        steam.current!.setMatrixAt(i * PUFFS + j, dummy.matrix);
      }
    });
    grates.current.instanceMatrix.needsUpdate = true;
    steam.current.instanceMatrix.needsUpdate = true;
  });
  if (!list.length) return null;
  return (
    <>
      <instancedMesh ref={grates} args={[undefined, undefined, list.length]}>
        <boxGeometry args={[0.9, 0.2, 0.9]} />
        <meshLambertMaterial color="#2f3542" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={steam} args={[undefined, undefined, list.length * PUFFS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function Cranes({ list, game }: { list: Prop[]; game: VoxelGame }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    list.forEach((p, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.set(p.at.x + Math.sin(game.time * 0.4 + i) * 4, p.at.y - 0.2, p.at.z);
    });
  });
  return (
    <>
      {list.map((p, i) => (
        <group key={i} ref={(el) => (refs.current[i] = el)}>
          <mesh>
            <boxGeometry args={[1.2, 0.5, 0.9]} />
            <meshLambertMaterial color="#ffc63a" toneMapped={false} />
          </mesh>
          <mesh position={[0, -1.6, 0]}>
            <boxGeometry args={[0.08, 2.8, 0.08]} />
            <meshLambertMaterial color="#2f3542" toneMapped={false} />
          </mesh>
          <mesh position={[0, -3.2, 0]} castShadow>
            <boxGeometry args={[0.9, 0.5, 0.9]} />
            <meshLambertMaterial color="#8f9ab0" toneMapped={false} />
          </mesh>
          <mesh position={[0, -4, 0]} castShadow>
            <boxGeometry args={[1.4, 1.1, 1.4]} />
            <meshLambertMaterial color="#5d6577" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function Props({ game, kit }: { game: VoxelGame; kit: BiomeKit }) {
  const by = useProps(game);
  void kit;
  return (
    <>
      <Gears list={by.gear} game={game} />
      <Stacks list={by.stack} game={game} />
      <Lamps list={by.lamp} />
      <Vents list={by.vent} game={game} />
      <Cranes list={by.crane} game={game} />
    </>
  );
}
