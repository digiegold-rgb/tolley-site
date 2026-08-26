/**
 * Grid world. Rows of characters → Uint8Array of TileKind. Axis-separated
 * sweeps with ≤16 px sub-steps so nothing tunnels at 60 Hz.
 */
import { T, TILE, TILE_CHARS, type Body, type TileKind, type Vec2 } from "./types";

export interface Markers {
  hero: Vec2 | null;
  cubo: Vec2 | null;
  checkpoints: Vec2[];
  coins: Vec2[];
  orb: Vec2 | null;
}

export interface MoveResult {
  hitX: boolean;
  hitHead: boolean;
  onGround: boolean;
  onOneway: boolean;
}

function isSolidKind(k: TileKind): boolean {
  return k === T.SOLID || k === T.BASH || k === T.BOUNCE || k === T.PIPE || k === T.ICE || k === T.GLASS || k === T.GOO;
}

export class Tilemap {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8Array;
  readonly markers: Markers;
  /** Tiles temporarily replaced (freeze ray ice, etc.) — restored by game. */
  private original: Uint8Array;

  constructor(rows: string[]) {
    const w = Math.max(...rows.map((r) => r.length));
    this.w = w;
    this.h = rows.length;
    this.data = new Uint8Array(w * this.h);
    this.markers = { hero: null, cubo: null, checkpoints: [], coins: [], orb: null };
    for (let y = 0; y < this.h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const c = x < row.length ? row[x] : ".";
        const px = { x: x * TILE, y: y * TILE };
        if (c === "X") this.markers.hero = px;
        else if (c === "K") this.markers.cubo = px;
        else if (c === "C") this.markers.checkpoints.push(px);
        else if (c === "$") this.markers.coins.push(px);
        else if (c === "O") this.markers.orb = px;
        else {
          const k = TILE_CHARS[c];
          if (k !== undefined) this.data[y * w + x] = k;
        }
      }
    }
    // markers placed inside water (coins, checkpoints) must not leave air holes
    for (let y = 0; y < this.h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const c = x < row.length ? row[x] : ".";
        if (!"XKC$O".includes(c)) continue;
        if (this.get(x - 1, y) === T.WATER || this.get(x + 1, y) === T.WATER) this.data[y * w + x] = T.WATER;
      }
    }
    this.original = new Uint8Array(this.data);
  }

  get pixelW(): number {
    return this.w * TILE;
  }
  get pixelH(): number {
    return this.h * TILE;
  }

  get(tx: number, ty: number): TileKind {
    if (tx < 0 || tx >= this.w) return T.SOLID;
    if (ty < 0 || ty >= this.h) return T.AIR;
    return this.data[ty * this.w + tx] as TileKind;
  }
  at(px: number, py: number): TileKind {
    return this.get(Math.floor(px / TILE), Math.floor(py / TILE));
  }
  set(tx: number, ty: number, k: TileKind): void {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    this.data[ty * this.w + tx] = k;
  }
  originalAt(tx: number, ty: number): TileKind {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return T.AIR;
    return this.original[ty * this.w + tx] as TileKind;
  }
  /** Permanently record a change (bashed block) so restores don't bring it back. */
  commit(tx: number, ty: number): void {
    if (tx < 0 || tx >= this.w || ty < 0 || ty >= this.h) return;
    this.original[ty * this.w + tx] = this.data[ty * this.w + tx];
  }

  solidTile(tx: number, ty: number): boolean {
    return isSolidKind(this.get(tx, ty));
  }

  /** Any solid tile overlapping the body (inset a hair to avoid edge ties). */
  overlapsSolid(b: Body): boolean {
    const x0 = Math.floor((b.x + 0.01) / TILE);
    const x1 = Math.floor((b.x + b.w - 0.01) / TILE);
    const y0 = Math.floor((b.y + 0.01) / TILE);
    const y1 = Math.floor((b.y + b.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidTile(tx, ty)) return true;
    return false;
  }

  /** Kinds of tiles the body overlaps (for water/goo/spike sensing). */
  touching(b: Body, kind: TileKind, insetTop = 0): boolean {
    const x0 = Math.floor((b.x + 0.01) / TILE);
    const x1 = Math.floor((b.x + b.w - 0.01) / TILE);
    const y0 = Math.floor((b.y + 0.01) / TILE);
    const y1 = Math.floor((b.y + b.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (this.get(tx, ty) !== kind) continue;
        if (insetTop > 0 && b.y + b.h < ty * TILE + insetTop) continue;
        return true;
      }
    return false;
  }

  /** Fraction of the body's height that is under water (0..1). */
  waterDepth(b: Body): number {
    const cx = b.x + b.w / 2;
    let depth = 0;
    for (let py = b.y; py < b.y + b.h; py += 4) if (this.at(cx, py) === T.WATER) depth += 4;
    return Math.min(1, depth / b.h);
  }

  moveX(b: Body, dx: number): boolean {
    if (dx === 0) return false;
    const steps = Math.max(1, Math.ceil(Math.abs(dx) / 16));
    const s = dx / steps;
    for (let i = 0; i < steps; i++) {
      b.x += s;
      if (this.overlapsSolid(b)) {
        if (s > 0) {
          const tx = Math.floor((b.x + b.w - 0.01) / TILE);
          b.x = tx * TILE - b.w;
        } else {
          const tx = Math.floor((b.x + 0.01) / TILE);
          b.x = (tx + 1) * TILE;
        }
        return true;
      }
    }
    return false;
  }

  moveY(b: Body, dy: number, dropThrough = false): MoveResult {
    const r: MoveResult = { hitX: false, hitHead: false, onGround: false, onOneway: false };
    if (dy === 0) return r;
    const steps = Math.max(1, Math.ceil(Math.abs(dy) / 16));
    const s = dy / steps;
    for (let i = 0; i < steps; i++) {
      const prevBottom = b.y + b.h;
      b.y += s;
      if (s > 0) {
        if (this.overlapsSolid(b)) {
          const ty = Math.floor((b.y + b.h - 0.01) / TILE);
          b.y = ty * TILE - b.h;
          r.onGround = true;
          return r;
        }
        if (!dropThrough) {
          // one-way platforms: only when the feet were above the tile top last sub-step
          const x0 = Math.floor((b.x + 0.01) / TILE);
          const x1 = Math.floor((b.x + b.w - 0.01) / TILE);
          const ty = Math.floor((b.y + b.h - 0.01) / TILE);
          for (let tx = x0; tx <= x1; tx++) {
            if (this.get(tx, ty) === T.ONEWAY && prevBottom <= ty * TILE + 0.01) {
              b.y = ty * TILE - b.h;
              r.onGround = true;
              r.onOneway = true;
              return r;
            }
          }
        }
      } else if (this.overlapsSolid(b)) {
        const ty = Math.floor((b.y + 0.01) / TILE);
        b.y = (ty + 1) * TILE;
        r.hitHead = true;
        return r;
      }
    }
    return r;
  }

  /** True if standing on any support (solid or one-way) one pixel below. */
  grounded(b: Body): boolean {
    const probe: Body = { x: b.x, y: b.y + b.h, w: b.w, h: 1 };
    if (this.overlapsSolid(probe)) return true;
    const x0 = Math.floor((b.x + 0.01) / TILE);
    const x1 = Math.floor((b.x + b.w - 0.01) / TILE);
    const ty = Math.floor((b.y + b.h + 0.5) / TILE);
    if (Math.abs(b.y + b.h - ty * TILE) > 1) return false;
    for (let tx = x0; tx <= x1; tx++) if (this.get(tx, ty) === T.ONEWAY) return true;
    return false;
  }

  /** Tile kinds directly under the feet (distinct). */
  under(b: Body): TileKind[] {
    const out: TileKind[] = [];
    const x0 = Math.floor((b.x + 0.01) / TILE);
    const x1 = Math.floor((b.x + b.w - 0.01) / TILE);
    const ty = Math.floor((b.y + b.h + 1) / TILE);
    for (let tx = x0; tx <= x1; tx++) {
      const k = this.get(tx, ty);
      if (!out.includes(k)) out.push(k);
    }
    return out;
  }

  /** DDA line-of-sight: true when no solid tile lies between the two points. */
  raycast(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1) return true;
    const steps = Math.ceil(len / 8);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.solidTile(Math.floor((x0 + dx * t) / TILE), Math.floor((y0 + dy * t) / TILE))) return false;
    }
    return true;
  }

  /** Is the column above (tx, from ty upward `n` tiles) free of solids? */
  clearColumn(tx: number, ty: number, n: number): boolean {
    for (let i = 1; i <= n; i++) if (this.solidTile(tx, ty - i)) return false;
    return true;
  }
}
