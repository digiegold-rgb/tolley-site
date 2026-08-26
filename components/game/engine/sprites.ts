/**
 * 16×16 string-grid sprites rendered once to offscreen canvases (×2 = one
 * tile) and cached by name:frame:palette. Heroes share every frame; kinds
 * differ by palette + a 3-row ear/eye overlay.
 */
import type { HeroKind } from "./types";

export type Palette = Record<string, string>;

const cache = new Map<string, HTMLCanvasElement>();

export function gridSprite(key: string, grid: string[], pal: Palette, scale = 2): HTMLCanvasElement | null {
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === "undefined") return null;
  const w = Math.max(...grid.map((r) => r.length));
  const h = grid.length;
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = grid[y][x] ?? ".";
      const col = pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  cache.set(key, c);
  return c;
}

/* ── hero ─────────────────────────────────────────────────────────────── */
export type HeroFrame = "idle" | "run1" | "run2" | "jump" | "fall" | "hurt" | "swim";

const HERO_BODY: Record<HeroFrame, string[]> = {
  idle: [
    "................",
    "................",
    "....dddddddd....",
    "...dhhhhhhhhd...",
    "..dhhhhhhhhhhd..",
    "..dhwwehhwwehd..",
    "..dhwwehhwwehd..",
    "..dhhhhhhhhhhd..",
    "..dhhpllllphhd..",
    "...dhhllllhhd...",
    "...dhhllllhhd...",
    "..dhhhllllhhhd..",
    "..dhhhhhhhhhhd..",
    "...dhhhhhhhhd...",
    "....ddd..ddd....",
    "....dhd..dhd....",
  ],
  run1: [
    "................",
    "................",
    "....dddddddd....",
    "...dhhhhhhhhd...",
    "..dhhhhhhhhhhd..",
    "..dhwwehhwwehd..",
    "..dhwwehhwwehd..",
    "..dhhhhhhhhhhd..",
    "..dhhpllllphhd..",
    "...dhhllllhhd...",
    "...dhhllllhhd...",
    "..dhhhllllhhhd..",
    "..dhhhhhhhhhhd..",
    "...dhhhhhhhhd...",
    "...ddd....ddd...",
    "..dhd......dhd..",
  ],
  run2: [
    "................",
    "................",
    "....dddddddd....",
    "...dhhhhhhhhd...",
    "..dhhhhhhhhhhd..",
    "..dhwwehhwwehd..",
    "..dhwwehhwwehd..",
    "..dhhhhhhhhhhd..",
    "..dhhpllllphhd..",
    "...dhhllllhhd...",
    "...dhhllllhhd...",
    "..dhhhllllhhhd..",
    "..dhhhhhhhhhhd..",
    "...dhhhhhhhhd...",
    ".....dddddd.....",
    ".....dhddhd.....",
  ],
  jump: [
    "................",
    "................",
    "....dddddddd....",
    "...dhhhhhhhhd...",
    "..dhhhhhhhhhhd..",
    "..dhwwehhwwehd..",
    "..dhwwehhwwehd..",
    "..dhhhhhhhhhhd..",
    "dddhhpllllphhddd",
    "dh.dhhllllhhd.hd",
    "...dhhllllhhd...",
    "..dhhhllllhhhd..",
    "..dhhhhhhhhhhd..",
    "...dhhhhhhhhd...",
    "....dhhddhhd....",
    ".....dd..dd.....",
  ],
  fall: [
    "................",
    "................",
    "....dddddddd....",
    "...dhhhhhhhhd...",
    "..dhhhhhhhhhhd..",
    "..dhwwehhwwehd..",
    "..dhwwehhwwehd..",
    "..dhhhhpphhhhd..",
    "..dhhpllllphhd..",
    ".ddhhhllllhhhdd.",
    "dh.dhhllllhhd.hd",
    "..dhhhllllhhhd..",
    "..dhhhhhhhhhhd..",
    "...dhhhhhhhhd...",
    "...ddd....ddd...",
    "..dhd......dhd..",
  ],
  hurt: [
    "................",
    "................",
    "....dddddddd....",
    "...dhhhhhhhhd...",
    "..dhhhhhhhhhhd..",
    "..dhehehhehehd..",
    "..dhhehhhhehhd..",
    "..dhehehhehehd..",
    "..dhhhpppphhhd..",
    "...dhhllllhhd...",
    "...dhhllllhhd...",
    "..dhhhllllhhhd..",
    "..dhhhhhhhhhhd..",
    "...dhhhhhhhhd...",
    "...ddd....ddd...",
    "..dhd......dhd..",
  ],
  swim: [
    "................",
    "................",
    "....dddddddd....",
    "...dhhhhhhhhd...",
    "..dhhhhhhhhhhd..",
    "..dhwwehhwwehd..",
    "..dhwwehhwwehd..",
    "..dhhhhhhhhhhd..",
    "ddddhpllllphdddd",
    "dhhdhhllllhhdhhd",
    "dddhhhllllhhhddd",
    "..dhhhllllhhhd..",
    "..dhhhhhhhhhhd..",
    "...dhhhhhhhhd...",
    "....dddddddd....",
    ".....dhhhhd.....",
  ],
};

const KIND_TOP: Record<HeroKind, string[]> = {
  frog: ["...dddd..dddd...", "...dwwd..dwwd...", "...dwed..dwed..."],
  fox: ["..dd........dd..", "..dhd......dhd..", "..dhld....dlhd.."],
  cat: ["...dd......dd...", "...dhd....dhd...", "...dhpd..dphd..."],
};

export const HERO_PALETTES: Record<HeroKind, Palette> = {
  frog: { h: "#4ade80", l: "#bbf7d0", d: "#14532d", w: "#ffffff", e: "#111827", p: "#f472b6" },
  fox: { h: "#fb923c", l: "#ffedd5", d: "#7c2d12", w: "#ffffff", e: "#111827", p: "#f472b6" },
  cat: { h: "#a78bfa", l: "#ede9fe", d: "#3b0764", w: "#ffffff", e: "#111827", p: "#f472b6" },
};

export function heroSprite(kind: HeroKind, frame: HeroFrame, shellPal?: Palette): HTMLCanvasElement | null {
  const key = `hero:${kind}:${frame}:${shellPal ? "shell" : "n"}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const body = HERO_BODY[frame].slice();
  const top = KIND_TOP[kind];
  for (let r = 0; r < top.length; r++) {
    const src = top[r];
    let row = body[r];
    let out = "";
    for (let x = 0; x < 16; x++) out += src[x] !== "." ? src[x] : row[x];
    row = out;
    body[r] = row;
  }
  return gridSprite(key, body, shellPal ?? HERO_PALETTES[kind]);
}

/* ── Cubo ─────────────────────────────────────────────────────────────── */
const CUBO: Record<"idle" | "blink" | "throw" | "hurt", string[]> = {
  idle: [
    "....dddddddd....",
    "...dbbbbbbbbd...",
    "...dbwebbwebd...",
    "...dbbbbbbbbd...",
    "....dddddddd....",
    "..dddddddddddd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dylyyyyyylyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dddddddddddd..",
  ],
  blink: [
    "....dddddddd....",
    "...dbbbbbbbbd...",
    "...dbddbbddbd...",
    "...dbbbbbbbbd...",
    "....dddddddd....",
    "..dddddddddddd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dylyyyyyylyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dddddddddddd..",
  ],
  throw: [
    "..dddddddd......",
    ".dbbbbbbbbd.....",
    ".dbwebbwebd.....",
    ".dbbbbbbbbd.....",
    "..dddddddd......",
    "..dddddddddddd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dylyyyyyylyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dddddddddddd..",
  ],
  hurt: [
    "....dddddddd....",
    "...dbbbbbbbbd...",
    "...dbebebebed...",
    "...dbbbbbbbbd...",
    "....dddddddd....",
    "..dddddddddddd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dylyyyyyylyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dyyyyyyyyyyd..",
    "..dddddddddddd..",
  ],
};
const CUBO_PAL: Palette = { d: "#1e1b4b", b: "#60a5fa", y: "#fde047", l: "#fef9c3", w: "#ffffff", e: "#111827" };

export function cuboSprite(frame: keyof typeof CUBO): HTMLCanvasElement | null {
  return gridSprite(`cubo:${frame}`, CUBO[frame], CUBO_PAL);
}

/* ── enemies ───────────────────────────────────────────────────────────── */
const ENEMY: Record<"walker1" | "walker2" | "flyer1" | "flyer2" | "spiky", string[]> = {
  walker1: [
    "................",
    "................",
    "................",
    ".....dddddd.....",
    "...ddhhhhhhdd...",
    "..dhhhhhhhhhhd..",
    "..dhwehhhhwehd..",
    "..dhwehhhhwehd..",
    "..dhhhhhhhhhhd..",
    "..dhhhddddhhhd..",
    "..dhhhhhhhhhhd..",
    "...dhhhhhhhhd...",
    "....dddddddd....",
    "...dhd....dhd...",
    "...ddd....ddd...",
    "................",
  ],
  walker2: [
    "................",
    "................",
    "................",
    ".....dddddd.....",
    "...ddhhhhhhdd...",
    "..dhhhhhhhhhhd..",
    "..dhwehhhhwehd..",
    "..dhwehhhhwehd..",
    "..dhhhhhhhhhhd..",
    "..dhhhddddhhhd..",
    "..dhhhhhhhhhhd..",
    "...dhhhhhhhhd...",
    "....dddddddd....",
    ".....dhddhd.....",
    ".....dddddd.....",
    "................",
  ],
  flyer1: [
    "................",
    "................",
    "dd............dd",
    "dhdd........ddhd",
    "dhhhdd....ddhhhd",
    ".dhhhhddddhhhhd.",
    "..dhhhhhhhhhhd..",
    "...dhwehhwehd...",
    "...dhhhhhhhhd...",
    "...dhhddddhhd...",
    "....dhhhhhhd....",
    ".....dddddd.....",
    "................",
    "................",
    "................",
    "................",
  ],
  flyer2: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "..dddddddddddd..",
    ".dhhhhhhhhhhhhd.",
    "dhhhdhwehhwehdhhd",
    ".dddhhhhhhhhhddd",
    "...dhhddddhhd...",
    "....dhhhhhhd....",
    ".....dddddd.....",
    "................",
    "................",
    "................",
    "................",
  ],
  spiky: [
    ".......d........",
    "...d..dhd..d....",
    "..dhd.dhd.dhd...",
    "...dddddddd.....",
    "d.dhhhhhhhhd..d.",
    "dhdhhhhhhhhdhdh.",
    ".dhhwehhhwehhd..",
    "ddhhwehhhwehhdd.",
    ".dhhhhhhhhhhhd..",
    "dhdhhhddddhhhdhd",
    "d.dhhhhhhhhhhd.d",
    "...dhhhhhhhhd...",
    "..dhddddddddhd..",
    "..d..d....d..d..",
    "................",
    "................",
  ],
};
const ENEMY_PAL: Record<string, Palette> = {
  walker: { d: "#3f1d0b", h: "#b45309", w: "#ffffff", e: "#111827" },
  flyer: { d: "#312e81", h: "#818cf8", w: "#ffffff", e: "#111827" },
  spiky: { d: "#4c0519", h: "#f43f5e", w: "#ffffff", e: "#111827" },
  frozen: { d: "#0c4a6e", h: "#bae6fd", w: "#e0f2fe", e: "#0369a1" },
};

export function enemySprite(type: "walker" | "flyer" | "spiky", frame: number, frozen = false): HTMLCanvasElement | null {
  const name = type === "spiky" ? "spiky" : (`${type}${(frame % 2) + 1}` as keyof typeof ENEMY);
  const pal = frozen ? ENEMY_PAL.frozen : ENEMY_PAL[type];
  return gridSprite(`enemy:${name}:${frozen ? "f" : "n"}`, ENEMY[name], pal);
}

/* ── misc grids ────────────────────────────────────────────────────────── */
const CROWN = ["..d.d.d.d.d.d..", "..dydydydydyd..", "..dyyyyyyyyyd..", "..dddddddddddd.."];
export function crownSprite(): HTMLCanvasElement | null {
  return gridSprite("crown", CROWN, { d: "#78350f", y: "#fde047" });
}

export function clearSpriteCache(): void {
  cache.clear();
}
