/**
 * Voxel grid, level-building helpers, and the ASCII world DSL.
 * Worlds are authored with `defineWorld`: a builder mixes ASCII layers (rows = z, chars = x)
 * with box/room/stairs calls, and markers become entities.
 */
import {
  B,
  isSolid,
  type BiomeId,
  type BlockId,
  type DoorDef,
  type Entity,
  type Vec3,
} from "./types";

export const CHUNK = 16;
export const chunkKey = (x: number, z: number) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;

export type RayHit = { x: number; y: number; z: number; dist: number; point: Vec3; normal: Vec3 };

export class VoxelGrid {
  data: Uint8Array;
  /** Chunk keys whose cells changed since the renderer last rebuilt them. */
  dirty = new Set<string>();
  version = 0;
  constructor(
    public w: number,
    public h: number,
    public d: number,
  ) {
    this.data = new Uint8Array(w * h * d);
  }
  index(x: number, y: number, z: number) {
    return (y * this.d + z) * this.w + x;
  }
  inBounds(x: number, y: number, z: number) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d;
  }
  get(x: number, y: number, z: number): number {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    return this.inBounds(x, y, z) ? this.data[this.index(x, y, z)] : B.air;
  }
  set(x: number, y: number, z: number, id: BlockId) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    if (this.data[i] === id) return;
    this.data[i] = id;
    this.dirty.add(chunkKey(x, z));
    this.version++;
  }
  solidAt(x: number, y: number, z: number) {
    return isSolid(this.get(x, y, z));
  }
  /** Inclusive box fill. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, id: BlockId) {
    for (let y = Math.max(0, y0); y <= Math.min(this.h - 1, y1); y++)
      for (let z = Math.max(0, z0); z <= Math.min(this.d - 1, z1); z++)
        for (let x = Math.max(0, x0); x <= Math.min(this.w - 1, x1); x++) this.set(x, y, z, id);
  }
  /** A room: floor, walls and ceiling of `wall`, hollow inside. The interior is x0+1..x1-1, y0+1..y1-1, z0+1..z1-1. */
  room(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, wall: BlockId, floor: BlockId = wall) {
    this.box(x0, y0, z0, x1, y1, z1, wall);
    this.box(x0, y0, z0, x1, y0, z1, floor);
    this.box(x0 + 1, y0 + 1, z0 + 1, x1 - 1, y1 - 1, z1 - 1, B.air);
  }
  /** Stairs climbing one block per step along +z (dir "z") or +x (dir "x"), `width` blocks wide, solid underneath. */
  stairs(x: number, y: number, z: number, dir: "x" | "z" | "-x" | "-z", steps: number, width: number, id: BlockId, base = 0) {
    for (let i = 0; i < steps; i++) {
      const sx = dir === "x" ? x + i : dir === "-x" ? x - i : x;
      const sz = dir === "z" ? z + i : dir === "-z" ? z - i : z;
      if (dir === "x" || dir === "-x") this.box(sx, base, sz, sx, y + i, sz + width - 1, id);
      else this.box(sx, base, sz, sx + width - 1, y + i, sz, id);
    }
  }
  /** Highest solid cell in a column, or -1. */
  columnTop(x: number, z: number) {
    x = Math.floor(x);
    z = Math.floor(z);
    if (x < 0 || z < 0 || x >= this.w || z >= this.d) return -1;
    for (let y = this.h - 1; y >= 0; y--) if (isSolid(this.data[this.index(x, y, z)])) return y;
    return -1;
  }
  /** Grid-walking ray (Amanatides & Woo). Returns the first solid cell hit. */
  raycast(origin: Vec3, dir: Vec3, max = 40): RayHit | null {
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
    const dx = dir.x / len,
      dy = dir.y / len,
      dz = dir.z / len;
    let x = Math.floor(origin.x),
      y = Math.floor(origin.y),
      z = Math.floor(origin.z);
    const stepX = dx > 0 ? 1 : -1,
      stepY = dy > 0 ? 1 : -1,
      stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / (dx || 1e-9)),
      tdy = Math.abs(1 / (dy || 1e-9)),
      tdz = Math.abs(1 / (dz || 1e-9));
    let tx = ((dx > 0 ? x + 1 - origin.x : origin.x - x) || 0) * tdx,
      ty = ((dy > 0 ? y + 1 - origin.y : origin.y - y) || 0) * tdy,
      tz = ((dz > 0 ? z + 1 - origin.z : origin.z - z) || 0) * tdz;
    let t = 0;
    let normal = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 400 && t <= max; i++) {
      if (this.inBounds(x, y, z) && isSolid(this.data[this.index(x, y, z)]))
        return { x, y, z, dist: t, point: { x: origin.x + dx * t, y: origin.y + dy * t, z: origin.z + dz * t }, normal };
      if (tx < ty && tx < tz) {
        x += stepX;
        t = tx;
        tx += tdx;
        normal = { x: -stepX, y: 0, z: 0 };
      } else if (ty < tz) {
        y += stepY;
        t = ty;
        ty += tdy;
        normal = { x: 0, y: -stepY, z: 0 };
      } else {
        z += stepZ;
        t = tz;
        tz += tdz;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    }
    return null;
  }
  /**
   * Air cells reachable from the open sky (every air cell on the `ceiling - 1` layer), walking through
   * air only. Doors count as walls, so rooms sealed behind doors are not "sky-reachable".
   */
  floodFromSky(ceiling: number) {
    const seen = new Uint8Array(this.data.length);
    const stack: number[] = [];
    const top = Math.min(this.h - 1, Math.max(0, ceiling - 1));
    for (let z = 0; z < this.d; z++)
      for (let x = 0; x < this.w; x++) {
        const i = this.index(x, top, z);
        if (!isSolid(this.data[i])) {
          seen[i] = 1;
          stack.push(i);
        }
      }
    const wd = this.w * this.d;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % this.w,
        z = Math.floor(i / this.w) % this.d,
        y = Math.floor(i / wd);
      const push = (nx: number, ny: number, nz: number) => {
        if (!this.inBounds(nx, ny, nz)) return;
        const j = this.index(nx, ny, nz);
        if (seen[j] || isSolid(this.data[j])) return;
        seen[j] = 1;
        stack.push(j);
      };
      push(x + 1, y, z);
      push(x - 1, y, z);
      push(x, y + 1, z);
      push(x, y - 1, z);
      push(x, y, z + 1);
      push(x, y, z - 1);
    }
    return seen;
  }
}

/* ── World DSL ─────────────────────────────────────────────────────────── */
export type DoorSpec = { block: BlockId; door: string };
export const door = (id: string): DoorSpec => ({ block: B.door, door: id });
export type LegendValue = BlockId | DoorSpec | ((x: number, y: number, z: number) => Entity | void);
export type Legend = Record<string, LegendValue>;

/** Characters every world understands. Worlds add or override with `legend`. */
export const BASE_LEGEND: Record<string, BlockId> = {
  ".": B.air,
  " ": B.air,
  "#": B.solid,
  "=": B.solid2,
  i: B.ice,
  b: B.bounce,
  c: B.crumble,
  "^": B.spike,
  "!": B.goo,
  "~": B.water,
  g: B.glass,
  "*": B.star,
  v: B.vine,
  w: B.wall,
  t: B.trim,
  l: B.glow,
  f: B.flip,
  N: B.conveyorN,
  E: B.conveyorE,
  Z: B.conveyorS,
  W: B.conveyorW,
  n: B.currentN,
  e: B.currentE,
  z: B.currentS,
  q: B.currentW,
};
/** Marker characters: the cell stays air and an entity is placed at its centre. */
const MARKERS = new Set(["X", "P", "$", "k", "C", "s", "S", "H"]);

export type LayerSpec = { y: number; x0?: number; z0?: number; rows: string[]; legend?: Legend };
export const cellCenter = (x: number, y: number, z: number): Vec3 => ({ x: x + 0.5, y, z: z + 0.5 });

export class WorldBuilder {
  entities: Entity[] = [];
  doorCells = new Map<string, Vec3[]>();
  doors: Omit<DoorDef, "cells">[] = [];
  start: Vec3 | null = null;
  portal: Vec3 | null = null;
  private coins = 0;
  private keys = 0;
  private stars = 0;
  private checkpoints = 0;
  private hoppers = 0;
  private switches = 0;
  constructor(
    public grid: VoxelGrid,
    public worldId: number,
    public legend: Legend = {},
  ) {}
  entity(e: Entity) {
    this.entities.push(e);
    return e;
  }
  coin(x: number, y: number, z: number) {
    return this.entity({ kind: "coin", id: `coin-${++this.coins}`, at: cellCenter(x, y, z) });
  }
  key(x: number, y: number, z: number) {
    return this.entity({ kind: "key", id: `key-${++this.keys}`, at: cellCenter(x, y, z) });
  }
  star(x: number, y: number, z: number) {
    return this.entity({ kind: "star", id: `star-${this.worldId}-${++this.stars}`, at: cellCenter(x, y, z) });
  }
  checkpoint(x: number, y: number, z: number) {
    return this.entity({ kind: "checkpoint", index: ++this.checkpoints, at: cellCenter(x, y, z) });
  }
  switch(x: number, y: number, z: number, id = `switch-${this.switches + 1}`) {
    this.switches++;
    this.grid.set(x, y - 1, z, B.switchBase);
    return this.entity({ kind: "switch", id, at: cellCenter(x, y, z) });
  }
  hopper(x: number, y: number, z: number) {
    return this.entity({ kind: "hopper", id: `h-${this.worldId}-${++this.hoppers}`, at: cellCenter(x, y, z) });
  }
  sign(x: number, y: number, z: number, text: string) {
    return this.entity({ kind: "sign", text, at: cellCenter(x, y, z) });
  }
  door(def: Omit<DoorDef, "cells">, cells: Vec3[] = []) {
    this.doors.push(def);
    if (cells.length) this.doorCells.set(def.id, [...(this.doorCells.get(def.id) ?? []), ...cells]);
  }
  /** Fill a door opening with door blocks and register the cells. */
  doorBox(id: string, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const cells: Vec3[] = [];
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          this.grid.set(x, y, z, B.door);
          cells.push({ x, y, z });
        }
    this.doorCells.set(id, [...(this.doorCells.get(id) ?? []), ...cells]);
  }
  /** Paint an ASCII layer. Row r is z = z0 + r; column c is x = x0 + c. */
  layer({ y, x0 = 0, z0 = 0, rows, legend }: LayerSpec) {
    const table: Legend = { ...BASE_LEGEND, ...this.legend, ...legend };
    rows.forEach((row, r) => {
      const z = z0 + r;
      for (let c = 0; c < row.length; c++) {
        const ch = row[c];
        const x = x0 + c;
        const v = table[ch];
        if (MARKERS.has(ch) && v === undefined) {
          this.grid.set(x, y, z, B.air);
          if (ch === "X") this.start = cellCenter(x, y, z);
          else if (ch === "P") this.portal = cellCenter(x, y, z);
          else if (ch === "$") this.coin(x, y, z);
          else if (ch === "k") this.key(x, y, z);
          else if (ch === "C") this.checkpoint(x, y, z);
          else if (ch === "s") this.star(x, y, z);
          else if (ch === "S") this.switch(x, y, z);
          else if (ch === "H") this.hopper(x, y, z);
          continue;
        }
        if (v === undefined) throw new Error(`world ${this.worldId}: unknown layer char "${ch}" at y=${y} row ${r} col ${c}`);
        if (typeof v === "number") this.grid.set(x, y, z, v);
        else if (typeof v === "function") {
          this.grid.set(x, y, z, B.air);
          const e = v(x, y, z);
          if (e) this.entities.push(e);
        } else {
          this.grid.set(x, y, z, v.block);
          this.doorCells.set(v.door, [...(this.doorCells.get(v.door) ?? []), { x, y, z }]);
        }
      }
    });
  }
}

export type WorldSpec = {
  id: number;
  name: string;
  biome: BiomeId;
  size: [number, number, number];
  ceiling: number;
  intro: string;
  cuboLine: string;
  music: string;
  legend?: Legend;
  build: (g: VoxelGrid, w: WorldBuilder) => void;
  route: Vec3[];
};

export type WorldDef = {
  id: number;
  name: string;
  biome: BiomeId;
  grid: VoxelGrid;
  ceiling: number;
  start: Vec3;
  portal: Vec3;
  entities: Entity[];
  doors: DoorDef[];
  route: Vec3[];
  intro: string;
  cuboLine: string;
  music: string;
};

export function defineWorld(spec: WorldSpec): WorldDef {
  const grid = new VoxelGrid(...spec.size);
  const w = new WorldBuilder(grid, spec.id, spec.legend);
  spec.build(grid, w);
  if (!w.start) throw new Error(`world ${spec.id}: no start (X) marker`);
  if (!w.portal) throw new Error(`world ${spec.id}: no portal (P) marker`);
  const doors: DoorDef[] = w.doors.map((d) => ({ ...d, cells: w.doorCells.get(d.id) ?? [] }));
  for (const [id, cells] of w.doorCells) if (!doors.some((d) => d.id === id)) doors.push({ id, cells });
  grid.dirty.clear();
  return {
    id: spec.id,
    name: spec.name,
    biome: spec.biome,
    grid,
    ceiling: spec.ceiling,
    start: w.start,
    portal: w.portal,
    entities: w.entities,
    doors,
    route: spec.route,
    intro: spec.intro,
    cuboLine: spec.cuboLine,
    music: spec.music,
  };
}
