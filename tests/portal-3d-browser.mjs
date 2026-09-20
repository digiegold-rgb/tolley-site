/** Real browser checks for the Portal Hoppers rebuild. Uses opt-in development hooks only. */
import { chromium } from "playwright";
import assert from "node:assert/strict";
const base = process.env.PORTAL_TEST_URL || "http://127.0.0.1:3037";
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const errors = [];
const screenshots = "/tmp";
const watch = (p) => p.on("pageerror", (e) => errors.push(e.message));
const ready = async (p) => {
  await p.goto(base + "/game?test=1", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await p.waitForSelector('[data-testid="portal-3d"][data-ready="true"]', {
    timeout: 120000,
  });
  await p.waitForFunction(() => !!window.__portal3d);
};
try {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
  });
  const page = await context.newPage();
  watch(page);
  await ready(page);
  await page.getByRole("button", { name: "Ember Clever & quick" }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: screenshots + "/portal-hoppers-title.png" });
  await page.getByRole("button", { name: /Let’s play!/ }).click();
  await page.waitForFunction(() => window.__portal3d.game.time > 0.3);
  assert.equal(await page.evaluate(() => window.__portal3d.game.paused), false);
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => window.__portal3d.game.position.z < 6,
    {},
    { timeout: 30000 },
  );
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () => window.__portal3d.game.position.z < 1.7,
    {},
    { timeout: 30000 },
  );
  await page.keyboard.up("KeyW");
  await page.keyboard.down("KeyD");
  await page.waitForFunction(
    () => window.__portal3d.game.position.x > 2.3,
    {},
    { timeout: 30000 },
  );
  await page.keyboard.up("KeyD");
  await page.waitForFunction(() => window.__portal3d.game.grounded);
  const movement = await page.evaluate(() => {
    const { game: g, audio: a } = window.__portal3d;
    return {
      pos: g.position,
      coins: g.saveData.coins,
      notes: a.notes,
      track: a.track,
      state: a.synth.state(),
    };
  });
  assert.ok(movement.coins > 0);
  assert.ok(movement.notes > 12);
  assert.equal(movement.track, "factory");
  assert.equal(movement.state, "running");
  await page.screenshot({ path: screenshots + "/portal-hoppers-gameplay.png" });
  console.log(
    "PASS animated hero, real keyboard movement, jumping, coin collection, original music",
    movement,
  );
  await page.evaluate(() => {
    const g = window.__portal3d.game,
      c = g.world.cages[0];
    g.position = { x: c.x, y: c.y, z: c.z + 1.7 };
    g.velocity = { x: 0, y: 0, z: 0 };
  });
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(
      () => window.__portal3d.game.attackCooldown === 0,
    );
    await page.keyboard.press("KeyX");
    await page.waitForTimeout(150);
  }
  await page.getByRole("dialog", { name: "Friend rescued" }).waitFor();
  assert.equal(
    await page.evaluate(() => window.__portal3d.game.has("doubleJump")),
    true,
  );
  await page.screenshot({ path: screenshots + "/portal-hoppers-rescue.png" });
  await page.getByRole("button", { name: /Let’s keep hopping/ }).click();
  await page.evaluate(() => {
    const g = window.__portal3d.game,
      o = g.world.orb;
    g.position = { x: o.x, y: o.y - 1.3, z: o.z + 1 };
    g.velocity = { x: 0, y: 0, z: 0 };
  });
  for (let i = 0; i < 3; i++) {
    await page.waitForFunction(
      () => window.__portal3d.game.attackCooldown === 0,
    );
    await page.keyboard.press("KeyX");
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => window.__portal3d.game.portalOpen);
  await page.evaluate(() => {
    const g = window.__portal3d.game;
    g.position = { ...g.world.portal };
  });
  await page.keyboard.press("KeyE");
  await page.waitForSelector('[data-world="2"]');
  await page.waitForTimeout(1000);
  assert.equal(
    await page.evaluate(() => window.__portal3d.audio.track),
    "star",
  );
  await page.keyboard.press("ShiftLeft");
  await page.waitForFunction(() => window.__portal3d.game.position.y > 2);
  console.log(
    "PASS cage rescue, original double jump, three-hit orb, world transition, Star World music, Cubo boost",
  );
  await page.getByRole("button", { name: "Pause game" }).click();
  await page.getByRole("dialog", { name: "Game paused" }).waitFor();
  const frozen = await page.evaluate(() => window.__portal3d.game.time);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__portal3d.game.time), frozen);
  await page.getByRole("slider", { name: "Music volume" }).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 7; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Save & title" }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-ready="true"]', { timeout: 90000 });
  await page.getByRole("button", { name: /Continue adventure/ }).click();
  await page.waitForSelector('[data-world="2"]');
  assert.equal(
    await page.evaluate(() => window.__portal3d.game.saveData.settings.music),
    0.35,
  );
  assert.equal(
    await page.evaluate(() => window.__portal3d.game.saveData.hero),
    "fox",
  );
  console.log("PASS pause, separate audio mix, save and reload");
  for (const world of [3, 4, 5, 6, 7, 8, 9, 10]) {
    await page.evaluate((n) => {
      const g = window.__portal3d.game;
      g.saveData.world = n;
      g.saveData.checkpoint = false;
      g.loadWorld();
    }, world);
    await page.waitForSelector(`[data-world="${world}"]`);
    await page.waitForSelector(`[data-rendered-world="${world}"]`, {
      timeout: 90000,
    });
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.ph-modal[role="alert"]').count(), 0);
    if ([4, 8, 9, 10].includes(world))
      await page.screenshot({
        path: screenshots + `/portal-hoppers-world-${world}.png`,
      });
  }
  console.log("PASS all ten 3D worlds render without recovery panels");
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  watch(phone);
  await ready(phone);
  await phone.screenshot({
    path: screenshots + "/portal-hoppers-phone-title.png",
  });
  await phone.getByRole("button", { name: /Let’s play!/ }).click();
  await phone.getByRole("button", { name: "Jump", exact: true }).waitFor();
  const stick = phone.getByRole("group", { name: "Movement joystick" });
  const box = await stick.boundingBox();
  assert.ok(box);
  const before = await phone.evaluate(() => window.__portal3d.game.position.z);
  // Native CDP touch events exercise pointer capture (synthetic pointerdown cannot acquire capture).
  const client = await mobile.newCDPSession(phone);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + 56, y: box.y + 56 }],
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: box.x + 56, y: box.y + 15 }],
  });
  await phone.waitForTimeout(900);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.ok(
    (await phone.evaluate(() => window.__portal3d.game.position.z)) <
      before - 0.3,
  );
  assert.equal(await phone.evaluate(() => window.__portal3d.input.touchZ), 0);
  await phone.getByRole("button", { name: "Jump", exact: true }).tap();
  await phone.screenshot({
    path: screenshots + "/portal-hoppers-phone-play.png",
  });
  console.log(
    "PASS mobile title, touch joystick, pointer release and action buttons",
  );
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, pageErrors: errors, screenshots }));
} finally {
  await browser.close();
}
