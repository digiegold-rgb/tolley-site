"use client";
/* Simulation state and Three objects are mutable external systems, not React state. */
/* eslint-disable react-hooks/immutability */
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { HeroKind } from "../../engine/types";
import type { VoxelGame } from "../model";
import type { VoxelInput } from "../input";
import { B } from "../types";
import { VoxelGrid } from "../grid";
import { BIOMES } from "../worlds/biomes";
import { Terrain } from "./Terrain";
import { Sky } from "./Sky";
import { Cubo, HERO_MODELS, Hero, modelPath } from "./Actors";
import { Entities } from "./Entities";
import { Enemies } from "./Enemies";
import { Props } from "./Props";
import { Fx } from "./Fx";

type Props = {
  game: VoxelGame;
  input: VoxelInput;
  title: boolean;
  hero: HeroKind;
  quality: "high" | "low";
  onReady: (world: number) => void;
  onFailure: () => void;
  onPause: () => void;
};

function Sun({ game, intensity, shadows }: { game: VoxelGame | null; intensity: number; shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!light.current) return;
    const p = game ? game.position : { x: 4.5, y: 4, z: 4.5 };
    light.current.position.set(p.x + 14, p.y + 24, p.z + 9);
    target.position.set(p.x, p.y, p.z);
    target.updateMatrixWorld();
  });
  return (
    <directionalLight ref={light} intensity={intensity} color="#fff6e0" castShadow={shadows} target={target} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0006}>
      <orthographicCamera attach="shadow-camera" args={[-26, 26, 26, -26, 1, 80]} />
    </directionalLight>
  );
}

/** Registers the WebGL canvas with the input so pointer lock can be requested from UI buttons. */
function Binder({ input, onFailure }: { input: VoxelInput; onFailure: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    input.canvas = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onFailure();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, input, onFailure]);
  return null;
}

function PlayWorld({ game, input, onPause, quality }: { game: VoxelGame; input: VoxelInput; onPause: () => void; quality: "high" | "low" }) {
  const { camera } = useThree();
  const kit = BIOMES[game.def.biome];
  const target = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const initialized = useRef(false);
  useFrame((_, delta) => {
    camera.getWorldDirection(dir);
    input.aimOrigin = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    input.aimDir = { x: dir.x, y: dir.y, z: dir.z };
    if (!game.paused) {
      let remaining = Math.min(delta, 0.1);
      const controls = input.poll(game, remaining, onPause);
      while (remaining > 1e-4) {
        const dt = Math.min(remaining, 1 / 60);
        game.tick(dt, controls);
        controls.jump = controls.bash = controls.power = controls.interact = controls.cycle = controls.lift = controls.place = controls.rally = controls.hold = controls.bridge = false;
        remaining -= dt;
      }
    }
    // Over-the-shoulder camera with wall avoidance.
    const p = game.position;
    const yaw = game.cameraYaw,
      pitch = game.cameraPitch;
    const dist = 7.5;
    target.set(p.x, p.y + 1.4, p.z);
    desired.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist + Math.cos(yaw) * 0.8,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist - Math.sin(yaw) * 0.8,
    );
    dir.copy(desired).sub(target);
    const len = dir.length();
    const hit = game.grid.raycast({ x: target.x, y: target.y, z: target.z }, { x: dir.x, y: dir.y, z: dir.z }, len);
    if (hit && hit.dist < len) desired.copy(target).addScaledVector(dir.normalize(), Math.max(1.4, hit.dist - 0.45));
    if (!initialized.current) {
      camera.position.copy(desired);
      initialized.current = true;
    } else camera.position.lerp(desired, 1 - Math.exp(-Math.min(delta, 0.1) * (input.locked ? 26 : 12)));
    camera.lookAt(target);
    if (game.shake > 0) {
      const k = Math.min(1, game.shake) * 0.35;
      camera.position.x += (Math.random() - 0.5) * k;
      camera.position.y += (Math.random() - 0.5) * k;
    }
  });
  return (
    <>
      <Sky kit={kit} />
      <Sun game={game} intensity={kit.sun} shadows={quality === "high"} />
      <Terrain grid={game.grid} kit={kit} quality={quality} />
      <Entities game={game} />
      <Props game={game} kit={kit} />
      <Enemies game={game} />
      <Hero hero={game.saveData.hero} game={game} />
      <Cubo game={game} />
      <Fx game={game} />
    </>
  );
}

function TitleWorld({ hero, quality }: { hero: HeroKind; quality: "high" | "low" }) {
  const kit = BIOMES.factory;
  const grid = useMemo(() => {
    const g = new VoxelGrid(11, 6, 11);
    g.box(2, 0, 2, 8, 3, 8, B.solid);
    g.box(2, 3, 2, 8, 3, 2, B.trim);
    g.box(2, 3, 8, 8, 3, 8, B.trim);
    g.box(4, 3, 4, 6, 3, 6, B.solid2);
    g.box(0, 0, 0, 1, 1, 1, B.glow);
    g.box(9, 0, 9, 10, 2, 10, B.bounce);
    g.dirty.clear();
    return g;
  }, []);
  const spin = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useFrame(({ clock }) => {
    if (spin.current) spin.current.rotation.y = clock.elapsedTime * 0.35;
    camera.position.set(3 + Math.sin(clock.elapsedTime * 0.2) * 1.5, 9.5, 17);
    camera.lookAt(5.5, 4.4, 5.5);
  });
  return (
    <>
      <Sky kit={kit} />
      <Sun game={null} intensity={kit.sun} shadows={quality === "high"} />
      <Terrain grid={grid} kit={kit} quality={quality} />
      <group ref={spin} position={[5.5, 4, 5.5]}>
        <Hero hero={hero} title />
      </group>
    </>
  );
}

function AssetsReady() {
  useGLTF(modelPath("frog"));
  useGLTF(modelPath("fox"));
  useGLTF(modelPath("cat"));
  useGLTF(modelPath("cubo"));
  return null;
}
function Ready({ onReady, world }: { onReady: (world: number) => void; world: number }) {
  const observed = useRef({ world: 0, frames: 0 });
  useFrame(() => {
    if (observed.current.world !== world) observed.current = { world, frames: 0 };
    if (observed.current.frames < 3 && ++observed.current.frames === 3) onReady(world);
  });
  return null;
}
for (const asset of [...HERO_MODELS, "cubo"]) useGLTF.preload(modelPath(asset));

export default function Scene(props: Props) {
  return (
    <Canvas
      shadows={props.quality === "high"}
      dpr={[1, props.quality === "high" ? 1.5 : 1]}
      camera={{ position: [6, 8, 14], fov: 50, near: 0.1, far: 220 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
      }}
    >
      <Binder input={props.input} onFailure={props.onFailure} />
      <Suspense fallback={null}>
        <AssetsReady />
        {props.title ? (
          <TitleWorld hero={props.hero} quality={props.quality} />
        ) : (
          <PlayWorld key={props.game.worldVersion} game={props.game} input={props.input} onPause={props.onPause} quality={props.quality} />
        )}
        <Ready onReady={props.onReady} world={props.game.def.id} />
      </Suspense>
    </Canvas>
  );
}
