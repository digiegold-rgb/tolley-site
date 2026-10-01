"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { VoxelGame } from "../model";

const COLORS: Record<string, [string, string]> = {
  hurt: ["#ff96b0", "#ff5a7a"],
  coin: ["#fff4b3", "#ffd23a"],
  key: ["#ffe98a", "#ffb800"],
  switch: ["#a7fff0", "#5eead4"],
  rescue: ["#ffd6f7", "#ff7ad9"],
  jump: ["#e0f2fe", "#bae6fd"],
  bash: ["#fff4b3", "#a7fff0"],
};
export function Fx({ game }: { game: VoxelGame }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    let count = 0;
    for (const e of game.effects) {
      const pair = COLORS[e.kind] ?? COLORS.bash;
      for (let j = 0; j < 12; j++) {
        const a = j * 2.4;
        dummy.position.set(e.x + Math.sin(a) * e.age * 2, e.y + 0.8 + Math.sin(e.age * Math.PI) * 1.6 + (j % 3) * 0.12, e.z + Math.cos(a) * e.age * 2);
        dummy.scale.setScalar((1 - e.age / 1.3) * 0.13);
        dummy.rotation.set(a, e.age * 4, a);
        dummy.updateMatrix();
        m.setMatrixAt(count, dummy.matrix);
        m.setColorAt(count, color.set(pair[j % 2]));
        if (++count >= 240) break;
      }
      if (count >= 240) break;
    }
    m.count = count;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 240]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
