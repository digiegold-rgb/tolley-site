"use client";
/* The grid is a mutable external system; chunks are rebuilt imperatively when cells change. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { B, isSolid, type BiomeKit } from "../types";
import { CHUNK, type VoxelGrid } from "../grid";
import { blockColor } from "../worlds/biomes";

/** Unit cube with three-tone vertex shading baked in (top bright, sides mid, bottom dark). */
function shadedCube(top = 1, side = 0.82, bottom = 0.55) {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const n = g.attributes.normal;
  const colors = new Float32Array(n.count * 3);
  for (let i = 0; i < n.count; i++) {
    const ny = n.getY(i);
    const t = ny > 0.5 ? top : ny < -0.5 ? bottom : side;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = t;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}
const TRANSLUCENT = new Set<number>([B.water, B.glass, B.flip]);
const hash = (x: number, y: number, z: number) => {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

type Chunk = { group: THREE.Group; meshes: THREE.InstancedMesh[] };

export function Terrain({ grid, kit, quality }: { grid: VoxelGrid; kit: BiomeKit; quality: "high" | "low" }) {
  const root = useRef<THREE.Group>(null);
  const chunks = useRef(new Map<string, Chunk>());
  const cube = useMemo(() => shadedCube(), []);
  const smallCube = useMemo(() => shadedCube().scale(0.5, 0.5, 0.5), []);
  const opaque = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, toneMapped: false }), []);
  const glassy = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true, toneMapped: false, transparent: true, opacity: 0.55, depthWrite: false }), []);
  const glowing = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), []);
  const colors = useMemo(() => {
    const table = new Map<number, THREE.Color>();
    for (const id of Object.values(B)) table.set(id, new THREE.Color(blockColor(kit, id)));
    return table;
  }, [kit]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  const build = (cx: number, cz: number): Chunk => {
    const group = new THREE.Group();
    const buckets = { opaque: [] as number[], glassy: [] as number[], glowing: [] as number[], spikes: [] as number[] };
    const x0 = cx * CHUNK,
      z0 = cz * CHUNK;
    for (let y = 0; y < grid.h; y++)
      for (let z = z0; z < Math.min(grid.d, z0 + CHUNK); z++)
        for (let x = x0; x < Math.min(grid.w, x0 + CHUNK); x++) {
          const i = grid.index(x, y, z);
          const id = grid.data[i];
          if (id === B.air) continue;
          if (isSolid(id)) {
            const exposed =
              !grid.solidAt(x + 1, y, z) || !grid.solidAt(x - 1, y, z) || !grid.solidAt(x, y + 1, z) || !grid.solidAt(x, y - 1, z) || !grid.solidAt(x, y, z + 1) || !grid.solidAt(x, y, z - 1);
            if (!exposed) continue;
            (id === B.glass ? buckets.glassy : id === B.glow || id === B.star ? buckets.glowing : buckets.opaque).push(i);
          } else if (TRANSLUCENT.has(id)) buckets.glassy.push(i);
          else if (id === B.spike) buckets.spikes.push(i);
          else buckets.glowing.push(i); // goo, vine, currents: emissive markers for now
        }
    const meshes: THREE.InstancedMesh[] = [];
    const make = (list: number[], geometry: THREE.BufferGeometry, material: THREE.Material, shadow: boolean) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      mesh.castShadow = shadow;
      mesh.receiveShadow = shadow;
      list.forEach((i, n) => {
        const x = i % grid.w,
          z = Math.floor(i / grid.w) % grid.d,
          y = Math.floor(i / (grid.w * grid.d));
        const id = grid.data[i];
        dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        if (id === B.spike) dummy.position.y = y + 0.25;
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        const shade = 0.93 + hash(x, y, z) * 0.07;
        tmp.copy(colors.get(id) ?? colors.get(B.solid)!).multiplyScalar(shade);
        mesh.setColorAt(n, tmp);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
      meshes.push(mesh);
    };
    const shadow = quality === "high";
    make(buckets.opaque, cube, opaque, shadow);
    make(buckets.glowing, cube, glowing, false);
    make(buckets.spikes, smallCube, opaque, false);
    make(buckets.glassy, cube, glassy, false);
    return { group, meshes };
  };
  const rebuild = (key: string) => {
    const [cx, cz] = key.split(",").map(Number);
    const old = chunks.current.get(key);
    if (old) {
      root.current?.remove(old.group);
      for (const m of old.meshes) m.dispose();
    }
    const chunk = build(cx, cz);
    chunks.current.set(key, chunk);
    root.current?.add(chunk.group);
  };
  useEffect(() => {
    const map = chunks.current;
    const node = root.current;
    for (let cz = 0; cz * CHUNK < grid.d; cz++) for (let cx = 0; cx * CHUNK < grid.w; cx++) rebuild(`${cx},${cz}`);
    grid.dirty.clear();
    return () => {
      for (const c of map.values()) {
        node?.remove(c.group);
        for (const m of c.meshes) m.dispose();
      }
      map.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, kit, quality]);
  useFrame(() => {
    if (!grid.dirty.size) return;
    for (const key of grid.dirty) rebuild(key);
    grid.dirty.clear();
  });
  return <group ref={root} />;
}
