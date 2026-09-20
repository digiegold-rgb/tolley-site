/** 3D adaptations of the original Portal Hoppers world definitions and rescue order. */
import { LEVELS } from "../worlds/levels";
import type { FriendId } from "../engine/types";
export type Point = { x: number; y: number; z: number };
export type Platform = Point & {
  id: string;
  w: number;
  d: number;
  moving?: boolean;
  spring?: boolean;
  phase: number;
};
export type World3D = ReturnType<typeof buildWorld>;
export const THEMES = [
  {
    sky: "#8872d6",
    fog: "#b5a0eb",
    top: "#66dfcb",
    earth: "#645298",
    accent: "#ffc660",
    prop: "gear",
    tagline: "A tiny hero. A very big rescue.",
  },
  {
    sky: "#34257e",
    fog: "#6756af",
    top: "#bb95ff",
    earth: "#6951b2",
    accent: "#ffe79b",
    prop: "crystal",
    tagline: "Make a friend among the stars.",
  },
  {
    sky: "#718dec",
    fog: "#aacafa",
    top: "#a8edff",
    earth: "#767ac5",
    accent: "#ffce69",
    prop: "cloud",
    tagline: "A leap into the wonderful.",
  },
  {
    sky: "#48bde1",
    fog: "#8bdedb",
    top: "#72efca",
    earth: "#579cad",
    accent: "#ffb5d7",
    prop: "coral",
    tagline: "Dive into a sea of surprises.",
  },
  {
    sky: "#83bff0",
    fog: "#b9e8e9",
    top: "#a0ed87",
    earth: "#56896d",
    accent: "#ffc660",
    prop: "tree",
    tagline: "Where does this pipe go?",
  },
  {
    sky: "#ed95d7",
    fog: "#ffc2e5",
    top: "#ffe081",
    earth: "#c686c4",
    accent: "#6ff1da",
    prop: "mushroom",
    tagline: "The floor has a spring in its step.",
  },
  {
    sky: "#fcab82",
    fog: "#ffd3a2",
    top: "#c7e97a",
    earth: "#9b699b",
    accent: "#ff748c",
    prop: "mushroom",
    tagline: "Watch. Wait. Make your move.",
  },
  {
    sky: "#bd93ef",
    fog: "#f4bbea",
    top: "#ffb7d7",
    earth: "#b67be0",
    accent: "#fff09b",
    prop: "candy",
    tagline: "Sweet world. Tricky surprises.",
  },
  {
    sky: "#271a61",
    fog: "#6452a0",
    top: "#8e89e8",
    earth: "#484374",
    accent: "#b4ffed",
    prop: "crystal",
    tagline: "Stay close. Cubo knows the way.",
  },
  {
    sky: "#513086",
    fog: "#9871bf",
    top: "#cfa5f5",
    earth: "#7947aa",
    accent: "#ffd371",
    prop: "crystal",
    tagline: "One last hop. Everybody comes home.",
  },
] as const;
export function platformAt(p: Platform, time: number): Point {
  return {
    x: p.x + (p.moving ? Math.sin(time * 1.3 + p.phase) * 2.1 : 0),
    y: p.y,
    z: p.z,
  };
}
// Keep Cubo's personality, but translate directions for the 3D adaptation.
const CUBO_3D_HINTS: Record<number, string> = {
  3: "Steer toward the floating ledges as you fall. We can catch our breath on each island!",
  4: "I float above the water. You can swim! Tap JUMP to paddle up toward an island.",
  5: "Pipe express! Stand beside the first pipe and press E — or the Cubo / portal button — to take a shortcut.",
  8: "Watch the Sugar Sultan's glowing ring. Jump over it, then bash while the Sultan rests!",
  10: "One last rescue mission! Outsmart Captain Clank, wake the orb, and we'll all hop home together.",
};
export function buildWorld(n: number) {
  const source = LEVELS[Math.max(0, Math.min(9, n - 1))];
  const theme = THEMES[source.id - 1];
  const friends = source.entities
    .filter((e): e is Extract<typeof e, { kind: "cage" }> => e.kind === "cage")
    .map((e) => e.friend);
  const platforms: Platform[] = Array.from({ length: 13 }, (_, i) => ({
    id: `island-${i}`,
    x:
      i === 0 || i === 12
        ? 0
        : Math.sin(i * (source.id === 5 ? 1.45 : 0.95)) *
          (source.id === 7 ? 4.8 : 3.5),
    y:
      source.id === 3
        ? 18 - i * 1.3
        : i === 0 || i === 12
          ? 0
          : [0, 0.4, 1.1, 0.5][i % 4],
    z: 8 - i * (source.id === 6 ? 8 : 7.2),
    w: i === 0 ? 15 : i === 12 ? 17 : i % 4 === 0 ? 10 : 7.6,
    d: i === 0 ? 13 : i === 12 ? 14 : source.id === 6 ? 5.6 : 6.5,
    moving: i > 1 && i < 11 && (i === 6 || (source.id > 4 && i === 10)),
    spring: source.id === 6 && i > 0 && i < 11,
    phase: i * 1.7,
  }));
  const cages = friends.map((friend: FriendId, i) => {
    const index = friends.length === 1 ? 6 : 4 + i * 4;
    const p = platforms[index];
    // Rescue ledges branch out from the original route; Cubo/double jump offer choices.
    const side = i % 2 === 0 ? 1 : -1;
    const ledge: Platform = {
      id: `rescue-${friend}`,
      x: p.x + side * 6.2,
      y: p.y + 0.9,
      z: p.z - 1,
      w: 5,
      d: 5,
      phase: 0,
    };
    platforms.push(ledge);
    return { friend, x: ledge.x, y: ledge.y, z: ledge.z };
  });
  const coins = platforms
    .slice(1, 12)
    .flatMap((p, i) =>
      Array.from({ length: 3 }, (_, j) => ({
        id: `coin-${i}-${j}`,
        x: p.x + (j - 1) * 1.05,
        y: p.y + 0.9,
        z: p.z + 0.2,
      })),
    );
  const enemies = [3, 5, 8, 10].map((i, j) => {
    const p = platforms[i];
    return {
      id: `foe-${j}`,
      x: p.x,
      y: p.y,
      z: p.z,
      hp: source.id > 6 ? 3 : 2,
      homeX: p.x,
      homeZ: p.z,
      phase: "patrol" as "patrol" | "warn" | "dash" | "rest",
      timer: 1 + j * 0.3,
      dx: 0,
      dz: 0,
      stun: 0,
      flash: 0,
    };
  });
  const last = platforms[12];
  const orb = { x: last.x - 4, y: last.y + 1.3, z: last.z + 1 };
  const portal = { x: last.x, y: last.y, z: last.z - 3 };
  const boss =
    source.id === 8
      ? "sultan"
      : source.id === 9
        ? "whistler"
        : source.id === 10
          ? "clank"
          : null;
  return {
    id: source.id,
    name: source.name,
    intro: source.introLine,
    cuboLine: CUBO_3D_HINTS[source.id] ?? source.cuboLine,
    music: source.music,
    theme,
    platforms,
    cages,
    coins,
    enemies,
    orb,
    portal,
    boss,
    start: { x: 0, y: platforms[0].y, z: 11 },
    checkpoint: platforms[7],
    hazards: (source.id === 7 ? [3, 4, 5, 6, 8, 9, 10] : [3, 9])
      .map((i) => platforms[i])
      .map((p, i) => ({ x: p.x - 1.5, y: p.y, z: p.z + 1.5, phase: i * 2.1 })),
    pipes: source.id === 5 ? [{ ...platforms[2] }, { ...platforms[9] }] : [],
    stars: [
      {
        id: `star-${n}-1`,
        x: platforms[5].x - 2.6,
        y: platforms[5].y + 1,
        z: platforms[5].z - 1,
      },
      { id: `star-${n}-2`, x: last.x + 6, y: last.y + 1, z: last.z - 4 },
    ],
  };
}
