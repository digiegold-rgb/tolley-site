/** Versioned local save for Blocky Worlds. Older 3D and Classic saves are ignored, never overwritten. */
import { FRIENDS } from "../worlds/friends";
import type { FriendId, HeroKind } from "../engine/types";
import { clamp, type Difficulty } from "./types";

export const SAVE_KEY = "tolley-portal-hoppers-voxel-v3";
export type Settings = {
  muted: boolean;
  music: number;
  effects: number;
  quality: "high" | "low";
  look: "lock" | "drag";
  sensitivity: number;
  invertY: boolean;
};
export type Save = {
  version: 3;
  hero: HeroKind;
  difficulty: Difficulty;
  world: number;
  unlocked: number;
  rescued: FriendId[];
  hoppers: string[];
  coins: number;
  sparks: number;
  stars: string[];
  /** Keys collected in the current world (ids), so a resume keeps them. */
  keys: string[];
  /** Index of the last checkpoint touched in the current world; 0 = world start. */
  checkpoint: number;
  /** The current world's boss is already beaten (cleared when a new world loads). */
  bossDown: boolean;
  finished: boolean;
  settings: Settings;
};
export const defaultSettings = (): Settings => ({
  muted: false,
  music: 0.7,
  effects: 0.8,
  quality: "high",
  look: "lock",
  sensitivity: 1,
  invertY: false,
});
export const newSave = (hero: HeroKind = "frog", difficulty: Difficulty = "challenge"): Save => ({
  version: 3,
  hero,
  difficulty,
  world: 1,
  unlocked: 1,
  rescued: [],
  hoppers: [],
  coins: 0,
  sparks: 3,
  stars: [],
  keys: [],
  checkpoint: 0,
  bossDown: false,
  finished: false,
  settings: defaultSettings(),
});
const strings = (v: unknown, ok: (s: string) => boolean) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && ok(x)))] : [];
export function readSave(raw?: string | null): Save | null {
  try {
    const text = raw === undefined ? (typeof localStorage !== "undefined" ? localStorage.getItem(SAVE_KEY) : null) : raw;
    if (!text) return null;
    const s = JSON.parse(text);
    if (s.version !== 3) return null;
    const d = newSave(["frog", "fox", "cat"].includes(s.hero) ? s.hero : "frog", s.difficulty === "adventure" ? "adventure" : "challenge");
    d.world = Number.isInteger(s.world) ? clamp(s.world, 1, 10) : 1;
    d.unlocked = Number.isInteger(s.unlocked) ? clamp(s.unlocked, d.world, 10) : d.world;
    d.rescued = strings(s.rescued, (x) => FRIENDS.some((f) => f.id === x)) as FriendId[];
    d.hoppers = strings(s.hoppers, (x) => /^h-(10|[1-9])-\d{1,2}$/.test(x));
    d.coins = Number.isFinite(s.coins) ? clamp(Math.floor(s.coins), 0, 999999) : 0;
    d.sparks = Number.isInteger(s.sparks) ? clamp(s.sparks, 0, 3) : 3;
    d.stars = strings(s.stars, (x) => /^star-(10|[1-9])-[1-3]$/.test(x));
    d.keys = strings(s.keys, (x) => /^key-[1-3]$/.test(x));
    d.checkpoint = Number.isInteger(s.checkpoint) ? clamp(s.checkpoint, 0, 3) : 0;
    d.bossDown = s.bossDown === true;
    d.finished = s.finished === true;
    if (s.settings && typeof s.settings === "object") {
      const t = s.settings;
      d.settings = {
        muted: t.muted === true,
        music: Number.isFinite(t.music) ? clamp(t.music, 0, 1) : 0.7,
        effects: Number.isFinite(t.effects) ? clamp(t.effects, 0, 1) : 0.8,
        quality: t.quality === "low" ? "low" : "high",
        look: t.look === "drag" ? "drag" : "lock",
        sensitivity: Number.isFinite(t.sensitivity) ? clamp(t.sensitivity, 0.25, 3) : 1,
        invertY: t.invertY === true,
      };
    }
    return d;
  } catch {
    return null;
  }
}
export function writeSave(save: Save) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
