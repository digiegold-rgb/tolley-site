/**
 * Portal Hoppers: Blocky Worlds — shared types and tuning constants.
 * One block = one world unit. A block at integer cell (x, y, z) fills [x, x+1) × [y, y+1) × [z, z+1).
 * The hero's position is its feet; standing on the block at cell y = k means feet y = k + 1.
 */
import type { FriendId, HeroKind, PowerId } from "../engine/types";

export type Vec3 = { x: number; y: number; z: number };
export type Difficulty = "adventure" | "challenge";

/** Movement tuning. Jump apex ≈ 2 blocks, Ultra ≈ 3.6 blocks, run-jump gap ≈ 5 blocks. */
export const PHYS = {
  run: 7.5,
  gravity: 33,
  jump: 11.5,
  doubleJump: 9,
  ultra: 15.5,
  ultraHold: 0.5,
  terminal: -28,
  coyote: 0.12,
  buffer: 0.15,
  glideFall: -2.5,
  glideStamina: 2.5,
  bounce: 12,
  bounceHeld: 3,
  bounceMax: 22,
  rocket: 14,
  rocketCooldown: 10,
  liftHeight: 4,
  liftGrow: 0.8,
  liftHold: 2.5,
  liftCooldown: 8,
  swimUp: 8,
  swimFall: -1.5,
} as const;

export const HERO = { half: 0.4, height: 1.6 } as const;
export const CUBO_SIZE = 1.2;

/** Block ids stored in the Uint8Array grid. Keep ≤ 32; renderers key colours off these. */
export const B = {
  air: 0,
  solid: 1,
  solid2: 2,
  ice: 3,
  bounce: 4,
  crumble: 5,
  spike: 6,
  goo: 7,
  water: 8,
  currentN: 9,
  currentE: 10,
  currentS: 11,
  currentW: 12,
  conveyorN: 13,
  conveyorE: 14,
  conveyorS: 15,
  conveyorW: 16,
  glass: 17,
  door: 18,
  switchBase: 19,
  bridge: 20,
  pillar: 21,
  star: 22,
  flip: 23,
  vine: 24,
  wall: 25,
  trim: 26,
  glow: 27,
} as const;
export type BlockId = (typeof B)[keyof typeof B];

export const SOLID = new Set<number>([
  B.solid,
  B.solid2,
  B.ice,
  B.bounce,
  B.crumble,
  B.conveyorN,
  B.conveyorE,
  B.conveyorS,
  B.conveyorW,
  B.glass,
  B.door,
  B.switchBase,
  B.bridge,
  B.pillar,
  B.star,
  B.wall,
  B.trim,
  B.glow,
]);
export const LETHAL = new Set<number>([B.spike, B.goo]);
export const isSolid = (id: number) => SOLID.has(id);

export type Armor = "guard" | "iron" | "ice" | "glass";

export type Entity =
  | { kind: "cage"; friend: FriendId; at: Vec3; armor?: Armor; guardId?: string }
  | { kind: "key"; id: string; at: Vec3 }
  | { kind: "coin"; id: string; at: Vec3 }
  | { kind: "star"; id: string; at: Vec3 }
  | { kind: "checkpoint"; index: number; at: Vec3 }
  | { kind: "switch"; id: string; at: Vec3 }
  | { kind: "sign"; text: string; at: Vec3 }
  | { kind: "hopper"; id: string; at: Vec3 }
  | { kind: "enemy"; id: string; type: string; at: Vec3 }
  | { kind: "boss"; id: string; type: string; at: Vec3; arena: { x0: number; z0: number; x1: number; z1: number } }
  | {
      kind: "mover";
      id: string;
      at: Vec3;
      size: [number, number, number];
      path: Vec3[];
      speed: number;
      block: BlockId;
    };

export type DoorDef = {
  id: string;
  cells: Vec3[];
  /** Opens automatically when the hero holds this many keys and comes close. */
  needsKeys?: number;
  /** Opens when this switch is thrown. */
  switchId?: string;
  /** Opens when the world's boss is defeated. */
  boss?: boolean;
};

export type BiomeId =
  | "factory"
  | "void"
  | "clouds"
  | "underwater"
  | "pipes"
  | "bouncy"
  | "danger"
  | "candy"
  | "dark"
  | "between";

export type BiomeKit = {
  id: BiomeId;
  /** Scene clear colour. */
  sky: string;
  skyLow: string;
  fog: string | null;
  fogNear: number;
  fogFar: number;
  ambient: number;
  sun: number;
  /** Per-block colours; anything missing falls back to `blocks.solid`. */
  blocks: Partial<Record<BlockId, string>> & { [B.solid]: string };
  tagline: string;
};

export type Controls = {
  x: number;
  z: number;
  jump: boolean;
  heldJump: boolean;
  bash: boolean;
  interact: boolean;
  power: boolean;
  cycle: boolean;
  lift: boolean;
  lockOn: boolean;
  place: boolean;
  rally: boolean;
  hold: boolean;
  bridge: boolean;
  /** Camera ray for aiming; null when no pointer is available. */
  aimOrigin: Vec3 | null;
  aimDir: Vec3 | null;
};
export const emptyControls = (): Controls => ({
  x: 0,
  z: 0,
  jump: false,
  heldJump: false,
  bash: false,
  interact: false,
  power: false,
  cycle: false,
  lift: false,
  lockOn: false,
  place: false,
  rally: false,
  hold: false,
  bridge: false,
  aimOrigin: null,
  aimDir: null,
});

export type AimHit = {
  point: Vec3;
  dist: number;
  kind: "none" | "block" | "cage" | "switch" | "enemy" | "boss" | "cubo";
  id: string | null;
};

export type Snapshot = {
  hero: HeroKind;
  world: number;
  worldName: string;
  hearts: number;
  maxHearts: number;
  coins: number;
  keys: number;
  keysNeeded: number;
  stars: number;
  rescued: FriendId[];
  active: PowerId | null;
  powerCooldown: number;
  sparks: number;
  stamina: number;
  message: string;
  objective: string;
  rescue: FriendId | null;
  portalOpen: boolean;
  finished: boolean;
  saveFailed: boolean;
  bossHP: number;
  bossMax: number;
  bossName: string | null;
  aim: AimHit["kind"];
  hasCubo: boolean;
  liftCooldown: number;
  checkpointIndex: number;
};

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const dist2 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
export const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
