import { test } from "node:test";
import assert from "node:assert/strict";
import { VoxelGame, emptyControls, newSave } from "./model";
import { readSave } from "./save";
import { B, PHYS } from "./types";

const run = (g: VoxelGame, seconds: number, c = emptyControls()) => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    g.tick(1 / 60, c);
    c.jump = false;
    c.bash = false;
    c.interact = false;
    c.lift = false;
  }
};
const fresh = () => {
  const g = new VoxelGame(newSave());
  g.start();
  return g;
};

test("save v3 sanitizes malformed state and ignores the old 3D save", () => {
  assert.equal(readSave("{oops"), null);
  assert.equal(readSave('{"version":2,"hero":"fox"}'), null);
  const s = readSave(
    JSON.stringify({ version: 3, world: 99, hero: "bad", rescued: ["zippy", "zippy", "nope"], keys: ["key-1", "key-9"], settings: { music: 4, look: "weird", sensitivity: 100 }, sparks: 9, coins: -2 }),
  );
  assert.equal(s?.world, 10);
  assert.equal(s?.hero, "frog");
  assert.deepEqual(s?.rescued, ["zippy"]);
  assert.deepEqual(s?.keys, ["key-1"]);
  assert.equal(s?.settings.music, 1);
  assert.equal(s?.settings.look, "lock");
  assert.equal(s?.settings.sensitivity, 3);
  assert.equal(s?.sparks, 3);
  assert.equal(s?.coins, 0);
});

test("a jump rises about two blocks, an Ultra Jump about three and a half, and lands cleanly", () => {
  const g = fresh();
  const y0 = g.position.y;
  g.tick(1 / 60, { ...emptyControls(), jump: true });
  let peak = y0;
  for (let i = 0; i < 90; i++) {
    g.tick(1 / 60, emptyControls());
    peak = Math.max(peak, g.position.y);
  }
  assert.ok(peak - y0 > 1.85 && peak - y0 < 2.15, `jump apex ${peak - y0}`);
  assert.equal(g.grounded, true);
  assert.equal(g.position.y, y0);
  // Ultra: hold still for half a second, release.
  run(g, 0.7, { ...emptyControls(), jump: true, heldJump: true });
  g.tick(1 / 60, emptyControls());
  peak = y0;
  for (let i = 0; i < 120; i++) {
    g.tick(1 / 60, emptyControls());
    peak = Math.max(peak, g.position.y);
  }
  assert.ok(peak - y0 > 3.4 && peak - y0 < 3.8, `ultra apex ${peak - y0}`);
});

test("walking into a one-block ledge steps up; a two-block wall stops you", () => {
  const g = fresh();
  g.grid.box(30, 4, 8, 49, 4, 12, B.solid); // one-block-high step across the plaza, z 8..12
  g.position = { x: 40.5, y: 4, z: 6.5 };
  run(g, 0.4, { ...emptyControls(), z: 1 });
  assert.equal(g.position.y, 5);
  assert.ok(g.position.z > 8.5 && g.position.z < 12);
  g.grid.box(30, 5, 13, 49, 6, 13, B.solid); // two high from the step
  run(g, 0.8, { ...emptyControls(), z: 1 });
  assert.equal(g.position.y, 5);
  assert.ok(g.position.z < 12.7);
});

test("switches open their doors, keys count toward the vault, and the portal stays shut until everything is done", () => {
  const g = fresh();
  const d1 = g.def.doors.find((d) => d.id === "d1")!;
  assert.equal(g.grid.get(d1.cells[0].x, d1.cells[0].y, d1.cells[0].z), B.door);
  g.position = { x: 41.5, y: 6, z: 42.5 };
  g.tick(1 / 60, { ...emptyControls(), interact: true });
  assert.ok(g.switches.has("s1"));
  assert.equal(g.grid.get(d1.cells[0].x, d1.cells[0].y, d1.cells[0].z), B.air);
  // Rescue Zippy by bashing the cage the full count, then grab keys by walking onto them.
  const cage = g.cages[0];
  assert.equal(cage.max, 8, "Super Hopper cages take eight hits");
  g.position = { ...cage.at, x: cage.at.x - 1 };
  g.yaw = Math.atan2(1, 0);
  for (let i = 0; i < 8; i++) {
    g.attackCooldown = 0;
    g.bash();
  }
  assert.equal(g.rescue, "zippy");
  assert.equal(g.has("doubleJump"), true);
  g.resume();
  assert.equal(g.portalOpen, false);
  for (const k of g.entities("key")) {
    g.position = { ...k.at };
    g.tick(1 / 60, emptyControls());
  }
  assert.equal(g.keys.length, 3);
  assert.equal(g.portalOpen, true);
  const dp = g.def.doors.find((d) => d.id === "dp")!;
  assert.equal(g.grid.get(dp.cells[0].x, dp.cells[0].y, dp.cells[0].z), B.door);
  g.position = { x: 40.5, y: 12, z: 118.5 };
  g.tick(1 / 60, emptyControls());
  assert.equal(g.grid.get(dp.cells[0].x, dp.cells[0].y, dp.cells[0].z), B.air);
  assert.equal(g.interact(), false, "must stand at the portal");
  g.position = { ...g.def.portal };
  assert.equal(g.interact(), true);
  assert.equal(g.saveData.finished, true, "only world 1 exists yet, so the run ends here");
});

test("crumble blocks fall after standing on them and grow back; bounce and spikes behave", () => {
  const g = fresh();
  g.position = { x: 18.5, y: 6, z: 43.5 }; // crumble strip in the west workshop
  run(g, 0.2);
  assert.equal(g.grounded, true);
  assert.equal(g.groundBlock, B.crumble);
  run(g, 0.7);
  assert.equal(g.grid.get(18, 5, 43), B.air);
  assert.ok(g.position.y < 5.5, "hero fell through");
  g.position = { x: 40.5, y: 4, z: 5.5 };
  g.velocity.y = 0;
  run(g, 7);
  assert.equal(g.grid.get(18, 5, 43), B.crumble, "block regrew");
  // Bounce block.
  g.grid.set(40, 3, 5, B.bounce);
  g.position = { x: 40.5, y: 4.3, z: 5.5 };
  let launched = -99;
  for (let i = 0; i < 30; i++) {
    g.tick(1 / 60, emptyControls());
    launched = Math.max(launched, g.velocity.y);
  }
  assert.ok(launched > 10, `bounce launched ${launched}`);
  // Spikes hurt once per i-frame window.
  g.position = { x: 45.5, y: 5, z: 94.5 };
  g.velocity.y = 0;
  const hearts = g.hearts;
  run(g, 0.1);
  assert.equal(g.hearts, hearts - 1);
});

test("the sky ceiling stops flight and falling off the world returns you to the checkpoint", () => {
  const g = fresh();
  g.position.y = 30;
  g.tick(1 / 60, emptyControls());
  assert.ok(g.position.y <= g.def.ceiling - 1.5);
  g.position = { x: 40.5, y: 4, z: 15.5 };
  g.checkpoint = { x: 40.5, y: 4, z: 5.5 };
  g.position.y = -20;
  g.tick(1 / 60, emptyControls());
  assert.deepEqual(g.position, { x: 40.5, y: 4, z: 5.5 });
});

test("you can stand on Cubo, and his lift carries you four blocks up then sets you down", () => {
  const g = fresh();
  g.cuboJoined = true;
  g.placeCubo();
  g.cubo.x = 44.5;
  g.cubo.z = 10.5;
  g.cubo.y = 4;
  g.position = { x: 44.5, y: 6, z: 10.5 };
  run(g, 0.5);
  assert.equal(g.grounded, true);
  assert.ok(Math.abs(g.position.y - 5.2) < 0.01, `standing on Cubo at ${g.position.y}`);
  g.position = { x: 40.5, y: 4, z: 12.5 };
  run(g, 0.3);
  assert.equal(g.liftUp(), true);
  run(g, 1.2);
  assert.ok(Math.abs(g.position.y - (4 + 1.2 + PHYS.liftHeight)) < 0.05, `lifted to ${g.position.y}`);
  run(g, 3.5);
  assert.ok(g.position.y < 6, `back down at ${g.position.y}`);
  assert.equal(g.liftUp(), false, "cooldown");
});

test("glide is a stamina budget, not free flight", () => {
  const g = fresh();
  g.saveData.rescued.push("flutter");
  g.position = { x: 40.5, y: 18, z: 10.5 };
  g.velocity.y = 0;
  const c = { ...emptyControls(), heldJump: true };
  run(g, 1, c);
  assert.ok(g.velocity.y >= PHYS.glideFall - 0.01, `gliding ${g.velocity.y}`);
  run(g, 2, c);
  assert.ok(g.velocity.y < PHYS.glideFall - 3, `stamina spent, falling ${g.velocity.y}`);
});
