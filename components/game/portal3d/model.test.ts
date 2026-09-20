import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PortalGame, newSave, readSave, emptyControls } from "./model";
import { buildWorld, platformAt } from "./worlds";
import { LEVELS } from "../worlds/levels";
import { FRIENDS } from "../worlds/friends";
function run(g: PortalGame, seconds: number, controls = emptyControls()) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    g.tick(1 / 60, controls);
    controls.jump = false;
    controls.bash = false;
  }
}
test("all ten worlds reuse the original rescue cast, names and soundtrack", () => {
  const rescued = new Set<string>();
  for (let n = 1; n <= 10; n++) {
    const world = buildWorld(n);
    assert.equal(world.name, LEVELS[n - 1].name);
    assert.equal(world.music, LEVELS[n - 1].music);
    world.cages.forEach((c) => rescued.add(c.friend));
    assert.equal(world.platforms.length, 13 + world.cages.length);
  }
  assert.deepEqual([...rescued].sort(), FRIENDS.map((f) => f.id).sort());
});
test("Blender heroes are skinned GLBs with all four animation clips", () => {
  for (const name of ["frog", "fox", "cat"]) {
    const buffer = readFileSync(`public/game/models/${name}.glb`);
    const json = JSON.parse(
      buffer.subarray(20, 20 + buffer.readUInt32LE(12)).toString(),
    );
    assert.equal(json.skins.length, 1);
    assert.deepEqual(
      json.animations.map((a: { name: string }) => a.name).sort(),
      ["Bash", "Idle", "Jump", "Run"],
    );
    assert.ok(json.meshes[0].primitives.length >= 5);
  }
});
test("save validation rejects old adventure saves and sanitizes malformed state", () => {
  assert.equal(readSave("{oops"), null);
  assert.equal(readSave('{"version":1}'), null);
  const s = readSave(
    JSON.stringify({
      version: 2,
      world: 100,
      hero: "bad",
      rescued: ["zippy", "zippy", "bad"],
      settings: { music: -1, effects: 9 },
      coins: -3,
    }),
  );
  assert.equal(s?.world, 10);
  assert.equal(s?.hero, "frog");
  assert.deepEqual(s?.rescued, ["zippy"]);
  assert.equal(s?.settings.music, 0);
  assert.equal(s?.settings.effects, 1);
  assert.equal(s?.coins, 0);
});
test("three cage bashes rescue Zippy and award the original double jump", () => {
  const g = new PortalGame(newSave());
  g.paused = false;
  const cage = g.world.cages[0];
  g.position = { ...cage };
  g.bash();
  assert.equal(g.rescue, null);
  g.attackCooldown = 0;
  g.bash();
  assert.equal(g.rescue, null);
  g.attackCooldown = 0;
  g.bash();
  assert.equal(g.rescue, "zippy");
  assert.equal(g.has("doubleJump"), true);
  assert.equal(g.paused, true);
  g.resume();
  g.tick(1 / 60, { ...emptyControls(), jump: true });
  run(g, 0.2);
  const before = g.velocity.y;
  g.tick(1 / 60, { ...emptyControls(), jump: true });
  assert.ok(g.velocity.y > before);
  assert.equal(g.jumps, 2);
});
test("portal requires friends and orb, then advances to Star World and Cubo", () => {
  const g = new PortalGame(newSave());
  assert.equal(g.nextWorld(), false);
  g.orbHits = 3;
  assert.equal(g.nextWorld(), false);
  g.saveData.rescued.push("zippy");
  assert.equal(g.nextWorld(), true);
  assert.equal(g.world.name, "Star World");
  assert.equal(g.hasCubo, true);
  assert.equal(g.saveData.unlocked, 2);
  assert.equal(g.orbHits, 0);
});
test("Cubo boosts, falls restore checkpoints, and pausing freezes simulation", () => {
  const save = newSave();
  save.world = 2;
  save.checkpoint = true;
  const g = new PortalGame(save);
  g.start();
  g.boost();
  assert.equal(g.velocity.y, 17);
  assert.ok(g.pillar);
  g.position.y = -30;
  g.tick(1 / 60, emptyControls());
  assert.deepEqual(g.position, g.checkpoint);
  g.pause();
  const pos = { ...g.position };
  run(g, 1, { ...emptyControls(), z: -1 });
  assert.deepEqual(g.position, pos);
});
test("moving platforms carry the hero with them, without sliding off", () => {
  const g = new PortalGame(newSave());
  g.start();
  const p = g.world.platforms[6],
    at = platformAt(p, g.speedTime);
  g.position = { x: at.x, y: at.y + 0.1, z: at.z };
  g.velocity.y = -2;
  run(g, 0.2);
  const offset = g.position.x - platformAt(p, g.speedTime).x;
  run(g, 1);
  assert.ok(
    Math.abs(g.position.x - platformAt(p, g.speedTime).x - offset) < 0.08,
  );
  assert.equal(g.grounded, true);
});
test("boss rings can be jumped and only a resting boss can be bashed", () => {
  const s = newSave();
  s.world = 10;
  const g = new PortalGame(s);
  g.start();
  const p = g.world.platforms[12];
  g.position = { x: p.x, y: p.y, z: p.z + 2 };
  g.bash();
  assert.equal(g.bossHP, 12);
  g.attackCooldown = 0;
  g.bossPhase = "rest";
  g.bash();
  assert.equal(g.bossHP, 11);
  g.attackCooldown = 0;
  g.bash();
  assert.equal(g.bossHP, 11);
  g.bossPhase = "wave";
  g.waveRadius = 2;
  g.position.y = p.y + 2;
  g.tickBoss(0);
  assert.equal(g.hearts, 4);
  g.position.y = p.y;
  g.tickBoss(0);
  assert.equal(g.hearts, 3);
});
test("every world can be completed with its rescue requirements and finale persists", () => {
  const g = new PortalGame(newSave());
  for (let n = 1; n <= 10; n++) {
    assert.equal(g.world.id, n);
    for (const c of g.world.cages) {
      g.position = { ...c };
      for (let i = 0; i < 3; i++) {
        g.attackCooldown = 0;
        g.bash();
      }
      g.resume();
    }
    g.orbHits = 3;
    g.bossHP = 0;
    assert.equal(g.nextWorld(), true);
  }
  assert.equal(g.saveData.rescued.length, 15);
  assert.equal(g.saveData.finished, true);
  assert.equal(g.saveData.unlocked, 10);
  assert.equal(readSave(JSON.stringify(g.saveData))?.finished, true);
});
test("every consecutive island and rescue branch is reachable with real jump physics", () => {
  for (let n = 1; n <= 10; n++) {
    const save = newSave();
    save.world = n;
    save.rescued = FRIENDS.filter(
      (f) => (n > 1 && f.id === "zippy") || (n > 2 && f.id === "flutter"),
    ).map((f) => f.id);
    const g = new PortalGame(save);
    g.start();
    g.world.enemies = [];
    g.world.hazards = [];
    g.bossHP = 0;
    const visit = (index: number) => {
      const platform = g.world.platforms[index];
      let landed = false;
      for (let frame = 0; frame < 900; frame++) {
        const target = platformAt(platform, g.speedTime),
          dx = target.x - g.position.x,
          dz = target.z - g.position.z,
          d = Math.hypot(dx, dz);
        if (d < 0.9 && Math.abs(g.position.y - target.y) < 0.15 && g.grounded) {
          landed = true;
          break;
        }
        const support = g.world.platforms.find((p) => {
          const at = platformAt(p, g.speedTime);
          return (
            Math.abs(g.position.y - at.y) < 0.1 &&
            Math.abs(g.position.x - at.x) < p.w / 2 &&
            Math.abs(g.position.z - at.z) < p.d / 2
          );
        });
        let edge = 99;
        if (support) {
          const at = platformAt(support, g.speedTime);
          edge = Math.min(
            (support.w / 2 - Math.sign(dx) * (g.position.x - at.x)) /
              Math.max(0.001, Math.abs(dx / d)),
            (support.d / 2 - Math.sign(dz) * (g.position.z - at.z)) /
              Math.max(0.001, Math.abs(dz / d)),
          );
        }
        const jump =
          g.grounded &&
          d > 1 &&
          (edge < 1.2 || (target.y > g.position.y + 0.2 && d < 5.2));
        g.tick(1 / 60, {
          ...emptyControls(),
          x: d > 0.3 ? dx / d : 0,
          z: d > 0.3 ? dz / d : 0,
          jump,
          heldJump:
            !g.grounded && g.velocity.y < 0 && g.position.y > target.y + 0.7,
        });
      }
      assert.ok(
        landed,
        `world ${n}, island ${platform.id}, position ${JSON.stringify(g.position)}`,
      );
    };
    for (let i = 1; i <= 12; i++) {
      visit(i);
      const branch = g.world.cages.findIndex(
        (c) => Math.abs(c.z - g.world.platforms[i].z) < 2,
      );
      if (branch >= 0) {
        visit(13 + branch);
        g.saveData.rescued.push(g.world.cages[branch].friend);
        visit(i);
      }
    }
  }
});
