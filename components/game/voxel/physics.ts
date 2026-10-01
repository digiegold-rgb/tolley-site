/**
 * Axis-separated AABB sweep against the voxel grid plus dynamic bodies (Cubo, pillars, movers).
 * Deterministic and dependency-free so the same code runs in node:test bots and in the browser.
 */
import { B, isSolid, type Vec3 } from "./types";
import type { VoxelGrid } from "./grid";

export type DynBody = {
  id: string;
  x: number;
  y: number;
  z: number;
  hw: number;
  h: number;
  hd: number;
  /** Movement since the previous tick, used to carry whoever stands on top. */
  dx: number;
  dy: number;
  dz: number;
  /** Bodies the hero may stand on but never gets pushed by horizontally (e.g. a growing pillar). */
  soft?: boolean;
};

export type Sweep = {
  grounded: boolean;
  groundBlock: number;
  groundCells: number[];
  groundBody: DynBody | null;
  hitHead: boolean;
  hitWall: boolean;
  stepped: boolean;
  /** Non-solid, non-air block ids overlapped by the body volume (water, spikes, currents…). */
  touching: Set<number>;
  touchCells: number[];
};

const EPS = 1e-3;
/** Which block wins when the hero stands across several. */
const GROUND_PRIORITY = [B.bounce, B.crumble, B.ice, B.conveyorN, B.conveyorE, B.conveyorS, B.conveyorW];

function overlapsSolid(grid: VoxelGrid, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, out: number[]) {
  out.length = 0;
  const ax = Math.floor(x0),
    bx = Math.floor(x1 - EPS),
    ay = Math.max(0, Math.floor(y0)),
    by = Math.min(grid.h - 1, Math.floor(y1 - EPS)),
    az = Math.floor(z0),
    bz = Math.floor(z1 - EPS);
  for (let y = ay; y <= by; y++)
    for (let z = az; z <= bz; z++)
      for (let x = ax; x <= bx; x++) if (grid.inBounds(x, y, z) && isSolid(grid.data[grid.index(x, y, z)])) out.push(grid.index(x, y, z));
  return out.length > 0;
}
const bodyOverlaps = (b: DynBody, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
  x0 < b.x + b.hw && x1 > b.x - b.hw && z0 < b.z + b.hd && z1 > b.z - b.hd && y0 < b.y + b.h && y1 > b.y;

const cells: number[] = [];
export function sweep(grid: VoxelGrid, bodies: DynBody[], pos: Vec3, half: number, height: number, delta: Vec3): Sweep {
  const r: Sweep = {
    grounded: false,
    groundBlock: B.air,
    groundCells: [],
    groundBody: null,
    hitHead: false,
    hitWall: false,
    stepped: false,
    touching: new Set(),
    touchCells: [],
  };
  const prevY = pos.y;
  // Horizontal axes, with a one-block step-up when moving on the ground into a low ledge.
  for (const axis of ["x", "z"] as const) {
    const d = delta[axis];
    if (d === 0) continue;
    pos[axis] += d;
    const resolve = () => {
      const x0 = pos.x - half,
        x1 = pos.x + half,
        z0 = pos.z - half,
        z1 = pos.z + half,
        y0 = pos.y + EPS * 4,
        y1 = pos.y + height - EPS * 4;
      const hit = overlapsSolid(grid, x0, y0, z0, x1, y1, z1, cells);
      const body = bodies.find((b) => !b.soft && bodyOverlaps(b, x0, y0, z0, x1, y1, z1));
      if (!hit && !body) return false;
      if (hit) {
        let edge = d > 0 ? Infinity : -Infinity;
        for (const i of cells) {
          const c = axis === "x" ? i % grid.w : Math.floor(i / grid.w) % grid.d;
          edge = d > 0 ? Math.min(edge, c) : Math.max(edge, c + 1);
        }
        pos[axis] = d > 0 ? edge - half - EPS : edge + half + EPS;
      } else if (body) {
        const bh = axis === "x" ? body.hw : body.hd;
        pos[axis] = d > 0 ? body[axis] - bh - half - EPS : body[axis] + bh + half + EPS;
      }
      return true;
    };
    const before = pos[axis];
    if (resolve()) {
      // Try stepping up one block: only if we were on the ground and the raised volume is free.
      const wasGrounded = delta.y <= 0 && overlapsSolid(grid, pos.x - half, prevY - 0.05, pos.z - half, pos.x + half, prevY + 0.05, pos.z + half, cells);
      if (wasGrounded) {
        const saved = pos[axis];
        pos[axis] = before + d; // walk onto the ledge, one block higher
        pos.y = prevY + 1;
        if (
          !overlapsSolid(grid, pos.x - half, pos.y + EPS * 4, pos.z - half, pos.x + half, pos.y + height - EPS * 4, pos.z + half, cells) &&
          !bodies.some((b) => !b.soft && bodyOverlaps(b, pos.x - half, pos.y + EPS * 4, pos.z - half, pos.x + half, pos.y + height, pos.z + half))
        ) {
          r.stepped = true;
        } else {
          pos.y = prevY;
          pos[axis] = saved;
          r.hitWall = true;
        }
      } else r.hitWall = true;
    }
  }
  // Vertical.
  pos.y += delta.y;
  if (r.stepped) delta.y = 0;
  const x0 = pos.x - half,
    x1 = pos.x + half,
    z0 = pos.z - half,
    z1 = pos.z + half;
  if (delta.y <= 0) {
    // Probe a hair below the feet so standing still (delta.y == 0) still counts as grounded.
    if (overlapsSolid(grid, x0, pos.y - 0.02, z0, x1, pos.y + Math.min(height, 0.5), z1, cells)) {
      let top = -Infinity;
      for (const i of cells) top = Math.max(top, Math.floor(i / (grid.w * grid.d)) + 1);
      pos.y = top;
      r.grounded = true;
      for (const i of cells)
        if (Math.floor(i / (grid.w * grid.d)) + 1 === top) {
          r.groundCells.push(i);
          const id = grid.data[i];
          const rank = GROUND_PRIORITY.indexOf(id as (typeof GROUND_PRIORITY)[number]);
          const cur = GROUND_PRIORITY.indexOf(r.groundBlock as (typeof GROUND_PRIORITY)[number]);
          if (r.groundBlock === B.air || (rank >= 0 && (cur < 0 || rank < cur))) r.groundBlock = id;
        }
    }
    for (const b of bodies) {
      const top = b.y + b.h;
      if (x0 < b.x + b.hw && x1 > b.x - b.hw && z0 < b.z + b.hd && z1 > b.z - b.hd && prevY >= top - 0.35 && pos.y <= top + EPS && pos.y > b.y - 0.2) {
        if (!r.grounded || top >= pos.y) {
          pos.y = top;
          r.grounded = true;
          r.groundBody = b;
          r.groundBlock = B.air;
          r.groundCells = [];
        }
      }
    }
  } else if (overlapsSolid(grid, x0, pos.y + height - 0.5, z0, x1, pos.y + height, z1, cells)) {
    let bottom = Infinity;
    for (const i of cells) bottom = Math.min(bottom, Math.floor(i / (grid.w * grid.d)));
    pos.y = bottom - height - EPS;
    r.hitHead = true;
  } else {
    for (const b of bodies)
      if (!b.soft && bodyOverlaps(b, x0, pos.y + height - 0.5, z0, x1, pos.y + height, z1)) {
        pos.y = b.y - height - EPS;
        r.hitHead = true;
      }
  }
  // Blocks the body is inside (fluids, hazards, climbable and trigger volumes).
  const ax = Math.floor(x0 + 0.05),
    bx = Math.floor(x1 - 0.05),
    ay = Math.max(0, Math.floor(pos.y + 0.05)),
    by = Math.min(grid.h - 1, Math.floor(pos.y + height - 0.05)),
    az = Math.floor(z0 + 0.05),
    bz = Math.floor(z1 - 0.05);
  for (let y = ay; y <= by; y++)
    for (let z = az; z <= bz; z++)
      for (let x = ax; x <= bx; x++) {
        if (!grid.inBounds(x, y, z)) continue;
        const i = grid.index(x, y, z);
        const id = grid.data[i];
        if (id !== B.air && !isSolid(id)) {
          r.touching.add(id);
          r.touchCells.push(i);
        }
      }
  return r;
}

/** Free volume test used by placement (Cubo drop, bridges) and respawn safety. */
export function volumeFree(grid: VoxelGrid, bodies: DynBody[], x: number, y: number, z: number, hw: number, h: number, hd: number) {
  return (
    !overlapsSolid(grid, x - hw, y + EPS, z - hd, x + hw, y + h - EPS, z + hd, cells) &&
    !bodies.some((b) => bodyOverlaps(b, x - hw, y + EPS, z - hd, x + hw, y + h - EPS, z + hd))
  );
}
