/**
 * components/game/engine/types.ts — shared constants + types for Portal Hoppers.
 *
 * Everything here is data-only so worlds/* and every engine module can import
 * it without cycles. Runtime classes live in entities.ts / game.ts.
 */
import type { Hero, Cubo } from "./entities";
import type { Tilemap } from "./tilemap";
import type { Camera } from "./camera";
import type { Particles } from "./particles";

export const TILE = 32;
export const VW = 960;
export const VH = 540;
export const STEP = 1 / 60;

export const PHYS = {
  gravity: 1800,
  maxFall: 720,
  runMax: 230,
  accel: 2200,
  friction: 2600,
  airControl: 0.7,
  jumpV: -620,
  jumpCut: 0.45,
  coyote: 0.1,
  jumpBuffer: 0.12,
  ultraHold: 0.5,
  ultraV: -1020,
  boostV: -900,
  waterGravity: 380,
  waterDrag: 0.92,
  swimImpulse: -260,
  swimEvery: 0.18,
  bounceV: -860,
  tetrominoFall: 70,
  gooFactor: 0.4,
} as const;

/* ── tiles ─────────────────────────────────────────────────────────────── */
export const T = {
  AIR: 0,
  SOLID: 1,
  ONEWAY: 2,
  BASH: 3,
  WATER: 4,
  SPIKE: 5,
  BOUNCE: 6,
  PIPE: 7,
  GOO: 8,
  ICE: 9,
  GLASS: 10,
} as const;
export type TileKind = (typeof T)[keyof typeof T];

export const TILE_CHARS: Record<string, TileKind> = {
  ".": T.AIR,
  " ": T.AIR,
  "#": T.SOLID,
  "=": T.ONEWAY,
  B: T.BASH,
  "~": T.WATER,
  "^": T.SPIKE,
  S: T.BOUNCE,
  P: T.PIPE,
  G: T.GOO,
  W: T.GLASS,
};

/* ── geometry ──────────────────────────────────────────────────────────── */
export interface Vec2 {
  x: number;
  y: number;
}
export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Platform extends Body {
  vx: number;
  vy: number;
  owner?: unknown;
}

export function overlaps(a: Body, b: Body): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function centerX(b: Body): number {
  return b.x + b.w / 2;
}
export function centerY(b: Body): number {
  return b.y + b.h / 2;
}
export function dist(a: Body, b: Body): number {
  const dx = centerX(a) - centerX(b);
  const dy = centerY(a) - centerY(b);
  return Math.hypot(dx, dy);
}
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/* ── cast ──────────────────────────────────────────────────────────────── */
export type HeroKind = "frog" | "fox" | "cat";

export type FriendId =
  | "zippy"
  | "flutter"
  | "magnus"
  | "thump"
  | "bubbles"
  | "shelly"
  | "pixel"
  | "gecko"
  | "skye"
  | "dash"
  | "lumen"
  | "frosty"
  | "tock"
  | "bolt"
  | "bam";

export type PowerId =
  | "doubleJump"
  | "glide"
  | "magnet"
  | "pound"
  | "bubble"
  | "shield"
  | "shrink"
  | "wallCling"
  | "rocket"
  | "dash"
  | "glow"
  | "freeze"
  | "slowTime"
  | "speed"
  | "megaPunch";

export interface FriendDef {
  id: FriendId;
  name: string;
  animal: string;
  color: string;
  power: PowerId;
  powerName: string;
  powerHint: string;
  passive: boolean;
  thanks: string;
}

/* ── audio ─────────────────────────────────────────────────────────────── */
export type SfxName =
  | "jump"
  | "ultraCharge"
  | "ultra"
  | "bash"
  | "crack"
  | "coin"
  | "hit"
  | "boing"
  | "portal"
  | "powerup"
  | "roar"
  | "whistle"
  | "boost"
  | "respawn"
  | "splash"
  | "victory"
  | "select"
  | "stomp"
  | "freeze"
  | "pop";

export type MusicId =
  | "title"
  | "factory"
  | "star"
  | "falling"
  | "water"
  | "pipes"
  | "bouncy"
  | "danger"
  | "candy"
  | "dark"
  | "finale"
  | "boss"
  | "none";

/* ── levels ────────────────────────────────────────────────────────────── */
export interface LevelPalette {
  sky: string;
  sky2: string;
  ground: string;
  groundDark: string;
  accent: string;
  bash: string;
  star: string;
}

export interface LevelFlags {
  water?: boolean;
  endlessFall?: boolean;
  dark?: boolean;
  flipped?: boolean;
  bouncy?: boolean;
  home?: boolean;
  finale?: boolean;
}

export type LevelEntity =
  | { kind: "cage"; x: number; y: number; friend: FriendId }
  | { kind: "enemy"; x: number; y: number; type: "walker" | "flyer" | "spiky"; range?: number }
  | { kind: "boss"; x: number; y: number; type: "sultan" | "whistler" | "clank" }
  | { kind: "sign"; x: number; y: number; text: string }
  | { kind: "mover"; x: number; y: number; w: number; dx: number; dy: number; speed: number }
  | { kind: "warp"; x: number; y: number; tx: number; ty: number }
  | { kind: "npc"; x: number; y: number; who: "keeper" | "clank" | "friend"; friend?: FriendId; lines: string[] }
  | { kind: "blob"; x: number; y: number }
  | { kind: "portal"; x: number; y: number; id: string }
  | { kind: "trigger"; x: number; y: number; w: number; h: number; id: string }
  | { kind: "spawner"; x: number; y: number; w: number }
  | { kind: "glassCage"; x: number; y: number; friend: FriendId };

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  introLine: string;
  cuboLine: string;
  palette: LevelPalette;
  flags: LevelFlags;
  music: MusicId;
  cameraMode: "side" | "vertical";
  rows: string[];
  entities: LevelEntity[];
}

/* ── ui ────────────────────────────────────────────────────────────────── */
export type Screen = "title" | "select" | "intro" | "play" | "pause" | "clear" | "ending";

export interface UiCard {
  title: string;
  body: string;
  color?: string;
}

export interface UiSnapshot {
  screen: Screen;
  level: number;
  levelName: string;
  levelSubtitle: string;
  hero: HeroKind;
  muted: boolean;
  twoPlayer: boolean;
  audioUnlocked: boolean;
  card: UiCard | null;
  unlocked: number;
  rescued: FriendId[];
  coins: number;
  hasSave: boolean;
  selectIndex: number;
  introLine: string;
  cuboLine: string;
}

/* ── rng ───────────────────────────────────────────────────────────────── */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  /** mulberry32 */
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
  int(lo: number, hi: number): number {
    return Math.floor(this.range(lo, hi + 1));
  }
  pick<X>(arr: readonly X[]): X {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

/* ── game context handed to entities ───────────────────────────────────── */
export interface Light {
  x: number;
  y: number;
  r: number;
  color?: string;
}

export interface Bubble {
  speaker: "hero" | "cubo" | "npc" | "boss";
  text: string;
  x: number;
  y: number;
  ttl: number;
  color: string;
}

export interface GameCtx {
  readonly map: Tilemap;
  readonly level: LevelDef;
  readonly hero: Hero;
  readonly cubo: Cubo;
  readonly camera: Camera;
  readonly particles: Particles;
  readonly rng: Rng;
  readonly platforms: Platform[];
  readonly lights: Light[];
  readonly bubbles: Bubble[];
  time: number;
  timeScale: number;
  twoPlayer: boolean;
  god: boolean;
  sfx(name: SfxName): void;
  add(e: EntityLike): void;
  entities(): EntityLike[];
  say(speaker: Bubble["speaker"], text: string, x: number, y: number, ttl?: number): void;
  card(card: UiCard, seconds?: number): void;
  shake(amount: number): void;
  friendFreed(id: FriendId): void;
  orbBroken(x: number, y: number): void;
  coin(): void;
  trigger(id: string): void;
  bossDefeated(type: "sultan" | "whistler" | "clank", x: number, y: number): void;
  cageHero(x: number, y: number): void;
  heroCaged(): boolean;
  freeHero(): void;
  reachedCheckpoint(x: number, y: number): void;
  heroRespawned(): void;
}

export interface EntityLike {
  layer: number;
  dead: boolean;
  body: Body;
  kind: string;
  update(g: GameCtx, dt: number): void;
}
