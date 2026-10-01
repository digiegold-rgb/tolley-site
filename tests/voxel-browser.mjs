/** Real browser checks for Portal Hoppers: Blocky Worlds (/game/next). Uses opt-in development hooks only. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.PORTAL_TEST_URL || "http://127.0.0.1:3042";
const shots = process.env.PORTAL_SHOTS || "/tmp";
const browser = await chromium.launch({ headless: true, args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"] });
const errors = [];
const watch = (p) => p.on("pageerror", (e) => errors.push(e.message));
const ready = async (p) => {
  await p.goto(base + "/game/next?test=1", { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForSelector('[data-testid="voxel"][data-ready="true"]', { timeout: 180000 });
  await p.waitForFunction(() => !!window.__voxel);
};
const G = (p, fn) => p.evaluate(fn);
try {
  const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
  const page = await context.newPage();
  watch(page);
  await ready(page);
  await page.screenshot({ path: `${shots}/voxel-title.png`, timeout: 150000 });
  await page.getByRole("button", { name: "Ember Clever & quick" }).click();
  await page.getByRole("button", { name: /Let’s play!/ }).click();
  await page.waitForFunction(() => window.__voxel.game.time > 0.3, {}, { timeout: 60000 });
  assert.equal(await page.getAttribute('[data-testid="voxel"]', "data-mode"), "play");
  await G(page, () => (window.__voxel.game.peaceful = true)); // scripted walk; the Bolt-Bots get their own checks below
  assert.ok(await page.locator(".vx-intro").isVisible(), "world intro card shows");
  const start = await G(page, () => ({ pos: { ...window.__voxel.game.position }, def: { ...window.__voxel.game.def.start } }));
  assert.ok(Math.abs(start.pos.z - start.def.z) < 0.6 && start.pos.y === 4, `start ${JSON.stringify(start)}`);
  // Walk forward through the coin row, jump, and check the aim ray is live.
  await page.keyboard.down("KeyW");
  await page.waitForFunction(() => window.__voxel.game.position.z > 7, {}, { timeout: 30000 });
  await page.keyboard.press("Space");
  await page.waitForFunction(() => window.__voxel.game.position.y > 4.8, {}, { timeout: 10000 });
  await page.waitForFunction(() => window.__voxel.game.position.z > 12, {}, { timeout: 30000 });
  await page.keyboard.up("KeyW");
  await page.waitForFunction(() => window.__voxel.game.grounded, {}, { timeout: 10000 });
  const walk = await G(page, () => {
    const { game: g, audio: a, input: i } = window.__voxel;
    return { pos: { ...g.position }, coins: g.saveData.coins, aim: g.aim.kind, sfx: a?.events ?? 0, locked: i.locked, msg: g.snapshot().message };
  });
  assert.ok(walk.coins >= 1, `coins ${walk.coins}`);
  assert.ok(walk.aim === "block" || walk.aim === "none", `aim ${walk.aim}`);
  assert.ok(walk.sfx > 0, "sound effects fired");
  // Headless Chromium may or may not grant pointer lock; the hint must match whichever happened.
  assert.equal(await page.locator(".vx-lockhint").isVisible(), !walk.locked, `lock hint vs locked=${walk.locked}`);
  assert.ok(await page.locator(".vx-reticle").isVisible(), "reticle visible");
  await page.screenshot({ path: `${shots}/voxel-play.png`, timeout: 150000 });
  // Lever → door: stand by lever 1 and press E, then the door cells are air.
  await G(page, () => {
    const g = window.__voxel.game;
    g.position = { x: 41.5, y: 6, z: 42.5 };
    g.velocity = { x: 0, y: 0, z: 0 };
  });
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__voxel.game.switches.has("s1"), {}, { timeout: 5000 });
  assert.equal(await G(page, () => window.__voxel.game.grid.get(24, 7, 42)), 0, "door d1 opened");
  // Bash Zippy's cage the full eight times with the mouse button; the rescue modal appears.
  await G(page, () => {
    const g = window.__voxel.game;
    const c = g.cages[0];
    g.position = { x: c.at.x - 1.2, y: c.at.y, z: c.at.z };
    g.yaw = Math.atan2(1, 0);
    g.velocity = { x: 0, y: 0, z: 0 };
  });
  for (let i = 0; i < 8; i++) {
    await page.waitForFunction(() => window.__voxel.game.attackCooldown === 0, {}, { timeout: 15000 });
    const hp = await G(page, () => window.__voxel.game.cages[0].hp);
    await page.keyboard.press("KeyX");
    await page.waitForFunction((h) => window.__voxel.game.cages[0].hp < h || window.__voxel.game.rescue !== null, hp, { timeout: 15000 });
  }
  await page.waitForSelector('[role="dialog"]', { timeout: 20000 });
  assert.match(await page.locator('[role="dialog"] h2').innerText(), /Zippy is free/);
  await page.screenshot({ path: `${shots}/voxel-rescue.png`, timeout: 150000 });
  await page.getByRole("button", { name: /keep hopping/i }).click();
  await page.waitForFunction(() => !window.__voxel.game.paused);
  assert.equal(await G(page, () => window.__voxel.game.has("doubleJump")), true);
  // Enemies and the boss are live: a Bolt-Bot dies to three bashes; the Foreman wakes in his hall and the boss bar appears.
  const fight = await G(page, () => {
    const g = window.__voxel.game;
    g.peaceful = false;
    g.invulnerable = Infinity;
    const bot = g.enemies[0];
    g.position = { x: bot.at.x - 1, y: bot.at.y, z: bot.at.z };
    g.yaw = Math.atan2(1, 0);
    g.velocity = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 3; i++) {
      g.attackCooldown = 0;
      g.bash();
    }
    g.position = { x: 40.5, y: 12, z: 112.5 };
    return { dead: bot.dead, enemies: g.enemies.length, boss: g.boss?.name };
  });
  assert.equal(fight.dead, true, "bashed a Bolt-Bot to scrap");
  assert.ok(fight.enemies >= 8, `enemies placed: ${fight.enemies}`);
  assert.equal(fight.boss, "Forge Foreman");
  await page.waitForFunction(() => window.__voxel.game.bossAwake, {}, { timeout: 10000 });
  await page.waitForSelector(".vx-boss-meter", { timeout: 10000 });
  await page.waitForFunction(() => window.__voxel.game.boss.state === "stagger", {}, { timeout: 30000 });
  await page.screenshot({ path: `${shots}/voxel-boss.png`, timeout: 150000 });
  const music = await G(page, () => ({ track: window.__voxel.audio?.track, mode: window.__voxel.audio?.music.mode }));
  assert.equal(music.track, "boss", "boss music cue");
  console.log(`music: ${music.track} via ${music.mode}`);
  await G(page, () => {
    const g = window.__voxel.game;
    g.defeatBoss();
    g.peaceful = true;
    g.invulnerable = 0;
    g.position = { x: 40.5, y: 4, z: 8.5 };
  });
  // Pause, settings, resume; then reload and continue from the save.
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-testid="voxel"][data-mode="pause"]');
  await page.getByLabel("Mouse look").selectOption("drag");
  await page.getByRole("button", { name: /Keep hopping/ }).click();
  await page.waitForFunction(() => !window.__voxel.game.paused);
  await page.keyboard.press("Escape");
  await page.waitForSelector('[data-testid="voxel"][data-mode="pause"]');
  await page.getByRole("button", { name: /Save & title/ }).click();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForSelector('[data-testid="voxel"][data-ready="true"]', { timeout: 180000 });
  const saved = await G(page, () => JSON.parse(localStorage.getItem("tolley-portal-hoppers-voxel-v3")));
  assert.deepEqual(saved.rescued, ["zippy"]);
  assert.equal(saved.settings.look, "drag");
  await page.getByRole("button", { name: /Continue adventure/ }).click();
  await page.waitForFunction(() => window.__voxel.game.time > 0.3, {}, { timeout: 60000 });
  assert.equal(await G(page, () => window.__voxel.game.has("doubleJump")), true);
  // Drag look works without pointer lock.
  const before = await G(page, () => window.__voxel.game.cameraYaw);
  await page.mouse.move(700, 450);
  await page.mouse.down();
  await page.mouse.move(900, 450, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await G(page, () => window.__voxel.game.cameraYaw);
  assert.notEqual(before, after, "drag rotated the camera");
  // Frame pacing sample (soft in software rendering).
  const fps = await G(page, () => new Promise((r) => {
    let n = 0;
    const t0 = performance.now();
    const step = () => (++n < 60 && performance.now() - t0 < 4000 ? requestAnimationFrame(step) : r((n * 1000) / (performance.now() - t0)));
    requestAnimationFrame(step);
  }));
  console.log(`fps (software GL): ${fps.toFixed(1)}`);
  await page.screenshot({ path: `${shots}/voxel-continue.png`, timeout: 150000 });
  await context.close();
} finally {
  await browser.close();
}
if (errors.length) {
  console.error("page errors:\n" + errors.join("\n"));
  process.exit(1);
}
console.log("Blocky Worlds browser checks passed: title, intro, play, coins, aim, lever/door, cage rescue, Bolt-Bot, Foreman + boss bar + boss music, pause/settings, save/reload, drag look.");
