import type { FriendId, HeroKind } from "./types";

export interface SaveData {
  unlocked: number;
  rescued: FriendId[];
  hero: HeroKind;
  muted: boolean;
  coins: number;
  finished: boolean;
}

const KEY = "tolley-portal-hoppers-v1";
const HEROES: HeroKind[] = ["frog", "fox", "cat"];
const FRIENDS: FriendId[] = [
  "zippy", "flutter", "magnus", "thump", "bubbles", "shelly", "pixel", "gecko",
  "skye", "dash", "lumen", "frosty", "tock", "bolt", "bam",
];

export function defaultSave(): SaveData {
  return { unlocked: 1, rescued: [], hero: "frog", muted: false, coins: 0, finished: false };
}

export function loadSave(): SaveData {
  const d = defaultSave();
  if (typeof window === "undefined") return d;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return d;
    const j: unknown = JSON.parse(raw);
    if (!j || typeof j !== "object") return d;
    const o = j as Record<string, unknown>;
    if (typeof o.unlocked === "number" && o.unlocked >= 1 && o.unlocked <= 10) d.unlocked = Math.floor(o.unlocked);
    if (Array.isArray(o.rescued)) d.rescued = o.rescued.filter((f): f is FriendId => typeof f === "string" && (FRIENDS as string[]).includes(f));
    if (typeof o.hero === "string" && (HEROES as string[]).includes(o.hero)) d.hero = o.hero as HeroKind;
    if (typeof o.muted === "boolean") d.muted = o.muted;
    if (typeof o.coins === "number" && o.coins >= 0) d.coins = Math.floor(o.coins);
    if (typeof o.finished === "boolean") d.finished = o.finished;
  } catch {
    /* corrupt or blocked storage → defaults */
  }
  return d;
}

export function writeSave(d: SaveData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* private mode / quota — the game still plays */
  }
}

export function hasSave(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}
