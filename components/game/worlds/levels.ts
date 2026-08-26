/**
 * The ten worlds. Maps are built with a tiny grid DSL so nothing misaligns.
 *
 * Tile legend:  . air  # solid  = one-way  B bash  ~ water  ^ spike
 *               S bounce  P pipe  G goo  W glass
 * Markers:      X hero  K Cubo  C checkpoint  $ coin  O orb
 * Entity tile coords: (x, y) = the tile the thing STANDS IN (floor is y+1).
 */
import type { LevelDef, LevelEntity, LevelPalette } from "../engine/types";

class Grid {
  private g: string[][];
  readonly w: number;
  readonly h: number;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.g = Array.from({ length: h }, () => Array.from({ length: w }, () => "."));
  }
  set(x: number, y: number, c: string): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.g[y][x] = c;
  }
  fill(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }
  put(x: number, y: number, s: string): this {
    for (let i = 0; i < s.length; i++) if (s[i] !== " ") this.set(x + i, y, s[i]);
    return this;
  }
  /** floor rows (bottom two) across [x, x+w) */
  floor(x: number, w: number): this {
    return this.fill(x, this.h - 2, w, 2, "#");
  }
  pit(x: number, w: number): this {
    return this.fill(x, this.h - 2, w, 2, ".");
  }
  walls(): this {
    this.fill(0, 0, 1, this.h, "#");
    this.fill(this.w - 1, 0, 1, this.h, "#");
    return this;
  }
  coins(x: number, y: number, n: number, step = 1): this {
    for (let i = 0; i < n; i++) this.set(x + i * step, y, "$");
    return this;
  }
  rows(): string[] {
    return this.g.map((r) => r.join(""));
  }
}

const pal = (sky: string, sky2: string, ground: string, groundDark: string, accent: string, bash: string, star: string): LevelPalette => ({
  sky,
  sky2,
  ground,
  groundDark,
  accent,
  bash,
  star,
});

/* ═══════════════ 1 · CLANK'S GADGET WORKS ═══════════════ */
function level1(): LevelDef {
  const g = new Grid(120, 18).walls().floor(1, 118);
  g.put(3, 15, "X");
  g.coins(8, 14, 3);
  g.fill(14, 14, 3, 2, "#").fill(17, 12, 3, 4, "#"); // stairs
  g.fill(24, 8, 4, 1, "#").coins(24, 7, 4); // ultra ledge
  g.fill(30, 13, 1, 3, "B"); // bash wall
  g.coins(33, 14, 2);
  g.fill(52, 16, 3, 1, ".").fill(52, 17, 3, 1, "^"); // spike pit
  g.put(58, 15, "C");
  g.coins(60, 13, 3, 2);
  g.fill(71, 14, 3, 2, "#"); // Zippy pedestal
  g.fill(80, 13, 2, 3, "B");
  g.coins(84, 14, 3);
  // Clank's lab: glass floor accents
  g.fill(90, 15, 24, 1, "W");
  const entities: LevelEntity[] = [
    { kind: "sign", x: 5, y: 15, text: "← → to move. SPACE to jump!" },
    { kind: "sign", x: 20, y: 11, text: "Stand still, HOLD SPACE, then let go... ULTRA JUMP!" },
    { kind: "sign", x: 27, y: 15, text: "Press X to BASH blocks!" },
    { kind: "glassCage", x: 37, y: 15, friend: "flutter" },
    { kind: "glassCage", x: 41, y: 15, friend: "thump" },
    { kind: "glassCage", x: 45, y: 15, friend: "bubbles" },
    { kind: "sign", x: 34, y: 15, text: "Captain Clank locked up EVERYBODY. We have to get them out." },
    { kind: "sign", x: 49, y: 15, text: "Mind the spikes!" },
    { kind: "enemy", x: 64, y: 15, type: "walker", range: 4 },
    { kind: "sign", x: 61, y: 15, text: "Jump on its head!" },
    { kind: "cage", x: 72, y: 13, friend: "zippy" },
    { kind: "sign", x: 68, y: 15, text: "Zippy! Bash the cage 3 times with X." },
    { kind: "trigger", x: 88, y: 8, w: 1, h: 8, id: "l1-clank" },
    { kind: "npc", x: 96, y: 15, who: "clank", lines: [] },
    { kind: "portal", x: 104, y: 15, id: "l1-out" },
  ];
  return {
    id: 1,
    name: "Clank's Gadget Works",
    subtitle: "World 1 · Home",
    introLine: "Captain Clank has caged all your friends. Time to do something about it.",
    cuboLine: "",
    palette: pal("#2b2d42", "#14152a", "#6b7280", "#374151", "#f59e0b", "#b45309", "#fbbf24"),
    flags: { home: true },
    music: "factory",
    cameraMode: "side",
    rows: g.rows(),
    entities,
  };
}

/* ═══════════════ 2 · STAR WORLD ═══════════════ */
function level2(): LevelDef {
  const g = new Grid(140, 18).walls().floor(1, 138);
  g.put(3, 15, "X").put(9, 15, "K");
  g.fill(18, 10, 4, 1, "#"); // Flutter ledge
  g.coins(24, 14, 5);
  g.fill(32, 14, 2, 2, "#").fill(34, 12, 2, 4, "#");
  g.pit(40, 3);
  g.coins(40, 12, 3);
  g.fill(48, 15, 2, 1, "^");
  g.coins(48, 13, 2);
  g.pit(56, 8);
  g.coins(57, 10, 6);
  g.fill(65, 14, 2, 2, "B");
  g.put(75, 15, "C");
  g.coins(80, 13, 4);
  g.fill(90, 13, 3, 1, "=").coins(90, 12, 3);
  g.pit(100, 3);
  g.fill(101, 13, 1, 1, "=");
  g.coins(106, 14, 4);
  g.fill(112, 13, 2, 3, "B");
  g.put(122, 6, "O");
  g.coins(118, 14, 8);
  const entities: LevelEntity[] = [
    { kind: "trigger", x: 6, y: 8, w: 1, h: 8, id: "meet-cubo" },
    { kind: "sign", x: 12, y: 15, text: "Hold UP next to Cubo, hop on his head, keep holding UP — he grows into a PILLAR!" },
    { kind: "cage", x: 19, y: 9, friend: "flutter" },
    { kind: "sign", x: 37, y: 15, text: "Jump the gap!" },
    { kind: "sign", x: 45, y: 15, text: "Spikes hurt. Jump over them." },
    { kind: "mover", x: 54, y: 13, w: 3, dx: 8, dy: 0, speed: 70 },
    { kind: "sign", x: 52, y: 15, text: "Ride the platform." },
    { kind: "cage", x: 68, y: 15, friend: "magnus" },
    { kind: "enemy", x: 84, y: 15, type: "walker", range: 5 },
    { kind: "enemy", x: 95, y: 10, type: "flyer", range: 3 },
    { kind: "sign", x: 110, y: 15, text: "The ORB opens the portal. It's up high — use Cubo's pillar, then JUMP and bash it 3 times!" },
  ];
  return {
    id: 2,
    name: "Star World",
    subtitle: "World 2 · Way up high",
    introLine: "You land on a floating island under a billion stars. Somebody's humming.",
    cuboLine: "Hi! I'm Cubo. Nobody ever visits Star World. Can I come with you?",
    palette: pal("#0f0a2e", "#1e1b4b", "#7c3aed", "#4c1d95", "#c4b5fd", "#a78bfa", "#fef9c3"),
    flags: {},
    music: "star",
    cameraMode: "side",
    rows: g.rows(),
    entities,
  };
}

/* ═══════════════ 3 · FALLING WORLD ═══════════════ */
function level3(): LevelDef {
  const H = 120;
  const g = new Grid(30, H).walls();
  g.fill(10, 3, 8, 1, "#"); // start ledge — walk off either side to fall
  g.put(14, 2, "X").put(17, 2, "K");
  g.put(14, 5, "O");
  g.fill(1, H - 2, 28, 2, "#"); // floor
  // wall ledges to rest on
  for (let y = 18; y < H - 12; y += 16) {
    const left = (y / 16) % 2 === 0;
    g.fill(left ? 1 : 24, y, 5, 1, "=");
    g.coins(left ? 2 : 25, y - 1, 3);
  }
  g.fill(11, 60, 8, 1, "#");
  g.coins(8, 30, 14, 1);
  g.coins(8, 90, 14, 1);
  g.put(15, H - 3, "C");
  const entities: LevelEntity[] = [
    { kind: "spawner", x: 2, y: 6, w: 26 },
    { kind: "sign", x: 12, y: 2, text: "No floor here! Steer while you fall. Land on the blocks and hop down." },
    { kind: "cage", x: 14, y: 59, friend: "thump" },
    { kind: "sign", x: 12, y: 59, text: "Thump! Free him for GROUND POUND." },
  ];
  return {
    id: 3,
    name: "Falling World",
    subtitle: "World 3 · Down, down, down",
    introLine: "There is no ground. There is only DOWN. The orb is falling with you — catch it at the bottom.",
    cuboLine: "Whoa, no floor! Just keep falling and steer. I'll be right behind you!",
    palette: pal("#312e81", "#0e7490", "#0891b2", "#164e63", "#67e8f9", "#22d3ee", "#e0f2fe"),
    flags: { endlessFall: true },
    music: "falling",
    cameraMode: "vertical",
    rows: g.rows(),
    entities,
  };
}

/* ═══════════════ 4 · WATER WORLD ═══════════════ */
function level4(): LevelDef {
  const g = new Grid(130, 20).walls();
  g.fill(1, 18, 128, 2, "#");
  g.fill(1, 11, 128, 7, "~"); // water line at row 11
  g.fill(1, 10, 10, 8, "#"); // start island (above the water)
  g.put(3, 9, "X").put(7, 9, "K");
  g.coins(14, 13, 6, 2);
  g.fill(24, 10, 6, 8, "#");
  g.coins(25, 9, 4);
  // tunnel 1 (Bubbles) — dive at cols 34–35, swim right along row 15
  g.fill(36, 12, 14, 6, "#");
  g.fill(36, 15, 12, 2, "~");
  g.fill(46, 13, 3, 4, "~");
  g.coins(38, 15, 6);
  // mid island
  g.fill(56, 10, 8, 8, "#");
  g.put(57, 9, "C");
  g.coins(66, 13, 5, 2);
  g.fill(70, 17, 5, 1, "^");
  // tunnel 2
  g.fill(80, 11, 20, 7, "#");
  g.fill(80, 14, 20, 2, "~");
  g.fill(88, 12, 3, 2, "~").coins(88, 12, 3);
  g.fill(96, 16, 3, 1, "~");
  g.coins(82, 14, 8, 2);
  // end island
  g.fill(108, 10, 22, 8, "#");
  g.coins(110, 9, 5);
  g.put(120, 6, "O");
  const entities: LevelEntity[] = [
    { kind: "sign", x: 2, y: 9, text: "Press UP to swim. Cubo floats — the tunnels are all yours!" },
    { kind: "cage", x: 47, y: 16, friend: "bubbles" },
    { kind: "sign", x: 33, y: 9, text: "Dive down and swim through the tunnel!" },
    { kind: "enemy", x: 60, y: 9, type: "spiky", range: 2 },
    { kind: "cage", x: 62, y: 9, friend: "shelly" },
    { kind: "sign", x: 77, y: 9, text: "Another tunnel. Watch for the spikes!" },
    { kind: "enemy", x: 114, y: 7, type: "flyer", range: 3 },
    { kind: "sign", x: 109, y: 9, text: "Jump and bash the orb!" },
  ];
  return {
    id: 4,
    name: "Water World",
    subtitle: "World 4 · Splash",
    introLine: "Everything is wet. Cubo bobs on top like a rubber duck.",
    cuboLine: "I float. I can't dive. The tunnels are all yours — I'll wait up top!",
    palette: pal("#0ea5e9", "#075985", "#f59e0b", "#b45309", "#fde68a", "#fbbf24", "#e0f2fe"),
    flags: { water: true },
    music: "water",
    cameraMode: "side",
    rows: g.rows(),
    entities,
  };
}

/* ═══════════════ 5 · PIPE WORLD ═══════════════ */
function level5(): LevelDef {
  const g = new Grid(120, 18).walls().floor(1, 118);
  g.put(3, 15, "X").put(6, 15, "K");
  g.fill(16, 11, 8, 5, "#");
  g.fill(16, 15, 5, 1, "."); // 1-tile crawl tunnel (needs Shrink)
  g.fill(21, 13, 2, 3, "."); // chamber
  g.coins(17, 15, 4);
  g.fill(26, 13, 2, 3, "P"); // pipe A
  g.fill(30, 4, 12, 1, "#").coins(31, 3, 5);
  g.fill(38, 2, 2, 2, "P"); // pipe B (on ledge)
  g.fill(44, 0, 2, 16, "#"); // wall
  g.coins(48, 14, 3);
  g.fill(56, 13, 2, 3, "P"); // pipe C
  g.fill(66, 9, 10, 1, "#").coins(67, 8, 4);
  g.fill(72, 7, 2, 2, "P"); // pipe D
  g.fill(80, 0, 2, 16, "#"); // wall 2
  g.coins(84, 14, 3);
  g.put(90, 15, "C");
  g.fill(96, 15, 2, 1, "^");
  g.fill(100, 13, 2, 3, "P"); // pipe E
  g.fill(106, 4, 10, 1, "#");
  g.put(112, 2, "O");
  g.coins(107, 3, 4);
  const entities: LevelEntity[] = [
    { kind: "cage", x: 10, y: 15, friend: "pixel" },
    { kind: "sign", x: 8, y: 15, text: "Pixel! Free her for SHRINK — press C to squeeze through tiny gaps." },
    { kind: "cage", x: 22, y: 15, friend: "gecko" },
    { kind: "sign", x: 14, y: 15, text: "A tiny tunnel! SHRINK (C) to crawl in — Gecko is inside!" },
    { kind: "sign", x: 24, y: 15, text: "Stand on a pipe and press DOWN to ride it!" },
    { kind: "warp", x: 26, y: 13, tx: 34, ty: 3 },
    { kind: "warp", x: 38, y: 2, tx: 50, ty: 15 },
    { kind: "enemy", x: 60, y: 15, type: "walker", range: 3 },
    { kind: "warp", x: 56, y: 13, tx: 70, ty: 8 },
    { kind: "enemy", x: 74, y: 15, type: "spiky", range: 2 },
    { kind: "warp", x: 72, y: 7, tx: 88, ty: 15 },
    { kind: "enemy", x: 94, y: 15, type: "walker", range: 2 },
    { kind: "warp", x: 100, y: 13, tx: 110, ty: 3 },
    { kind: "sign", x: 104, y: 15, text: "The orb is up top. Ride the pipe!" },
  ];
  return {
    id: 5,
    name: "Pipe World",
    subtitle: "World 5 · Twisty",
    introLine: "A maze of green pipes. Every one goes somewhere. Some go somewhere GOOD.",
    cuboLine: "Pipes! Stand on top of one and press DOWN. I'll find my own way.",
    palette: pal("#14532d", "#052e16", "#4b5563", "#1f2937", "#86efac", "#65a30d", "#bbf7d0"),
    flags: {},
    music: "pipes",
    cameraMode: "side",
    rows: g.rows(),
    entities,
  };
}

/* ═══════════════ 6 · BOUNCY WORLD ═══════════════ */
function level6(): LevelDef {
  const g = new Grid(130, 18).walls().floor(1, 128);
  g.put(3, 15, "X").put(6, 15, "K");
  g.fill(10, 15, 3, 1, "S");
  g.fill(14, 8, 5, 1, "=").coins(14, 7, 5);
  g.coins(22, 13, 4);
  g.fill(32, 15, 2, 1, "S");
  g.pit(34, 14);
  g.fill(36, 14, 2, 4, "#").fill(36, 13, 2, 1, "S");
  g.fill(40, 14, 2, 4, "#").fill(40, 13, 2, 1, "S");
  g.fill(44, 14, 2, 4, "#").fill(44, 13, 2, 1, "S");
  g.coins(37, 8, 8);
  g.put(50, 15, "C");
  g.fill(54, 15, 2, 1, "S").fill(57, 15, 3, 1, "^");
  g.fill(62, 15, 2, 1, "S");
  g.fill(60, 10, 6, 1, "=").fill(62, 9, 1, 1, "S");
  g.fill(60, 4, 6, 1, "=").coins(60, 3, 6);
  g.coins(70, 13, 4);
  g.pit(90, 10);
  g.fill(94, 14, 2, 4, "#");
  g.coins(92, 9, 6);
  g.fill(106, 14, 1, 2, "B");
  g.fill(120, 15, 4, 1, "S");
  g.put(122, 6, "O");
  const entities: LevelEntity[] = [
    { kind: "sign", x: 8, y: 15, text: "Pink pads BOUNCE you. Hold JUMP as you land for a SUPER bounce!" },
    { kind: "cage", x: 16, y: 7, friend: "skye" },
    { kind: "blob", x: 24, y: 15 },
    { kind: "blob", x: 30, y: 15 },
    { kind: "sign", x: 32, y: 15, text: "Bounce across the pillars!" },
    { kind: "enemy", x: 75, y: 9, type: "flyer", range: 4 },
    { kind: "enemy", x: 82, y: 15, type: "walker", range: 4 },
    { kind: "blob", x: 94, y: 13 },
    { kind: "sign", x: 87, y: 15, text: "Bounce on the blob to cross!" },
    { kind: "cage", x: 108, y: 15, friend: "dash" },
    { kind: "sign", x: 116, y: 15, text: "SUPER bounce (hold JUMP) to reach the orb!" },
  ];
  return {
    id: 6,
    name: "Bouncy World",
    subtitle: "World 6 · Boing",
    introLine: "The ground is squishy. The walls are squishy. Even the air feels squishy.",
    cuboLine: "Bouncy! Hold JUMP when you land on a pink pad for extra bounce!",
    palette: pal("#fda4af", "#be123c", "#fb7185", "#9f1239", "#fecdd3", "#f43f5e", "#fff1f2"),
    flags: { bouncy: true },
    music: "bouncy",
    cameraMode: "side",
    rows: g.rows(),
    entities,
  };
}

/* ═══════════════ 7 · DANGER WORLD ═══════════════ */
function level7(): LevelDef {
  const g = new Grid(130, 18).walls().floor(1, 128);
  g.put(3, 15, "X").put(6, 15, "K");
  g.coins(12, 14, 3);
  g.fill(20, 15, 3, 1, "^");
  g.fill(26, 13, 3, 1, "=");
  g.fill(34, 15, 6, 1, "^");
  g.fill(46, 15, 2, 1, "^");
  g.fill(50, 13, 2, 3, "#");
  g.put(54, 15, "C");
  g.pit(60, 10);
  g.coins(62, 9, 6);
  g.fill(76, 15, 4, 1, "^");
  g.fill(82, 14, 2, 2, "B");
  g.put(92, 15, "C");
  g.fill(96, 9, 26, 9, "~");
  g.fill(96, 16, 26, 2, "#");
  g.fill(122, 10, 7, 8, "#");
  g.put(125, 7, "O");
  const entities: LevelEntity[] = [
    { kind: "sign", x: 8, y: 15, text: "Things bite here. Jump on heads, and never touch the spiky ones!" },
    { kind: "enemy", x: 14, y: 15, type: "walker", range: 3 },
    { kind: "enemy", x: 28, y: 15, type: "spiky", range: 3 },
    { kind: "enemy", x: 36, y: 10, type: "flyer", range: 4 },
    { kind: "enemy", x: 42, y: 15, type: "walker", range: 3 },
    { kind: "cage", x: 51, y: 12, friend: "lumen" },
    { kind: "mover", x: 60, y: 13, w: 3, dx: 7, dy: 0, speed: 90 },
    { kind: "enemy", x: 66, y: 8, type: "flyer", range: 3 },
    { kind: "enemy", x: 72, y: 15, type: "spiky", range: 2 },
    { kind: "cage", x: 85, y: 15, friend: "frosty" },
    { kind: "sign", x: 80, y: 15, text: "Frosty is behind those blocks. Free him for the FREEZE RAY." },
    { kind: "sign", x: 94, y: 15, text: "Deep water ahead. Swim across — or FREEZE it (C) and walk!" },
    { kind: "enemy", x: 104, y: 6, type: "flyer", range: 5 },
    { kind: "enemy", x: 114, y: 6, type: "flyer", range: 5 },
  ];
  return {
    id: 7,
    name: "Danger World",
    subtitle: "World 7 · Careful!",
    introLine: "Red sky. Growling noises. Every rock has teeth.",
    cuboLine: "Careful. Things bite here. Jump on their heads!",
    palette: pal("#7f1d1d", "#1c0a0a", "#78350f", "#451a03", "#fb923c", "#dc2626", "#fca5a5"),
    flags: {},
    music: "danger",
    cameraMode: "side",
    rows: g.rows(),
    entities,
  };
}

/* ═══════════════ 8 · CANDY WORLD ═══════════════ */
function level8(): LevelDef {
  const g = new Grid(120, 18).walls().floor(1, 118);
  g.put(3, 15, "X").put(6, 15, "K");
  g.fill(12, 16, 8, 1, "G");
  g.coins(12, 14, 8);
  g.fill(24, 13, 2, 3, "B");
  g.fill(30, 16, 10, 1, "G");
  g.fill(34, 13, 3, 1, "=").coins(34, 12, 3);
  g.fill(44, 15, 3, 1, "^");
  g.fill(50, 16, 6, 1, "G");
  g.put(60, 15, "C");
  g.fill(64, 13, 2, 3, "B");
  g.coins(68, 14, 4);
  g.fill(74, 16, 8, 1, "G");
  g.fill(84, 0, 1, 12, "#"); // arena gate (open at the bottom)
  g.fill(84, 12, 1, 4, "B");
  g.put(88, 15, "C");
  g.fill(90, 16, 28, 1, "G").fill(90, 16, 28, 1, "#");
  const entities: LevelEntity[] = [
    { kind: "sign", x: 8, y: 15, text: "Pink goo is sticky — you walk slow on it. Jump instead!" },
    { kind: "enemy", x: 16, y: 15, type: "walker", range: 3 },
    { kind: "enemy", x: 38, y: 10, type: "flyer", range: 3 },
    { kind: "cage", x: 40, y: 15, friend: "tock" },
    { kind: "enemy", x: 52, y: 15, type: "walker", range: 2 },
    { kind: "enemy", x: 70, y: 15, type: "spiky", range: 2 },
    { kind: "sign", x: 80, y: 15, text: "Bash through. Somebody in there is VERY protective of his candy." },
    { kind: "trigger", x: 92, y: 8, w: 1, h: 8, id: "boss-sultan" },
  ];
  return {
    id: 8,
    name: "Candy World",
    subtitle: "World 8 · Sweet & sticky",
    introLine: "Everything is candy. The ground is candy. The rocks are candy. Don't eat the walls.",
    cuboLine: "If somebody throws hard candy at you, I'll bat it right back!",
    palette: pal("#fbcfe8", "#db2777", "#f472b6", "#9d174d", "#fdf2f8", "#e879f9", "#fff"),
    flags: {},
    music: "candy",
    cameraMode: "side",
    rows: g.rows(),
    entities,
  };
}

/* ═══════════════ 9 · DARK & UPSIDE-DOWN ═══════════════ */
function level9(): LevelDef {
  const g = new Grid(120, 18).walls().floor(1, 118);
  g.put(3, 15, "X").put(6, 15, "K");
  g.coins(10, 14, 4);
  g.fill(16, 13, 3, 1, "=");
  g.pit(22, 3);
  g.coins(22, 12, 3);
  g.fill(30, 15, 3, 1, "^");
  g.fill(36, 13, 2, 3, "B");
  g.put(44, 15, "C");
  g.fill(50, 13, 4, 1, "=").coins(50, 12, 4);
  g.pit(58, 4);
  g.fill(59, 13, 2, 1, "=");
  g.fill(66, 15, 2, 1, "^");
  g.fill(70, 13, 2, 3, "B");
  g.put(80, 15, "C");
  g.fill(84, 0, 1, 12, "#");
  g.fill(84, 12, 1, 4, "B");
  g.fill(97, 13, 3, 1, "=").fill(103, 11, 3, 1, "=").fill(111, 13, 3, 1, "=");
  const entities: LevelEntity[] = [
    { kind: "sign", x: 8, y: 15, text: "It's dark, and everything is upside-down. Stay close to Cubo's glow!" },
    { kind: "enemy", x: 14, y: 15, type: "walker", range: 3 },
    { kind: "cage", x: 38, y: 15, friend: "bolt" },
    { kind: "enemy", x: 48, y: 15, type: "spiky", range: 3 },
    { kind: "enemy", x: 54, y: 9, type: "flyer", range: 3 },
    { kind: "cage", x: 72, y: 15, friend: "bam" },
    { kind: "sign", x: 76, y: 15, text: "Bam! Free him for MEGA PUNCH. Then bash through — something is whistling in there." },
    { kind: "trigger", x: 92, y: 8, w: 1, h: 8, id: "boss-whistler" },
  ];
  return {
    id: 9,
    name: "Dark & Upside-Down",
    subtitle: "World 9 · Which way is up?",
    introLine: "The lights are off and the floor is the ceiling. Or the ceiling is the floor. Hard to say.",
    cuboLine: "It's dark. Stay close to my glow. And, uh... don't look up. Or down.",
    palette: pal("#020617", "#0f172a", "#334155", "#1e293b", "#64748b", "#475569", "#e2e8f0"),
    flags: { dark: true, flipped: true },
    music: "dark",
    cameraMode: "side",
    rows: g.rows(),
    entities,
  };
}

/* ═══════════════ 10 · THE IN-BETWEEN ═══════════════ */
function level10(): LevelDef {
  const g = new Grid(140, 18).walls().floor(1, 138);
  g.put(3, 15, "X").put(6, 15, "K");
  g.coins(8, 14, 3);
  g.fill(44, 0, 1, 16, "#"); // loop area wall
  // in-between space
  g.fill(50, 13, 6, 1, "=").coins(50, 12, 6);
  g.fill(58, 11, 5, 1, "=");
  g.fill(66, 12, 12, 1, "#"); // Keeper's platform
  g.coins(68, 11, 8);
  // arena bash blocks
  g.fill(60, 15, 1, 1, "B").fill(84, 15, 1, 1, "B").fill(88, 15, 1, 1, "B").fill(92, 15, 1, 1, "B");
  g.fill(60, 14, 1, 1, "B").fill(92, 14, 1, 1, "B");
  g.put(96, 15, "C");
  g.fill(100, 0, 1, 16, "#");
  const entities: LevelEntity[] = [
    { kind: "sign", x: 9, y: 15, text: "These portals LOOP. Stand in one, wait for Cubo, then press UP together!" },
    { kind: "portal", x: 14, y: 15, id: "loop1" },
    { kind: "portal", x: 26, y: 15, id: "loop2" },
    { kind: "portal", x: 38, y: 15, id: "loop3" },
    { kind: "npc", x: 72, y: 11, who: "keeper", lines: [] },
    { kind: "trigger", x: 62, y: 6, w: 2, h: 10, id: "meet-keeper" },
  ];
  return {
    id: 10,
    name: "The In-Between",
    subtitle: "World 10 · Between everything",
    introLine: "The portals keep sending you back to the start. Somewhere in here is the one who makes them.",
    cuboLine: "These portals keep looping. We need to jump in at the EXACT same time.",
    palette: pal("#1e1b4b", "#020617", "#6d28d9", "#3b0764", "#c084fc", "#a855f7", "#f5d0fe"),
    flags: { finale: true },
    music: "finale",
    cameraMode: "side",
    rows: g.rows(),
    entities,
  };
}

export const LEVELS: LevelDef[] = [level1(), level2(), level3(), level4(), level5(), level6(), level7(), level8(), level9(), level10()];

export function getLevel(n: number): LevelDef {
  return LEVELS[Math.min(LEVELS.length, Math.max(1, n)) - 1];
}
