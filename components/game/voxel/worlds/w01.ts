/**
 * World 1 — Clank's Gadget Works. A foundry: molten-metal floor far below, steel decks on riveted pillars,
 * hazard stripes, smokestacks, spinning gears and Bolt-Bot patrols. Three switch-gated key rooms, Zippy's cage,
 * the Forge Foreman's boss hall and the portal vault. Feet-level coordinates: plaza top y=4, upper tier y=12,
 * sky ceiling 20.
 */
import { B } from "../types";
import { defineWorld } from "../grid";

/** Deterministic hash so the scattered slag never changes between loads. */
const hash = (x: number, z: number) => {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

export const W01 = defineWorld({
  id: 1,
  name: "Clank's Gadget Works",
  biome: "factory",
  size: [80, 24, 128],
  ceiling: 20,
  music: "factory",
  intro: "Captain Clank's foundry. Three keys open the vault — Zippy is locked up in here, and the Forge Foreman guards the way out.",
  cuboLine: "Somebody freed a friend? Clank won't like that.",
  build(g, w) {
    const S = B.solid,
      Y = B.solid2,
      T = B.trim,
      WL = B.wall,
      L = B.glow;
    const stripe = (x0: number, y: number, z0: number, x1: number, z1: number) => w.stripe(x0, y, z0, x1, z1, Y, WL);
    /* ── Foundry floor: a lake of molten metal with slag crust poking through. */
    g.box(0, 0, 0, 79, 0, 127, B.goo);
    for (let z = 0; z < 128; z++) for (let x = 0; x < 80; x++) if (hash(x, z) < 0.045) g.set(x, 0, z, WL);
    /* ── Factory walls east and west with glowing windows, a chimney in each corner. */
    for (const x0 of [0, 77]) {
      g.box(x0, 1, 0, x0 + 2, 15, 127, WL);
      for (let z = 4; z < 124; z += 8)
        for (const y of [5, 11]) {
          g.box(x0 + (x0 ? 0 : 2), y, z, x0 + (x0 ? 0 : 2), y + 1, z + 2, L);
        }
      stripe(x0, 16, 0, x0 + 2, 127);
    }
    for (const [x, z] of [
      [6, 10],
      [73, 30],
      [6, 70],
      [73, 100],
    ])
      w.prop("stack", x, 1, z, 0, 1);
    /* ── A. Start plaza (top y=4) with striped rim, conveyor belts and a high ledge hiding a star. */
    g.box(30, 0, 2, 49, 3, 17, S);
    w.pillarsUnder(30, 2, 49, 17, 0, WL, 6, 1);
    stripe(30, 3, 2, 49, 2);
    stripe(30, 3, 17, 49, 17);
    stripe(30, 3, 2, 30, 17);
    stripe(49, 3, 2, 49, 17);
    g.box(33, 3, 5, 34, 3, 15, B.conveyorS);
    g.box(45, 3, 5, 46, 3, 15, B.conveyorN);
    w.layer({
      y: 4,
      x0: 30,
      z0: 2,
      rows: [
        "....................",
        "....................",
        ".........X..........",
        "....................",
        "....$.$.$.$.$.$.$...",
        "....................",
        "....................",
        "....................",
        "....$.$.$.$.$.$.$...",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
        "....................",
      ],
    });
    w.sign(40, 4, 9, "Clank's Gadget Works. Find the 3 keys, free Zippy, then beat the Foreman. Hold Space to charge an Ultra Jump.");
    for (const x of [31, 37, 43, 48]) {
      w.prop("lamp", x, 4, 3);
      w.prop("lamp", x, 4, 16);
    }
    w.enemy("boltbot", 36, 4, 12, [[44, 4, 12]]);
    w.enemy("boltbot", 44, 4, 14, [[36, 4, 14]]);
    g.box(26, 0, 12, 28, 6, 14, Y); // star ledge: +3 from the plaza, Ultra Jump only
    w.pillarsUnder(26, 12, 28, 14, 0, WL, 6, 1);
    w.star(27, 7, 13);
    w.prop("gear", 25, 4, 13, Math.PI / 2, 1.4);
    /* ── B. Stepping platforms to the first switch (tops 4 → 5 → 6). */
    g.box(36, 0, 21, 43, 3, 26, S);
    g.box(30, 0, 30, 35, 4, 35, S);
    g.box(38, 0, 38, 45, 5, 44, S);
    w.pillarsUnder(36, 21, 43, 26, 0, WL, 7, 1);
    w.pillarsUnder(30, 30, 35, 35, 0, WL, 5, 1);
    w.pillarsUnder(38, 38, 45, 44, 0, WL, 7, 1);
    stripe(38, 5, 38, 45, 38);
    stripe(38, 5, 44, 45, 44);
    w.coin(39, 4, 23);
    w.coin(41, 4, 23);
    w.coin(32, 5, 32);
    w.coin(33, 5, 33);
    w.hopper(33, 5, 34);
    w.switch(41, 6, 43, "s1");
    w.sign(43, 6, 40, "Lever 1 opens the west workshop. Press E to pull it.");
    w.enemy("boltbot", 39, 6, 40, [[44, 6, 40]]);
    w.prop("vent", 44, 6, 42);
    w.prop("lamp", 38, 6, 39);
    /* Key room 1 (west workshop): walkway, sealed room, crumble floor strip, key pedestal. */
    g.box(25, 0, 41, 37, 5, 44, S);
    w.pillarsUnder(25, 41, 37, 44, 0, WL, 6, 1);
    g.room(10, 5, 36, 24, 13, 50, WL, S);
    w.pillarsUnder(10, 36, 24, 50, 5, WL, 7, 1);
    g.box(17, 5, 37, 19, 5, 49, B.crumble);
    g.box(13, 6, 43, 15, 6, 45, Y);
    w.key(14, 7, 44);
    w.coin(21, 6, 39);
    w.coin(21, 6, 47);
    w.coin(12, 6, 39);
    w.coin(12, 6, 47);
    w.doorBox("d1", 24, 6, 42, 24, 8, 43);
    w.door({ id: "d1", switchId: "s1" });
    w.enemy("boltbot", 22, 6, 38, [[13, 6, 38]]);
    w.enemy("boltbot", 12, 6, 48, [[22, 6, 48]]);
    for (let z = 38; z <= 48; z += 5) g.box(10, 7, z, 10, 8, z + 1, L); // workshop windows
    w.prop("gear", 9, 9, 43, Math.PI / 2, 2.2);
    w.prop("gear", 17, 14, 36, 0, 1.6);
    w.prop("gear", 20, 14, 36, 0, 1.1);
    w.prop("lamp", 11, 6, 37);
    w.prop("lamp", 23, 6, 49);
    /* ── C. Climb to the upper tier (top 12): platform, stairs, big deck with the first checkpoint and a gantry crane. */
    g.box(46, 0, 47, 52, 6, 52, S);
    w.pillarsUnder(46, 47, 52, 52, 0, WL, 6, 1);
    g.stairs(47, 7, 54, "z", 5, 4, S);
    g.box(46, 0, 59, 56, 11, 68, S);
    w.pillarsUnder(46, 59, 56, 68, 0, WL, 5, 1);
    stripe(46, 11, 59, 56, 59);
    stripe(46, 11, 68, 56, 68);
    stripe(56, 11, 59, 56, 68);
    g.box(45, 12, 60, 45, 18, 60, T);
    g.box(57, 12, 60, 57, 18, 60, T);
    g.box(45, 18, 60, 57, 18, 60, T);
    w.prop("crane", 51, 18, 60, 0, 1);
    w.checkpoint(51, 12, 61);
    w.coin(49, 7, 50);
    w.coin(49, 12, 65);
    w.coin(53, 12, 65);
    w.hopper(47, 12, 66);
    w.enemy("boltbot", 48, 12, 67, [[55, 12, 67]]);
    w.prop("lamp", 47, 12, 60);
    w.prop("lamp", 55, 12, 67);
    /* Pipe run east of the climb, elbowing up to the deck. */
    g.box(60, 6, 24, 61, 7, 58, T);
    g.box(60, 6, 24, 61, 7, 25, WL);
    g.box(60, 8, 57, 61, 10, 58, T);
    g.box(58, 9, 57, 61, 10, 58, T);
    w.prop("vent", 60, 8, 40);
    /* Zippy's cage room (east), behind the second lever. */
    g.box(57, 0, 62, 59, 11, 65, S);
    w.pillarsUnder(57, 62, 59, 65, 0, WL, 6, 1);
    g.room(60, 11, 58, 72, 19, 70, WL, S);
    w.pillarsUnder(60, 58, 72, 70, 0, WL, 6, 1);
    w.doorBox("dc", 60, 12, 63, 60, 14, 64);
    w.switch(58, 12, 63, "sc");
    w.door({ id: "dc", switchId: "sc" });
    w.entity({ kind: "cage", friend: "zippy", at: { x: 66.5, y: 12, z: 64.5 } });
    w.coin(63, 12, 61);
    w.coin(69, 12, 61);
    w.coin(63, 12, 67);
    w.coin(69, 12, 67);
    for (const z of [60, 67]) g.box(72, 14, z, 72, 15, z + 1, L);
    w.prop("gear", 73, 15, 64, Math.PI / 2, 2.4);
    w.prop("gear", 66, 20, 58, 0, 1.8);
    w.prop("lamp", 61, 12, 59);
    w.prop("lamp", 71, 12, 69);
    /* ── D. Tower with key 2 (east walkway, west sealed tower room with inside stairs). */
    g.box(40, 0, 71, 48, 11, 76, S);
    w.pillarsUnder(40, 71, 48, 76, 0, WL, 8, 1);
    g.box(30, 0, 79, 48, 11, 89, S);
    w.pillarsUnder(30, 79, 48, 89, 0, WL, 6, 1);
    stripe(41, 12, 79, 48, 79);
    stripe(41, 12, 89, 48, 89);
    g.room(30, 12, 79, 40, 19, 89, WL, S);
    g.stairs(31, 13, 86, "-z", 4, 3, S);
    w.key(32, 17, 83);
    w.doorBox("d2", 40, 13, 83, 40, 15, 84);
    w.switch(43, 12, 83, "s2");
    w.door({ id: "d2", switchId: "s2" });
    w.sign(44, 12, 80, "Lever 2 opens the tower. The key is at the top of the inside stairs.");
    w.coin(44, 12, 73);
    w.coin(36, 13, 87);
    w.coin(38, 13, 81);
    w.enemy("boltbot", 42, 12, 73, [[47, 12, 75]]);
    w.enemy("boltbot", 44, 12, 81, [[44, 12, 88]]);
    for (const z of [81, 86]) g.box(29, 14, z, 29, 15, z + 1, L);
    w.prop("gear", 29, 16, 84, Math.PI / 2, 1.8);
    w.prop("gear", 35, 20, 79, 0, 1.4);
    w.prop("lamp", 41, 12, 72);
    w.prop("lamp", 47, 12, 88);
    /* Key 3: the basement under the next platform, entered from a low side ledge behind lever 3. */
    g.box(42, 0, 91, 50, 11, 97, S);
    w.pillarsUnder(42, 91, 50, 97, 0, WL, 8, 1);
    g.room(42, 4, 91, 50, 11, 97, WL, S);
    g.box(45, 5, 92, 46, 5, 96, B.spike);
    w.key(44, 5, 94);
    g.box(51, 0, 92, 55, 4, 95, S);
    w.pillarsUnder(51, 92, 55, 95, 0, WL, 4, 1);
    w.doorBox("d3", 50, 5, 93, 50, 7, 94);
    w.switch(53, 5, 93, "s3");
    w.door({ id: "d3", switchId: "s3" });
    w.sign(47, 12, 96, "The last key is below. Drop to the east ledge and pull lever 3.");
    w.coin(48, 5, 93);
    w.coin(48, 5, 95);
    g.stairs(56, 5, 96, "z", 7, 3, S);
    g.box(36, 0, 103, 60, 11, 106, S);
    w.pillarsUnder(36, 103, 60, 106, 0, WL, 6, 1);
    stripe(36, 11, 103, 60, 103);
    w.checkpoint(48, 12, 104);
    w.hopper(57, 12, 104);
    w.coin(42, 12, 104);
    w.coin(54, 12, 104);
    w.enemy("boltbot", 38, 12, 105, [[46, 12, 105]]);
    w.enemy("boltbot", 58, 12, 104, [[50, 12, 104]]);
    w.prop("vent", 44, 12, 106);
    w.prop("vent", 52, 12, 106);
    w.prop("lamp", 37, 12, 104);
    w.prop("lamp", 59, 12, 105);
    /* ── E. Boss hall (opens with three keys) and the portal vault (opens when the Foreman falls). */
    g.room(28, 11, 108, 52, 19, 120, WL, S);
    w.pillarsUnder(28, 108, 52, 120, 0, WL, 6, 1);
    g.room(34, 11, 120, 46, 19, 127, WL, S);
    w.pillarsUnder(34, 120, 46, 127, 0, WL, 6, 1);
    w.stripe(29, 11, 109, 51, 109, Y, WL);
    w.stripe(29, 11, 119, 51, 119, Y, WL);
    w.stripe(29, 11, 110, 29, 118, Y, WL);
    w.stripe(51, 11, 110, 51, 118, Y, WL);
    w.doorBox("db", 39, 12, 108, 41, 14, 108);
    w.door({ id: "db", needsKeys: 3 });
    w.doorBox("dp", 39, 12, 120, 41, 14, 120);
    w.door({ id: "dp", boss: true });
    w.boss("foreman", 40, 12, 116, { x0: 29, z0: 109, x1: 51, z1: 119, y: 12 });
    w.sign(40, 12, 106, "Boss hall: three keys open the door. Dodge the Foreman's charge, then bash the red button on his back.");
    w.layer({ y: 12, x0: 35, z0: 121, rows: ["...........", "...........", "...........", ".....P.....", "..........."] });
    w.coin(32, 12, 114);
    w.coin(48, 12, 114);
    for (const x of [30, 50]) for (const z of [111, 117]) w.prop("lamp", x, 12, z);
    for (const z of [111, 116]) {
      g.box(28, 14, z, 28, 15, z + 1, L);
      g.box(52, 14, z, 52, 15, z + 1, L);
    }
    w.prop("gear", 27, 15, 114, Math.PI / 2, 2.6);
    w.prop("gear", 53, 15, 114, Math.PI / 2, 2.6);
    w.prop("gear", 40, 21, 124, 0, 3);
    w.prop("stack", 20, 1, 118, 0, 1);
    w.prop("stack", 60, 1, 122, 0, 1);
  },
  route: [
    { x: 40.5, y: 4, z: 5.5 },
    { x: 40.5, y: 4, z: 15.5 },
    { x: 39.5, y: 4, z: 23.5 },
    { x: 32.5, y: 5, z: 32.5 },
    { x: 41.5, y: 6, z: 41.5 },
    { x: 41.5, y: 6, z: 43.5 },
    { x: 31.5, y: 6, z: 42.5 },
    { x: 22.5, y: 6, z: 42.5 },
    { x: 14.5, y: 7, z: 44.5 },
    { x: 22.5, y: 6, z: 42.5 },
    { x: 31.5, y: 6, z: 42.5 },
    { x: 43.5, y: 6, z: 42.5 },
    { x: 49.5, y: 7, z: 50.5 },
    { x: 49.5, y: 8, z: 54.5 },
    { x: 49.5, y: 12, z: 58.5 },
    { x: 51.5, y: 12, z: 61.5 },
    { x: 58.5, y: 12, z: 63.5 },
    { x: 66.5, y: 12, z: 64.5 },
    { x: 52.5, y: 12, z: 64.5 },
    { x: 44.5, y: 12, z: 74.5 },
    { x: 44.5, y: 12, z: 81.5 },
    { x: 43.5, y: 12, z: 83.5 },
    { x: 37.5, y: 13, z: 83.5 },
    { x: 32.5, y: 13, z: 88.5 },
    { x: 32.5, y: 17, z: 83.5 },
    { x: 32.5, y: 13, z: 88.5 },
    { x: 37.5, y: 13, z: 83.5 },
    { x: 42.5, y: 12, z: 83.5 },
    { x: 44.5, y: 12, z: 87.5 },
    { x: 46.5, y: 12, z: 93.5 },
    { x: 53.5, y: 5, z: 93.5 },
    { x: 47.5, y: 5, z: 94.5 },
    { x: 44.5, y: 5, z: 94.5 },
    { x: 47.5, y: 5, z: 93.5 },
    { x: 51.5, y: 5, z: 93.5 },
    { x: 54.5, y: 5, z: 95.5 },
    { x: 57.5, y: 6, z: 96.5 },
    { x: 57.5, y: 12, z: 102.5 },
    { x: 50.5, y: 12, z: 104.5 },
    { x: 40.5, y: 12, z: 105.5 },
    { x: 40.5, y: 12, z: 112.5 },
    { x: 40.5, y: 12, z: 118.5 },
    { x: 40.5, y: 12, z: 124.5 },
  ],
});
