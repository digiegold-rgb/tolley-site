"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import type { HeroKind } from "../../engine/types";
import type { VoxelGame } from "../model";
import { CUBO_SIZE } from "../types";

export const modelPath = (name: string) => `/game/models/${name}.glb`;
export const HERO_MODELS: HeroKind[] = ["frog", "fox", "cat"];

export function Model({ name, scale = 1 }: { name: string; scale?: number }) {
  const gltf = useGLTF(modelPath(name));
  const object = useMemo(() => {
    const root = clone(gltf.scene);
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return root;
  }, [gltf.scene]);
  return <primitive object={object} scale={scale} />;
}

export function Hero({ hero, game, title = false }: { hero: HeroKind; game?: VoxelGame; title?: boolean }) {
  const gltf = useGLTF(modelPath(hero));
  const root = useMemo(() => {
    const s = clone(gltf.scene);
    s.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    return s;
  }, [gltf.scene]);
  const group = useRef<THREE.Group>(null);
  const { actions } = useAnimations(gltf.animations, root);
  const current = useRef("");
  useFrame((state) => {
    const name = title || !game ? "Idle" : game.attack > 0 ? "Bash" : !game.grounded ? "Jump" : Math.hypot(game.velocity.x, game.velocity.z) > 0.3 ? "Run" : "Idle";
    if (name !== current.current) {
      actions[current.current]?.fadeOut(0.13);
      actions[name]?.reset().fadeIn(0.13).play();
      current.current = name;
    }
    if (group.current && game && !title) {
      group.current.position.set(game.position.x, game.position.y, game.position.z);
      const target = game.yaw + Math.PI; // the GLB faces -z
      group.current.rotation.y = THREE.MathUtils.lerp(
        group.current.rotation.y,
        group.current.rotation.y + Math.atan2(Math.sin(target - group.current.rotation.y), Math.cos(target - group.current.rotation.y)),
        0.25,
      );
      group.current.visible = game.invulnerable <= 0 || Math.sin(state.clock.elapsedTime * 24) > -0.5;
      const small = game.active === "shrink" && game.powerTime > 0;
      group.current.scale.setScalar(small ? 0.5 : 0.8);
    }
  });
  return (
    <group ref={group} scale={0.8}>
      <primitive object={root} />
    </group>
  );
}

/** Cubo as a real body: a cube that follows, can be stood on, and stretches into a pillar. */
export function Cubo({ game }: { game: VoxelGame }) {
  const group = useRef<THREE.Group>(null);
  const pillar = useRef<THREE.Mesh>(null);
  const face = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current || !face.current || !pillar.current) return;
    const b = game.cubo;
    group.current.visible = game.hasCubo;
    const bob = game.lift === "idle" && game.groundBody !== b ? Math.sin(game.time * 3) * 0.08 : 0;
    group.current.position.set(b.x, b.y + bob, b.z);
    const extra = Math.max(0, b.h - CUBO_SIZE);
    pillar.current.visible = extra > 0.01;
    pillar.current.scale.set(1, Math.max(0.01, extra), 1);
    pillar.current.position.y = extra / 2;
    face.current.position.y = extra;
    face.current.rotation.y = THREE.MathUtils.lerp(face.current.rotation.y, game.yaw + Math.PI, 0.12);
  });
  return (
    <group ref={group}>
      <mesh ref={pillar} castShadow receiveShadow>
        <boxGeometry args={[CUBO_SIZE * 0.96, 1, CUBO_SIZE * 0.96]} />
        <meshLambertMaterial color="#3fb8e6" toneMapped={false} />
      </mesh>
      <group ref={face}>
        <Model name="cubo" scale={0.55} />
      </group>
    </group>
  );
}
