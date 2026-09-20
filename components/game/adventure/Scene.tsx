'use client';

/* The fixed-step engine and input are intentionally mutable external systems, not React state.
   React receives their read-only HUD snapshots in AdventureShell. */
/* eslint-disable react-hooks/immutability */

import { useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Physics, RigidBody, CuboidCollider, CapsuleCollider, useRapier, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { AdventureGame, BLOCKS, CHECKPOINTS, GATES, SEALS, SECRETS, SWITCHES, TARGETS, type Hero } from './model';
import { AdventureInput } from './input';

type Props = { game: AdventureGame; input: AdventureInput; playing: boolean; title: boolean; onPause: () => void; onReady: () => void; onFailure: () => void };
type V3 = [number, number, number];
function Box({ at, size, color, rotation, solid = false }: { at: V3; size: V3; color: string; rotation?: V3; solid?: boolean }) {
  const mesh = <mesh position={at} rotation={rotation} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.95} /></mesh>;
  return solid ? <RigidBody type="fixed" colliders="cuboid">{mesh}</RigidBody> : mesh;
}
function Rock({ at, scale = 1 }: { at: V3; scale?: number }) {
  return <RigidBody type="fixed" colliders="hull"><mesh position={at} scale={[scale * 1.2, scale * .8, scale]} castShadow receiveShadow><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#7d9280" flatShading /></mesh></RigidBody>;
}
function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return <group position={[x, 0, z]} scale={scale}>
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[.32, 2, .32]} position={[0, 2, 0]} /></RigidBody>
    <mesh position={[0, 2, 0]} castShadow><cylinderGeometry args={[.22, .45, 4, 6]} /><meshStandardMaterial color="#786347" /></mesh>
    {[0, 1, 2].map(i => <mesh key={i} position={[0, 3.5 + i * 1.2, 0]} castShadow><coneGeometry args={[2.6 - i * .65, 3.5, 7]} /><meshStandardMaterial color={['#265b47', '#377856', '#55916a'][i]} flatShading /></mesh>)}
  </group>;
}
function Arch({ z, big = false }: { z: number; big?: boolean }) {
  return <group>
    {[-1, 1].map(s => <group key={s}>
      <Box at={[s * (big ? 5 : 3), 2.7, z]} size={[1.5, 5.4, 2]} color="#9aab98" solid />
      <Box at={[s * (big ? 5 : 3), .3, z]} size={[2, .6, 2.5]} color="#bbc4a3" />
      <Box at={[s * (big ? 5 : 3), 5.2, z]} size={[2, .5, 2.5]} color="#c0c8ae" />
    </group>)}
    <Box at={[0, 5.7, z]} size={[big ? 12 : 8, 1, 2]} color="#acb99c" solid />
    <mesh position={[0, 5.8, z + 1.02]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.45, .09, 5, 6]} /><meshStandardMaterial color="#f7ce76" emissive="#a67429" emissiveIntensity={.45} /></mesh>
  </group>;
}
function Beacon({ at, active, small = false }: { at: V3; active: boolean; small?: boolean }) {
  return <group position={at} scale={small ? .65 : 1}>
    <mesh position={[0, .25, 0]} receiveShadow><cylinderGeometry args={[.8, 1, .5, 6]} /><meshStandardMaterial color="#8e9d85" /></mesh>
    <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[.25, .4, 1.2, 6]} /><meshStandardMaterial color="#b0ba95" /></mesh>
    <mesh position={[0, 2, 0]}><octahedronGeometry args={[.48]} /><meshStandardMaterial color={active ? '#a1ffe4' : '#ffcf78'} emissive={active ? '#4ce6bd' : '#ffb03b'} emissiveIntensity={1.4} /></mesh>
    {!small && <mesh position={[0, 8, 0]}><cylinderGeometry args={[.07, .15, 12, 6]} /><meshBasicMaterial color={active ? '#80f5d0' : '#ffdda0'} transparent opacity={.28} depthWrite={false} /></mesh>}
  </group>;
}
function Campfire({ at }: { at: V3 }) {
  return <group position={at}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .04, 0]}><ringGeometry args={[.6, 1, 8]} /><meshStandardMaterial color="#8b9683" /></mesh>
    <Box at={[0, .15, 0]} size={[1, .25, .3]} color="#70553b" rotation={[0, .6, 0]} />
    <mesh position={[0, .55, 0]}><coneGeometry args={[.35, .95, 5]} /><meshStandardMaterial color="#ffd38c" emissive="#ff902e" emissiveIntensity={2} /></mesh>
  </group>;
}
function Animal({ hero, sword = true }: { hero: Hero; sword?: boolean }) {
  const color = hero === 'frog' ? '#88c66d' : hero === 'fox' ? '#e79957' : '#b9a5d5';
  return <group>
    <mesh position={[0, -.05, 0]} castShadow><capsuleGeometry args={[.35, .45, 3, 7]} /><meshStandardMaterial color="#3d8070" flatShading /></mesh>
    <mesh position={[0, .57, 0]} castShadow><boxGeometry args={[.69, .6, .56]} /><meshStandardMaterial color={color} /></mesh>
    {[-1, 1].map(s => <group key={s}>
      <mesh position={[s * .21, hero === 'frog' ? .85 : .98, 0]}><coneGeometry args={[.17, hero === 'frog' ? .18 : .4, 4]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[s * .19, .65, .29]}><sphereGeometry args={[.075, 6, 6]} /><meshStandardMaterial color="#203730" /></mesh>
      <mesh position={[s * .21, -.52, .08]} castShadow><boxGeometry args={[.25, .3, .42]} /><meshStandardMaterial color="#534e3d" /></mesh>
    </group>)}
    <mesh position={[0, .45, .32]}><boxGeometry args={[.35, .16, .16]} /><meshStandardMaterial color="#fff0ce" /></mesh>
    <mesh position={[0, .16, -.36]} rotation={[.25, 0, 0]} castShadow><boxGeometry args={[.62, .76, .07]} /><meshStandardMaterial color="#dfb85e" /></mesh>
    {sword && <group position={[.55, .06, .25]} rotation={[.45, 0, -.35]}><Box at={[0, .35, 0]} size={[.12, .85, .09]} color="#dfedd3" /><Box at={[0, 0, 0]} size={[.35, .1, .14]} color="#e9bd61" /></group>}
    <mesh position={[-.48, .05, .17]} rotation={[Math.PI / 2, 0, .2]} castShadow><cylinderGeometry args={[.34, .34, .13, 7]} /><meshStandardMaterial color="#c8ad76" metalness={.1} /></mesh>
  </group>;
}
function World({ game }: { game: AdventureGame }) {
  const trees = useMemo(() => Array.from({ length: 100 }, (_, i) => {
    const x = Math.sin(i * 127.1) * 26; const z = 14 - ((i * 17.37) % 55);
    return { x, z, scale: .75 + ((i * .317) % .7) };
  }).filter(t => Math.abs(t.x) > 5 && !SEALS.some(s => Math.hypot(s.x - t.x, s.z - t.z) < 4) && !SECRETS.some(s => Math.hypot(s.x - t.x, s.z - t.z) < 3)), []);
  return <>
    <Box at={[0, -.65, -12]} size={[58, 1.3, 60]} color="#749268" solid />
    <Box at={[0, -.65, -84]} size={[24, 1.3, 84]} color="#7d8d7b" solid />
    <Box at={[0, .018, -12]} size={[4.7, .025, 60]} color="#b2ab7e" />
    {SEALS.map(s => <group key={s.id}><Box at={[s.x / 2, .025, s.z]} size={[Math.abs(s.x), .03, 2]} color="#a9a47c" /><Beacon at={[s.x, 0, s.z]} active={game.progress.seals.includes(s.id)} /></group>)}
    {trees.map((t, i) => <Tree key={i} {...t} />)}
    {Array.from({ length: 22 }, (_, i) => <Rock key={i} at={[(i % 2 ? -1 : 1) * (26 + Math.sin(i) * 1.2), .2, 15 - i * 2.5]} scale={1.1 + (i % 3) * .35} />)}
    {/* Invisible perimeter colliders keep the woodland routes readable and the camera inside the play space. */}
    <RigidBody type="fixed" colliders={false}><CuboidCollider position={[-29, 3, -12]} args={[.5, 4, 31]} /><CuboidCollider position={[29, 3, -12]} args={[.5, 4, 31]} /><CuboidCollider position={[0, 3, 18]} args={[30, 4, .5]} /><CuboidCollider position={[-20, 3, -42]} args={[8, 4, .5]} /><CuboidCollider position={[20, 3, -42]} args={[8, 4, .5]} /></RigidBody>
    <mesh position={[-23, .035, -19]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[4, 14]} /><meshStandardMaterial color="#6aaeb1" metalness={.3} roughness={.2} /></mesh>
    <Box at={[-23, .18, -21]} size={[4.8, .28, 2]} color="#9b7c51" solid />
    <Box at={[21, 1.1, -32]} size={[5, 2.2, 5]} color="#9ba58a" solid />
    <Box at={[21, .6, -27.5]} size={[3, .3, 5]} rotation={[.42, 0, 0]} color="#aaaf8e" solid />
    {[-19, -13].map(x => <Box key={x} at={[x, 1.6, -36]} size={[1.2, 3.2, 1.2]} color="#a6b297" solid />)}
    <Box at={[-16, 3.4, -36]} size={[8, .7, 1.4]} color="#bdc4a4" />
    <Campfire at={[2, 0, 9]} />
    <Arch z={-43} big />
    {[-12, 12].map(x => <Box key={x} at={[x, 3.1, -85]} size={[1, 6.2, 82]} color="#667e73" solid />)}
    <Box at={[0, 3, -126]} size={[24, 6, 1]} color="#667e73" solid />
    {GATES.map(g => <group key={g.id}>
      <Box at={[-8, 2.3, g.z]} size={[8, 4.6, 1]} color="#8c9e87" solid />
      <Box at={[8, 2.3, g.z]} size={[8, 4.6, 1]} color="#8c9e87" solid />
      {g.id !== 'forest' && <Arch z={g.z} />}
      {!game.progress.solved.includes(g.id) && <RigidBody type="fixed" colliders="cuboid"><mesh position={[0, 2.5, g.z]}><boxGeometry args={[8, 5, .45]} /><meshStandardMaterial color="#c5deb7" emissive="#53ad86" emissiveIntensity={.45} transparent opacity={.55} /></mesh></RigidBody>}
    </group>)}
    {CHECKPOINTS.slice(1).map((p, i) => <Campfire key={i} at={[p.x - 2, 0, p.z]} />)}
    {Array.from({ length: 10 }, (_, i) => <group key={i}>
      <Box at={[-10.5, 1.6, -48 - i * 7.5]} size={[1, 3.2, 1]} color="#a8b698" solid />
      <Box at={[10.5, 1.6, -48 - i * 7.5]} size={[1, 3.2, 1]} color="#a8b698" solid />
      <Box at={[0, .01, -48 - i * 7.5]} size={[3, .04, 3]} color="#9aa68b" />
    </group>)}
    {BLOCKS.map(b => <group key={b.id}>
      <mesh position={[b.plateX, .035, b.plateZ]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.3, 6]} /><meshStandardMaterial color={game.plateActive(b.id) ? '#9fffd3' : '#efc777'} emissive="#cead50" emissiveIntensity={.25} /></mesh>
      <PushBlock game={game} id={b.id} x={b.x} z={b.z} />
    </group>)}
    {SWITCHES.map(s => <Beacon key={s.id} at={[s.x, 0, s.z]} small active={game.switches.includes(s.id) || game.progress.solved.includes('wind')} />)}
    {TARGETS.map((t, i) => <group key={t.id} position={[t.x, t.y, t.z]}>
      <Box at={[0, -1, -.3]} size={[1.6, 3.5, .6]} color="#a4b296" />
      <mesh rotation={[0, 0, i * .3]}><torusGeometry args={[.7, .14, 6, i === 0 ? 16 : i === 1 ? 4 : 8, i === 2 ? Math.PI * 1.5 : Math.PI * 2]} /><meshStandardMaterial color={game.targets.includes(t.id) || game.progress.solved.includes('light') ? '#a4ffcd' : '#ffd880'} emissive="#d6a34a" emissiveIntensity={.5} /></mesh>
      {Array.from({ length: i + 1 }, (_, n) => <mesh key={n} position={[(n - i / 2) * .3, -1.2, .1]}><sphereGeometry args={[.08, 6, 6]} /><meshStandardMaterial color="#ffe0a2" /></mesh>)}
    </group>)}
    <Beacon at={[0, 0, -105]} active={game.progress.solved.includes('echo')} small />
    <mesh position={[0, .03, -118]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[7, 7.3, 32]} /><meshStandardMaterial color="#d0bd7d" /></mesh>
    <group position={[0, 3, -124]}><mesh><torusGeometry args={[2, .3, 6, 16]} /><meshStandardMaterial color="#cbba80" /></mesh><mesh><circleGeometry args={[1.8, 24]} /><meshStandardMaterial color={game.progress.finished ? '#a2ffe2' : '#385649'} emissive="#6afbc4" emissiveIntensity={game.progress.finished ? 1.5 : 0} side={THREE.DoubleSide} /></mesh></group>
    {SECRETS.filter(s => !game.progress.secrets.includes(s.id)).map(s => <mesh key={s.id} position={[s.x, s.y + .55, s.z]} rotation={[0, .5, .3]}><octahedronGeometry args={[.32]} /><meshStandardMaterial color="#ffdf8e" emissive="#ffbe3d" emissiveIntensity={1} /></mesh>)}
    {/* Distant silhouettes are decorative and have no expensive colliders. */}
    {Array.from({ length: 12 }, (_, i) => <mesh key={i} position={[Math.cos(i * .53) * 75, 2, -40 + Math.sin(i * .53) * 80]}><coneGeometry args={[16 + i % 3 * 5, 24 + i % 4 * 8, 5]} /><meshStandardMaterial color={i % 2 ? '#73978a' : '#88aa97'} flatShading /></mesh>)}
  </>;
}
function PushBlock({ game, id, x, z }: { game: AdventureGame; id: string; x: number; z: number }) {
  const body = useRef<RapierRigidBody>(null); const reset = useRef(game.blockReset);
  const { rapier } = useRapier();
  const plate = BLOCKS.find(b => b.id === id)!;
  useBeforePhysicsStep(() => {
    if (!body.current) return;
    if (reset.current !== game.blockReset) { body.current.setBodyType(rapier.RigidBodyType.Dynamic, true); body.current.setTranslation({ x, y: .6, z }, true); body.current.setLinvel({ x: 0, y: 0, z: 0 }, true); reset.current = game.blockReset; }
    const p = body.current.translation();
    if (p.y < -3 || Math.abs(p.x) > 10 || Math.abs(p.z - z) > 6) { body.current.setTranslation({ x, y: .6, z }, true); body.current.setLinvel({ x: 0, y: 0, z: 0 }, true); }
    // Heavy puzzle stones should settle predictably, rather than skid past the solution.
    const v = body.current.linvel(); const speed = Math.hypot(v.x, v.z);
    if (speed > 2.2) body.current.setLinvel({ x: v.x / speed * 2.2, y: v.y, z: v.z / speed * 2.2 }, true);
    if (Math.hypot(p.x - plate.plateX, p.z - plate.plateZ) < 1.15) {
      body.current.setTranslation({ x: plate.plateX, y: .6, z: plate.plateZ }, true);
      body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.current.setBodyType(rapier.RigidBodyType.Fixed, true);
    }
    const actual = body.current.translation(); game.blocks[id] = { x: actual.x, z: actual.z };
  });
  return <RigidBody ref={body} position={[x, .6, z]} colliders="cuboid" enabledRotations={[false, false, false]} linearDamping={12} friction={.15} mass={3}>
    <mesh castShadow receiveShadow><boxGeometry args={[1.2, 1.2, 1.2]} /><meshStandardMaterial color="#c6cbb1" /></mesh>
    <mesh position={[0, .61, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.23, .36, 4]} /><meshStandardMaterial color="#b7994e" /></mesh>
  </RigidBody>;
}
function Actors({ game }: { game: AdventureGame }) {
  const groups = useRef<(THREE.Group | null)[]>([]); const shots = useRef<(THREE.Mesh | null)[]>([]);
  const cubo = useRef<THREE.Group>(null); const boom = useRef<THREE.Group>(null); const target = useRef<THREE.Mesh>(null);
  const lastRespawn = useRef(-1);
  useFrame((_, dt) => {
    game.enemies.forEach((e, i) => {
      const g = groups.current[i]; if (!g) return; g.visible = e.hp > 0;
      g.position.set(e.x, e.kind === 'boss' ? 1.3 : .65, e.z);
      g.rotation.y = Math.atan2(game.position.x - e.x, game.position.z - e.z);
      g.scale.setScalar((e.kind === 'boss' ? 2 : 1) * (e.phase === 'warn' ? 1 + Math.sin(game.time * 22) * .04 : 1));
      const ring = g.getObjectByName('warning'); if (ring) ring.visible = e.phase === 'warn' || e.stun > 0;
      const body = g.getObjectByName('body') as THREE.Mesh;
      if (body) (body.material as THREE.MeshStandardMaterial).emissive.set(e.flash > 0 ? '#baffd2' : e.stun > 0 ? '#477e89' : '#000000');
    });
    shots.current.forEach((m, i) => { if (!m) return; const s = game.shots[i]; m.visible = !!s; if (s) m.position.set(s.x, 1, s.z); });
    if (cubo.current) {
      const desired = new THREE.Vector3(game.position.x - Math.sin(game.yaw + .7) * 2, game.position.y + .4, game.position.z - Math.cos(game.yaw + .7) * 2);
      if (lastRespawn.current !== game.respawn || cubo.current.position.distanceTo(desired) > 8) { cubo.current.position.copy(desired); lastRespawn.current = game.respawn; }
      if (!game.paused) { cubo.current.position.lerp(desired, 1 - Math.exp(-dt * 3)); cubo.current.rotation.y += dt * .4; }
    }
    if (boom.current) {
      boom.current.visible = game.throwTime > 0;
      if (game.throwTarget) { const f = Math.sin((1 - game.throwTime / .9) * Math.PI); boom.current.position.set(THREE.MathUtils.lerp(game.position.x, game.throwTarget.x, f), 1.7, THREE.MathUtils.lerp(game.position.z, game.throwTarget.z, f)); boom.current.rotation.y = game.time * 25; }
    }
    if (target.current) { const t = game.aimCandidates().find(c => c.id === game.locked); target.current.visible = !!t; if (t) { target.current.position.set(t.x, 3.6, t.z); target.current.rotation.z = game.time; } }
  });
  return <>
    {game.enemies.map((e, i) => <group key={e.id} ref={g => { groups.current[i] = g; }}>
      <mesh name="body" castShadow><dodecahedronGeometry args={[.7, 0]} /><meshStandardMaterial color={e.kind === 'boss' ? '#75917a' : e.kind === 'spitter' ? '#a0b376' : e.kind === 'shield' ? '#9ba5b0' : '#c99d72'} flatShading /></mesh>
      <mesh position={[0, .65, 0]}><coneGeometry args={[.35, .6, 5]} /><meshStandardMaterial color="#7ca567" /></mesh>
      {[-1, 1].map(s => <mesh key={s} position={[s * .23, .1, .59]}><sphereGeometry args={[.09, 6, 6]} /><meshStandardMaterial color="#ffe7b7" emissive="#ffe7b7" emissiveIntensity={.3} /></mesh>)}
      {(e.kind === 'shield' || e.kind === 'boss') && <mesh position={[0, -.1, .7]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.45, .45, .15, 6]} /><meshStandardMaterial color="#ddc18a" /></mesh>}
      <mesh name="warning" position={[0, -.5, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}><ringGeometry args={[.9, 1.05, 20]} /><meshBasicMaterial color="#ffba68" side={THREE.DoubleSide} /></mesh>
    </group>)}
    {Array.from({ length: 24 }, (_, i) => <mesh key={i} ref={m => { shots.current[i] = m; }} visible={false}><icosahedronGeometry args={[.22, 0]} /><meshStandardMaterial color="#fff3ab" emissive="#ffcc44" emissiveIntensity={2} /></mesh>)}
    <group ref={cubo}><mesh castShadow><boxGeometry args={[.55, .55, .55]} /><meshStandardMaterial color="#efcd7b" /></mesh>{[-1, 1].map(s => <mesh key={s} position={[s * .13, .05, .28]}><sphereGeometry args={[.055, 6, 6]} /><meshBasicMaterial color="#3d5e50" /></mesh>)}</group>
    <group ref={boom} visible={false}><Box at={[0, 0, 0]} size={[.9, .1, .18]} color="#ffe3a0" /><Box at={[.35, 0, .3]} size={[.18, .1, .7]} color="#ffe3a0" /></group>
    <mesh ref={target} visible={false}><octahedronGeometry args={[.22]} /><meshBasicMaterial color="#fff4ba" /></mesh>
  </>;
}
function Controller({ game, input, title, onPause, onReady, onFailure }: Props) {
  const body = useRef<RapierRigidBody>(null); const visual = useRef<THREE.Group>(null);
  const spawn = useMemo<V3>(() => [game.position.x, game.position.y, game.position.z], [game]);
  const { world, rapier } = useRapier(); const { camera, gl } = useThree();
  const controlRef = useRef<ReturnType<typeof world.createCharacterController> | null>(null);
  useEffect(() => {
    const c = world.createCharacterController(.025); c.enableAutostep(.3, .2, false); c.enableSnapToGround(.25);
    c.setMaxSlopeClimbAngle(Math.PI / 3); c.setApplyImpulsesToDynamicBodies(true); c.setCharacterMass(7);
    controlRef.current = c;
    return () => { world.removeCharacterController(c); controlRef.current = null; };
  }, [world]);
  const state = useRef({ velocity: 0, grounded: false, coyote: 0, jumpBuffer: 0, yaw: 0, pitch: .38, respawn: -1, ready: false });
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (e: Event) => { e.preventDefault(); onFailure(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onFailure]);
  useBeforePhysicsStep(() => {
    const b = body.current; const control = controlRef.current; if (!b || !control || game.paused) return;
    const s = state.current; const dt = 1 / 60;
    if (s.respawn !== game.respawn) { b.setTranslation(game.position, true); b.setNextKinematicTranslation(game.position); s.velocity = 0; s.coyote = 0; s.jumpBuffer = 0; s.respawn = game.respawn; }
    if (input.take('attack')) game.attack();
    if (input.take('ShiftLeft') || input.take('ShiftRight')) game.dodge();
    if (input.take('KeyE')) game.interact(); if (input.take('KeyQ')) game.throwBoomerang();
    if (input.take('Tab')) game.lock(); if (input.take('KeyH')) game.hint(); if (input.take('KeyR')) { game.resetBlocks(); game.say('Loose stones returned to their starting places.'); }
    if (input.take('KeyF')) s.yaw = game.yaw - Math.PI;
    // A small grace window prevents a press being lost between ground-contact steps.
    s.coyote = s.grounded && s.velocity <= 0 ? .1 : Math.max(0, s.coyote - dt);
    s.jumpBuffer = input.take('Space') ? .12 : Math.max(0, s.jumpBuffer - dt);
    if (s.jumpBuffer > 0 && s.coyote > 0) { s.velocity = 7; s.jumpBuffer = 0; s.coyote = 0; }
    game.shield = input.guard && game.dodgeTime <= 0;
    s.velocity -= 20 * dt;
    const length = Math.max(1, Math.hypot(input.moveX, input.moveZ));
    let mx = (input.moveX * Math.cos(s.yaw) - input.moveZ * Math.sin(s.yaw)) / length;
    let mz = (-input.moveX * Math.sin(s.yaw) - input.moveZ * Math.cos(s.yaw)) / length;
    const target = game.aimCandidates().find(e => e.id === game.locked);
    if (target) game.yaw = Math.atan2(target.x - game.position.x, target.z - game.position.z);
    else if (Math.hypot(mx, mz) > .1) game.yaw = Math.atan2(mx, mz);
    else if (game.shield) game.yaw = s.yaw + Math.PI;
    if (game.dodgeTime > 0 && Math.hypot(mx, mz) < .1) { mx = Math.sin(game.yaw); mz = Math.cos(game.yaw); }
    const pushing = Object.values(game.blocks).some(p => Math.hypot(p.x - game.position.x, p.z - game.position.z) < 1.8 && (p.x - game.position.x) * mx + (p.z - game.position.z) * mz > .2);
    const speed = pushing ? 2 : game.dodgeTime > 0 ? 12 : game.shield ? 2.5 : 5.8;
    control.computeColliderMovement(b.collider(0), { x: mx * dt * speed, y: s.velocity * dt, z: mz * dt * speed }, undefined, undefined, c => c.parent()?.handle !== b.handle);
    const m = control.computedMovement(); const p = b.translation();
    b.setNextKinematicTranslation({ x: p.x + m.x, y: p.y + m.y, z: p.z + m.z });
    s.grounded = control.computedGrounded(); if (s.grounded && s.velocity < 0) s.velocity = -.5;
    game.position = { x: p.x, y: p.y, z: p.z }; game.tick(dt);
    if (visual.current) { visual.current.rotation.y = game.yaw; visual.current.rotation.z = game.attackTime > 0 ? Math.sin(game.attackTime * 16) * .2 : 0; visual.current.visible = game.invulnerable <= 0 || Math.floor(game.time * 14) % 2 === 0; }
  });
  useFrame((_, delta) => {
    const dt = Math.min(delta, .05); const s = state.current;
    if (!s.ready) { s.ready = true; onReady(); }
    if (title) { camera.position.set(15, 11, 23); camera.lookAt(0, 1, -10); return; }
    if (!game.paused) {
      input.poll(dt, onPause);
      s.yaw -= input.orbitX * .0025 * game.progress.settings.sensitivity;
      s.pitch = THREE.MathUtils.clamp(s.pitch + input.orbitY * .002 * game.progress.settings.sensitivity, .12, 1.1);
    }
    input.orbitX = 0; input.orbitY = 0;
    const p = body.current?.translation() ?? game.position;
    const center = new THREE.Vector3(p.x, p.y + .7, p.z);
    const direction = new THREE.Vector3(Math.sin(s.yaw) * Math.cos(s.pitch), Math.sin(s.pitch), Math.cos(s.yaw) * Math.cos(s.pitch));
    const hit = world.castRay(new rapier.Ray(center, direction), 7.5, true, undefined, undefined, body.current?.collider(0));
    const distance = hit ? Math.max(.5, hit.timeOfImpact - .25) : 7.5;
    const desired = center.clone().addScaledVector(direction, distance);
    // Move inward immediately when a wall enters the ray; only smooth outward movement.
    if (hit || game.progress.settings.reducedMotion || camera.position.distanceTo(desired) > 15) camera.position.copy(desired);
    else camera.position.lerp(desired, 1 - Math.exp(-dt * 12));
    camera.lookAt(center);
  });
  return <RigidBody ref={body} type="kinematicPosition" colliders={false} position={spawn} enabledRotations={[false, false, false]}>
    <CapsuleCollider args={[.35, .35]} />
    <group ref={visual}><Animal hero={game.progress.hero} /></group>
  </RigidBody>;
}
export default function AdventureScene(props: Props) {
  const high = props.game.progress.settings.quality === 'high';
  const shadows = useMemo(() => high ? { type: THREE.PCFShadowMap } : false, [high]);
  return <Canvas shadows={shadows} dpr={high ? [1, 1.5] : 1} camera={{ position: [15, 11, 23], fov: 55, near: .1, far: 180 }} gl={{ antialias: high, powerPreference: 'high-performance' }} fallback={<div className="adv-fallback">3D graphics aren’t available. <a href="/game/classic">Play Portal Hoppers Classic</a></div>}>
    <color attach="background" args={['#b4d1c1']} /><fog attach="fog" args={['#b4d1c1', 36, 105]} />
    <hemisphereLight args={['#fff3cf', '#466857', 2.2]} />
    <directionalLight position={[20, 32, 12]} intensity={2.3} color="#ffedc8" castShadow={high} shadow-mapSize={[1024, 1024]} shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={32} shadow-camera-bottom={-32} shadow-bias={-.001} />
    <Physics gravity={[0, -20, 0]} timeStep={1 / 60} paused={!props.playing} colliders={false}>
      <World game={props.game} /><Actors game={props.game} /><Controller {...props} />
    </Physics>
  </Canvas>;
}
