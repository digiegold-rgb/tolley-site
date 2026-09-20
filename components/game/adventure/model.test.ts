import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AdventureGame, CHECKPOINTS, SEALS, SWITCHES, TARGETS, freshProgress, parseSave, SAVE_KEY } from './model';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) } });
function advance(g: AdventureGame, seconds: number) { for (let i = 0; i < Math.ceil(seconds * 60); i++) g.tick(1 / 60); }
function game() { const g = new AdventureGame(freshProgress()); g.paused = false; return g; }

test('malformed, foreign and inconsistent saves cannot place a player behind locked gates', () => {
  assert.equal(parseSave('{'), null);
  assert.equal(parseSave(JSON.stringify({ version: 99 })), null);
  const p = freshProgress();
  p.checkpoint = 5; p.solved = ['roots', 'echo']; p.boomerang = true; p.finished = true;
  const restored = parseSave(JSON.stringify(p))!;
  assert.equal(restored.checkpoint, 0); assert.deepEqual(restored.solved, []);
  assert.equal(restored.boomerang, false); assert.equal(restored.finished, false);
});

test('all three distinct forest beacons are needed, and cannot be collected twice', () => {
  const g = game();
  for (const s of SEALS) {
    g.position = { ...s, y: 1 }; g.interact(); g.interact();
  }
  assert.equal(g.progress.seals.length, 3); assert.deepEqual(g.progress.solved, ['forest']);
  assert.equal(parseSave(storage.get(SAVE_KEY)!)?.solved[0], 'forest');
});

test('the complete puzzle chain grants the boomerang and opens each door through its own rules', () => {
  const g = game();
  for (const s of SEALS) { g.position = { ...s, y: 1 }; g.interact(); }
  g.position = { x: 0, y: 1, z: -53 };
  g.blocks.roots = { x: 4, z: -55 }; advance(g, 1);
  assert.equal(g.progress.boomerang, true);
  for (const s of SWITCHES) { g.position = { ...s, y: 1 }; g.interact(); advance(g, .5); }
  assert.ok(g.progress.solved.includes('wind'));
  g.position = { x: 0, y: 1, z: -83 };
  for (const t of TARGETS) { g.locked = t.id; g.throwBoomerang(); advance(g, 1); }
  assert.ok(g.progress.solved.includes('light'));
  g.position = { x: 0, y: 1, z: -105 };
  g.blocks.echo = { x: 4, z: -101 }; g.interact();
  assert.equal(g.progress.solved.includes('echo'), false);
  g.locked = 'echo-guard'; g.throwBoomerang(); advance(g, .5); g.interact();
  assert.ok(g.progress.solved.includes('echo'));
  assert.equal(g.progress.solved.length, 5);
});

test('timed switches expire and wrong boomerang symbols reset without trapping the player', () => {
  const g = game();
  g.position = { ...SWITCHES[0], y: 1 }; g.interact();
  advance(g, 16); assert.deepEqual(g.switches, []);
  g.position = { ...SWITCHES[1], y: 1 }; g.interact(); assert.equal(g.switches.length, 1);
  g.progress.boomerang = true; g.position = { x: 0, y: 1, z: -83 };
  g.locked = 'leaf'; g.throwBoomerang(); advance(g, 1); assert.deepEqual(g.targets, []);
  g.locked = 'sun'; g.throwBoomerang(); advance(g, 1); assert.deepEqual(g.targets, ['sun']);
});

test('shield facing, stamina, dodge and checkpoint recovery enforce fair combat', () => {
  const g = game(); g.position = { x: 0, y: 1, z: 0 }; g.yaw = 0; g.shield = true;
  g.hurt({ x: 0, z: 1 }); assert.equal(g.health, 6); assert.equal(g.stamina, 85);
  g.invulnerable = 0; g.hurt({ x: 0, z: -1 }); assert.equal(g.health, 5);
  g.invulnerable = 0; g.dodge(); g.hurt({ x: 0, z: -1 }); assert.equal(g.health, 5);
  g.progress.secrets.push('camp'); g.progress.checkpoint = 1; g.health = 1; g.invulnerable = 0; g.shield = false;
  g.hurt({ x: 0, z: 1 }); assert.equal(g.health, 6); assert.deepEqual(g.position, CHECKPOINTS[1]);
  assert.deepEqual(g.progress.secrets, ['camp']);
});

test('guardian requires its three mechanics, then saves completion', () => {
  const g = game(); const boss = g.enemies.find(e => e.kind === 'boss')!;
  g.position = { x: 0, y: 1, z: -116 }; g.yaw = Math.PI;
  boss.phase = 'warn'; g.attack(); assert.equal(boss.hp, 18);
  for (let n = 0; n < 6; n++) { boss.phase = 'recover'; g.attackTime = 0; g.stamina = 100; g.attack(); }
  assert.equal(boss.hp, 12); assert.equal(g.bossPhase(boss), 2);
  g.attackTime = 0; g.stamina = 100; g.attack(); assert.equal(boss.hp, 12);
  for (let n = 0; n < 3; n++) {
    g.shield = true; g.stamina = 100; g.shots.push({ x: 0, z: -116.3, vx: 0, vz: 9, life: 2 }); g.tick(1 / 60);
  }
  assert.equal(boss.hp, 6); assert.equal(g.bossPhase(boss), 3);
  g.attackTime = 0; g.stamina = 100; g.attack(); assert.equal(boss.hp, 6);
  boss.stun = 3;
  for (let n = 0; n < 6; n++) { g.attackTime = 0; g.stamina = 100; g.attack(); }
  assert.equal(boss.hp, 0); assert.equal(g.progress.finished, true);
});

test('pausing freezes timers, and unavailable storage leaves the adventure playable', () => {
  const g = game(); g.paused = true; g.switchTime = 10; advance(g, 5); assert.equal(g.switchTime, 10);
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('blocked'); } });
  try { g.save(); assert.equal(g.storageOk, false); g.paused = false; g.tick(1 / 60); assert.ok(g.time > 0); }
  finally { Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous }); }
});
