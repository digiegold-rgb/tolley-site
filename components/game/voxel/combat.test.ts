/** Bolt-Bots and the Forge Foreman: patrols, bashing, stomping, the charge→crash→button loop, batted gears, the vault. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { VoxelGame, emptyControls, newSave } from "./model";
import { B, BOSSES } from "./types";

const run = (g: VoxelGame, seconds: number, c = emptyControls()) => {
  for (let t = 0; t < seconds; t += 1 / 60) g.tick(1 / 60, c);
};
const until = (g: VoxelGame, cond: () => boolean, max = 6) => {
  for (let t = 0; t < max; t += 1 / 60) {
    g.tick(1 / 60, emptyControls());
    if (cond()) return true;
  }
  return false;
};
const fresh = () => {
  const g = new VoxelGame(newSave());
  g.start();
  g.invulnerable = Infinity; // combat tests measure the enemies, not the hero's hearts
  return g;
};

test("a Bolt-Bot patrols its path, turns around at the end, and chases when you come close", () => {
  const g = fresh();
  g.position = { x: 40.5, y: 12, z: 65.5 }; // far from the plaza bots
  const bot = g.enemies[0];
  const x0 = bot.at.x;
  run(g, 1);
  assert.ok(bot.at.x > x0 + 1, `walked east from ${x0} to ${bot.at.x}`);
  assert.equal(bot.at.y, 4, "stays on the plaza floor");
  run(g, 6);
  assert.ok(bot.at.x < 44.5 + 0.3, "never leaves the path");
  assert.ok(bot.at.x > 36 && bot.at.x < 45, "turned back along the path");
  g.position = { x: bot.at.x + 3, y: 4, z: bot.at.z };
  const d0 = Math.hypot(bot.at.x - g.position.x, bot.at.z - g.position.z);
  run(g, 0.5);
  assert.ok(Math.hypot(bot.at.x - g.position.x, bot.at.z - g.position.z) < d0, "closed in on the hero");
});

test("bashing a Bolt-Bot three times scraps it; a stomp counts double", () => {
  const g = fresh();
  const bot = g.enemies[0];
  assert.equal(bot.hp, 3);
  g.position = { x: bot.at.x - 1, y: 4, z: bot.at.z };
  g.yaw = Math.atan2(1, 0);
  for (let i = 0; i < 3; i++) {
    g.attackCooldown = 0;
    g.bash();
  }
  assert.equal(bot.dead, true);
  const coins = g.saveData.coins;
  assert.ok(coins >= 2, "scrap pays coins");
  const other = g.enemies[1];
  g.position = { x: other.at.x, y: other.at.y + 1.2, z: other.at.z };
  g.velocity = { x: 0, y: -8, z: 0 };
  g.tick(1 / 60, emptyControls());
  assert.equal(other.hp, 1, "stomp took two");
  assert.ok(g.velocity.y > 5, "bounced off its head");
});

test("the Foreman wakes in his hall, charges, crashes, and only the glowing button takes real damage", () => {
  const g = fresh();
  const b = g.boss!;
  assert.equal(b.state, "sleep");
  assert.equal(b.max, Math.round(BOSSES.foreman.hp * 1.25), "Super Hopper boss HP");
  g.position = { x: 40.5, y: 12, z: 112.5 };
  g.tick(1 / 60, emptyControls());
  assert.equal(b.state, "idle");
  assert.equal(g.bossAwake, true);
  assert.ok(until(g, () => b.state === "charge", 3), "charged");
  const before = { ...b.at };
  assert.ok(until(g, () => b.state === "stagger", 4), "crashed into a wall");
  assert.ok(Math.hypot(b.at.x - before.x, b.at.z - before.z) > 2, "actually moved");
  assert.ok(b.at.x > 29 && b.at.x < 52 && b.at.z > 109 && b.at.z < 120, "stayed inside the arena");
  // Bash the button while he is dazed.
  g.position = { x: b.at.x - Math.sin(b.yaw) * 2, y: 12, z: b.at.z - Math.cos(b.yaw) * 2 };
  g.yaw = b.yaw;
  g.attackCooldown = 0;
  g.bash();
  assert.equal(b.hp, b.max - 4);
  // Armor the rest of the time.
  assert.ok(until(g, () => b.state === "idle", 4));
  g.position = { x: b.at.x - Math.sin(b.yaw) * 2, y: 12, z: b.at.z - Math.cos(b.yaw) * 2 };
  g.attackCooldown = 0;
  g.bash();
  assert.equal(b.hp, b.max - 4, "no damage through the armor");
});

test("from phase two he throws gears; batting one back does six and staggers him; the vault opens when he falls", () => {
  const g = fresh();
  const b = g.boss!;
  g.position = { x: 40.5, y: 12, z: 112.5 };
  g.tick(1 / 60, emptyControls());
  b.hp = Math.floor(b.max * 0.6);
  assert.ok(until(g, () => b.state === "stagger", 8), "crashed");
  assert.equal(b.phase, 2);
  assert.ok(g.projectiles.length >= 1, "threw a gear");
  const gear = g.projectiles[0];
  assert.equal(gear.owner, "boss");
  // Step in front of the gear and bat it.
  g.position = { x: gear.x - gear.vx * 0.05, y: gear.y - 1, z: gear.z - gear.vz * 0.05 };
  g.yaw = Math.atan2(gear.vx, gear.vz);
  g.attackCooldown = 0;
  g.bash();
  assert.equal(gear.owner, "hero", "batted");
  const hp = b.hp;
  assert.ok(until(g, () => b.hp < hp, 3), "gear hit the boss");
  assert.equal(b.hp, hp - 6);
  assert.equal(b.state, "stagger");
  // Finish him: the vault door opens and the save remembers.
  b.hp = 1;
  g.position = { x: b.at.x - Math.sin(b.yaw) * 2, y: 12, z: b.at.z - Math.cos(b.yaw) * 2 };
  g.yaw = b.yaw;
  g.attackCooldown = 0;
  g.bash();
  assert.equal(b.state, "dead");
  assert.equal(g.bossHP, 0);
  assert.equal(g.saveData.bossDown, true);
  const dp = g.def.doors.find((d) => d.id === "dp")!;
  g.tick(1 / 60, emptyControls());
  assert.equal(g.grid.get(dp.cells[0].x, dp.cells[0].y, dp.cells[0].z), B.air);
  const again = new VoxelGame(g.saveData);
  assert.equal(again.boss?.state, "dead");
  assert.equal(again.grid.get(dp.cells[0].x, dp.cells[0].y, dp.cells[0].z), B.air, "vault stays open after a reload");
});

test("falling to the checkpoint mid-fight sends the Foreman back to sleep with some health back", () => {
  const g = fresh();
  const b = g.boss!;
  g.position = { x: 40.5, y: 12, z: 112.5 };
  g.tick(1 / 60, emptyControls());
  b.hp = 10;
  g.resetCheckpoint();
  assert.equal(b.state, "sleep");
  assert.ok(b.hp > 10 && b.hp <= b.max);
  assert.equal(g.projectiles.length, 0);
});
