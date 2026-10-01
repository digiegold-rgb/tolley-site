"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FRIEND_BY_ID } from "../../worlds/friends";
import type { VoxelGame } from "../model";
import type { Entity } from "../types";

const gold = "#ffd23a";

function Coins({ game }: { game: VoxelGame }) {
  const coins = useMemo(() => game.entities("coin"), [game]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    coins.forEach((c, i) => {
      const taken = game.collected.has(c.id);
      dummy.position.set(c.at.x, c.at.y + 0.6 + Math.sin(game.time * 3 + i) * 0.1, c.at.z);
      dummy.rotation.set(0, game.time * 2 + i, 0);
      dummy.scale.setScalar(taken ? 0 : 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(1, coins.length)]} frustumCulled={false}>
      <boxGeometry args={[0.42, 0.42, 0.14]} />
      <meshLambertMaterial color={gold} emissive="#5a4300" toneMapped={false} />
    </instancedMesh>
  );
}

function Key({ e, game }: { e: Extract<Entity, { kind: "key" }>; game: VoxelGame }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current) return;
    g.current.visible = !game.collected.has(e.id);
    g.current.position.set(e.at.x, e.at.y + 0.7 + Math.sin(game.time * 2.5) * 0.12, e.at.z);
    g.current.rotation.y = game.time * 1.6;
  });
  return (
    <group ref={g}>
      <mesh castShadow>
        <torusGeometry args={[0.28, 0.1, 8, 16]} />
        <meshLambertMaterial color={gold} emissive="#6b5200" toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[0.14, 0.6, 0.14]} />
        <meshLambertMaterial color={gold} emissive="#6b5200" toneMapped={false} />
      </mesh>
      <mesh position={[0.14, -0.7, 0]}>
        <boxGeometry args={[0.28, 0.12, 0.14]} />
        <meshLambertMaterial color={gold} emissive="#6b5200" toneMapped={false} />
      </mesh>
      <pointLight color={gold} intensity={3} distance={5} decay={1.5} />
    </group>
  );
}

function Star({ e, game }: { e: Extract<Entity, { kind: "star" }>; game: VoxelGame }) {
  const g = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!g.current) return;
    g.current.visible = !game.saveData.stars.includes(e.id);
    g.current.position.set(e.at.x, e.at.y + 0.8 + Math.sin(game.time * 2) * 0.15, e.at.z);
    g.current.rotation.set(game.time, game.time * 1.3, 0);
  });
  return (
    <mesh ref={g} castShadow>
      <octahedronGeometry args={[0.45]} />
      <meshLambertMaterial color="#ff7ad9" emissive="#7a1f5c" toneMapped={false} />
    </mesh>
  );
}

function Checkpoint({ e, game }: { e: Extract<Entity, { kind: "checkpoint" }>; game: VoxelGame }) {
  const flag = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshLambertMaterial>(null);
  useFrame(() => {
    if (!flag.current || !mat.current) return;
    const lit = game.checkpointIndex >= e.index;
    mat.current.color.set(lit ? "#4ade80" : "#cbd5e1");
    mat.current.emissive.set(lit ? "#0f5132" : "#000000");
    flag.current.rotation.y = lit ? game.time * 2 : 0;
  });
  return (
    <group position={[e.at.x, e.at.y, e.at.z]}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[0.16, 2, 0.16]} />
        <meshLambertMaterial color="#475569" toneMapped={false} />
      </mesh>
      <mesh ref={flag} position={[0, 2.1, 0]} castShadow>
        <octahedronGeometry args={[0.45]} />
        <meshLambertMaterial ref={mat} color="#cbd5e1" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Switch({ e, game }: { e: Extract<Entity, { kind: "switch" }>; game: VoxelGame }) {
  const lever = useRef<THREE.Group>(null);
  const knob = useRef<THREE.MeshLambertMaterial>(null);
  useFrame(() => {
    if (!lever.current || !knob.current) return;
    const on = game.switches.has(e.id);
    lever.current.rotation.x = THREE.MathUtils.lerp(lever.current.rotation.x, on ? 0.7 : -0.7, 0.15);
    knob.current.color.set(on ? "#4ade80" : "#ff5a3c");
  });
  return (
    <group position={[e.at.x, e.at.y, e.at.z]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.7]} />
        <meshLambertMaterial color="#2f3542" toneMapped={false} />
      </mesh>
      <group ref={lever} position={[0, 0.4, 0]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.12, 0.9, 0.12]} />
          <meshLambertMaterial color="#94a3b8" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshLambertMaterial ref={knob} color="#ff5a3c" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

function Cage({ game, index }: { game: VoxelGame; index: number }) {
  const g = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Mesh>(null);
  const cage = game.cages[index];
  const color = FRIEND_BY_ID[cage.friend].color;
  useFrame(() => {
    if (!g.current || !inner.current) return;
    const freed = game.saveData.rescued.includes(cage.friend);
    g.current.visible = !freed;
    const cracked = 1 - cage.hp / cage.max;
    g.current.rotation.z = Math.sin(game.time * 30) * cracked * 0.05;
    inner.current.position.y = 0.7 + Math.sin(game.time * 4) * 0.08;
    inner.current.rotation.y = game.time * 1.5;
    g.current.scale.setScalar(1 + cracked * 0.08);
  });
  return (
    <group ref={g} position={[cage.at.x, cage.at.y, cage.at.z]}>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[1.4, 1.4, 1.4]} />
        <meshLambertMaterial color="#e2e8f0" transparent opacity={0.28} toneMapped={false} />
      </mesh>
      <lineSegments position={[0, 0.7, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(1.4, 1.4, 1.4)]} />
        <lineBasicMaterial color="#334155" />
      </lineSegments>
      {[-0.47, 0, 0.47].flatMap((x) =>
        [-0.7, 0.7].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.7, z]}>
            <boxGeometry args={[0.08, 1.4, 0.08]} />
            <meshLambertMaterial color="#64748b" toneMapped={false} />
          </mesh>
        )),
      )}
      <mesh ref={inner} castShadow>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshLambertMaterial color={color} emissive={color} emissiveIntensity={0.35} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Portal({ game }: { game: VoxelGame }) {
  const ring = useRef<THREE.Mesh>(null);
  const disc = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshLambertMaterial>(null);
  const discMat = useRef<THREE.MeshBasicMaterial>(null);
  const p = game.def.portal;
  useFrame(() => {
    if (!ring.current || !disc.current || !ringMat.current || !discMat.current) return;
    const open = game.portalOpen;
    ring.current.rotation.z = game.time * (open ? 1.6 : 0.3);
    disc.current.scale.setScalar(open ? 1 + Math.sin(game.time * 5) * 0.08 : 0.35);
    ringMat.current.color.set(open ? "#5eead4" : "#7c3aed");
    ringMat.current.emissive.set(open ? "#0d9488" : "#2e1065");
    discMat.current.color.set(open ? "#a5f3fc" : "#312e81");
    discMat.current.opacity = open ? 0.85 : 0.5;
  });
  return (
    <group position={[p.x, p.y + 1.6, p.z]}>
      <mesh ref={ring} castShadow>
        <torusGeometry args={[1.35, 0.2, 10, 28]} />
        <meshLambertMaterial ref={ringMat} color="#7c3aed" toneMapped={false} />
      </mesh>
      <mesh ref={disc}>
        <circleGeometry args={[1.15, 28]} />
        <meshBasicMaterial ref={discMat} color="#312e81" transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <pointLight color="#8be9fd" intensity={4} distance={9} decay={1.5} />
    </group>
  );
}

function Sign({ e }: { e: Extract<Entity, { kind: "sign" }> }) {
  return (
    <group position={[e.at.x, e.at.y, e.at.z]}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.14, 1, 0.14]} />
        <meshLambertMaterial color="#7c4a1e" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[1.2, 0.7, 0.1]} />
        <meshLambertMaterial color="#fff7d6" toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.25, 0.06]}>
        <boxGeometry args={[0.9, 0.08, 0.02]} />
        <meshBasicMaterial color="#1e293b" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Entities({ game }: { game: VoxelGame }) {
  const ents = game.def.entities;
  return (
    <>
      <Coins game={game} />
      {ents.map((e, i) =>
        e.kind === "key" ? (
          <Key key={e.id} e={e} game={game} />
        ) : e.kind === "star" ? (
          <Star key={e.id} e={e} game={game} />
        ) : e.kind === "checkpoint" ? (
          <Checkpoint key={`cp${e.index}`} e={e} game={game} />
        ) : e.kind === "switch" ? (
          <Switch key={e.id} e={e} game={game} />
        ) : e.kind === "sign" ? (
          <Sign key={`sign${i}`} e={e} />
        ) : null,
      )}
      {game.cages.map((c, i) => (
        <Cage key={c.friend} game={game} index={i} />
      ))}
      <Portal game={game} />
    </>
  );
}
