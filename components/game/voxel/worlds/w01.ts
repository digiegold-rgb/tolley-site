/**
 * World 1 — Clank's Gadget Works. Steel and safety-yellow. Three switch-gated key rooms, Zippy's cage,
 * a boss hall and the portal vault. Feet-level coordinates: plaza top y=4, upper tier y=12, sky ceiling 20.
 */
import { B } from "../types";
import { defineWorld } from "../grid";

export const W01 = defineWorld({
  id: 1,
  name: "Clank's Gadget Works",
  biome: "factory",
  size: [80, 24, 128],
  ceiling: 20,
  music: "factory",
  intro: "Captain Clank's factory. Three keys open the vault — and Zippy is locked up somewhere in here.",
  cuboLine: "Somebody freed a friend? Clank won't like that.",
  build(g, w) {
    const S = B.solid,
      Y = B.solid2,
      T = B.trim,
      WL = B.wall;
    // A. Start plaza (top y=4) with a rim and a high ledge hiding a star.
    g.box(30, 0, 2, 49, 3, 17, S);
    g.box(30, 3, 2, 49, 3, 2, T);
    g.box(30, 3, 17, 49, 3, 17, T);
    g.box(30, 3, 2, 30, 3, 17, T);
    g.box(49, 3, 2, 49, 3, 17, T);
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
    w.sign(40, 4, 9, "Clank's Gadget Works. Find the 3 keys, free Zippy, then open the vault. Hold Space to charge an Ultra Jump.");
    g.box(26, 0, 12, 28, 6, 14, Y); // star ledge: +3 from the plaza, Ultra Jump only
    w.star(27, 7, 13);
    // B. Stepping platforms to the first switch (tops 4 → 5 → 6).
    g.box(36, 0, 21, 43, 3, 26, S);
    g.box(30, 0, 30, 35, 4, 35, S);
    g.box(38, 0, 38, 45, 5, 44, S);
    g.box(38, 5, 38, 45, 5, 38, T);
    w.coin(39, 4, 23);
    w.coin(41, 4, 23);
    w.coin(32, 5, 32);
    w.coin(33, 5, 33);
    w.hopper(33, 5, 34);
    w.switch(41, 6, 43, "s1");
    w.sign(43, 6, 40, "Lever 1 opens the west workshop. Press E to pull it.");
    // Key room 1 (west workshop): walkway, sealed room, crumble floor strip, key pedestal.
    g.box(25, 0, 41, 37, 5, 44, S);
    g.room(10, 5, 36, 24, 13, 50, WL, S);
    g.box(17, 5, 37, 19, 5, 49, B.crumble);
    g.box(13, 6, 43, 15, 6, 45, Y);
    w.key(14, 7, 44);
    w.coin(21, 6, 39);
    w.coin(21, 6, 47);
    w.coin(12, 6, 39);
    w.coin(12, 6, 47);
    w.doorBox("d1", 24, 6, 42, 24, 8, 43);
    w.door({ id: "d1", switchId: "s1" });
    // C. Climb to the upper tier (top 12): platform, stairs, big deck with the first checkpoint.
    g.box(46, 0, 47, 52, 6, 52, S);
    g.stairs(47, 7, 54, "z", 5, 4, S);
    g.box(46, 0, 59, 56, 11, 68, S);
    g.box(46, 11, 59, 56, 11, 59, T);
    w.checkpoint(51, 12, 61);
    w.coin(49, 7, 50);
    w.coin(49, 12, 65);
    w.coin(53, 12, 65);
    w.hopper(47, 12, 66);
    // Zippy's cage room (east), behind the second lever.
    g.box(57, 0, 62, 59, 11, 65, S);
    g.room(60, 11, 58, 72, 19, 70, WL, S);
    w.doorBox("dc", 60, 12, 63, 60, 14, 64);
    w.switch(58, 12, 63, "sc");
    w.door({ id: "dc", switchId: "sc" });
    w.entity({ kind: "cage", friend: "zippy", at: { x: 66.5, y: 12, z: 64.5 } });
    w.coin(63, 12, 61);
    w.coin(69, 12, 61);
    w.coin(63, 12, 67);
    w.coin(69, 12, 67);
    // D. Tower with key 2 (east walkway, west sealed tower room with inside stairs).
    g.box(40, 0, 71, 48, 11, 76, S);
    g.box(30, 0, 79, 48, 11, 89, S);
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
    // Key 3: the basement under the next platform, entered from a low side ledge behind lever 3.
    g.box(42, 0, 91, 50, 11, 97, S);
    g.room(42, 4, 91, 50, 11, 97, WL, S);
    g.box(45, 5, 92, 46, 5, 96, B.spike);
    w.key(44, 5, 94);
    g.box(51, 0, 92, 55, 4, 95, S);
    w.doorBox("d3", 50, 5, 93, 50, 7, 94);
    w.switch(53, 5, 93, "s3");
    w.door({ id: "d3", switchId: "s3" });
    w.sign(47, 12, 96, "The last key is below. Drop to the east ledge and pull lever 3.");
    w.coin(48, 5, 93);
    w.coin(48, 5, 95);
    g.stairs(56, 5, 96, "z", 7, 3, S);
    g.box(36, 0, 103, 60, 11, 106, S);
    w.checkpoint(48, 12, 104);
    w.hopper(57, 12, 104);
    w.coin(42, 12, 104);
    w.coin(54, 12, 104);
    // E. Boss hall and the portal vault (3 keys).
    g.room(28, 11, 108, 52, 19, 120, WL, S);
    g.room(34, 11, 120, 46, 19, 127, WL, S);
    w.doorBox("db", 39, 12, 108, 41, 14, 108);
    w.door({ id: "db", boss: true });
    w.doorBox("dp", 39, 12, 120, 41, 14, 120);
    w.door({ id: "dp", needsKeys: 3 });
    w.sign(40, 12, 110, "The vault needs all three keys.");
    w.layer({ y: 12, x0: 35, z0: 121, rows: ["...........", "...........", "...........", ".....P.....", "..........."] });
    w.coin(32, 12, 114);
    w.coin(48, 12, 114);
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
