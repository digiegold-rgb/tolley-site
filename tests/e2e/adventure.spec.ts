import { test, expect, type Page } from '@playwright/test';
import { freshProgress, SAVE_KEY, type AdventureGame } from '../../components/game/adventure/model';
import type { AdventureInput } from '../../components/game/adventure/input';

declare global { interface Window { __adventure?: { game: AdventureGame; input: AdventureInput; observedHeight?: number } } }
// These tests exercise a local development server; mutation hooks are absent from production bundles.
test.beforeEach(async ({ baseURL }) => {
  test.skip(!baseURL || !/^http:\/\/(127\.0\.0\.1|localhost):/.test(baseURL), 'Adventure physics tests require a local dev server.');
});
async function ready(page: Page, url = '/game/adventure?test=1') {
  await page.goto(url);
  await expect(page.getByTestId('adventure-stage')).toHaveAttribute('data-ready', 'true', { timeout: 120_000 });
}
async function start(page: Page) {
  await page.getByRole('button', { name: /Begin your journey/ }).click();
  await expect(page.getByTestId('adventure-stage')).toHaveAttribute('data-mode', 'play');
  await page.waitForFunction(() => window.__adventure?.game.position.y && window.__adventure.game.position.y < .8);
}
async function place(page: Page, x: number, z: number) {
  await page.evaluate(({ x, z }) => {
    const g = window.__adventure!.game; g.position = { x, y: 1, z }; g.respawn++;
  }, { x, z });
  await page.waitForTimeout(500);
}
async function walk(page: Page, key: string, condition: () => boolean, timeout = 20_000) {
  await page.keyboard.down(key);
  try { await page.waitForFunction(condition, undefined, { timeout }); }
  finally { await page.keyboard.up(key); }
}

test('3D title, character choice, movement, jump, pause and resume', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page, '/game?test=1');
  await expect(page.getByRole('heading', { name: 'Portal Hoppers.' })).toBeVisible();
  await page.getByRole('button', { name: /Zip/ }).click();
  await page.screenshot({ path: 'test-results/adventure/title.png' });
  await start(page);
  expect(await page.evaluate(() => window.__adventure!.game.progress.hero)).toBe('frog');
  await walk(page, 'KeyW', () => window.__adventure!.game.position.z < 4);
  await page.evaluate(() => {
    const api = window.__adventure!; const tick = api.game.tick.bind(api.game); api.observedHeight = 0;
    api.game.tick = dt => { tick(dt); api.observedHeight = Math.max(api.observedHeight ?? 0, api.game.position.y); };
  });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => (window.__adventure!.observedHeight ?? 0) > 1.4);
  await page.screenshot({ path: 'test-results/adventure/play.png' });
  await page.getByRole('button', { name: 'Pause adventure' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const before = await page.evaluate(() => window.__adventure!.game.time);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__adventure!.game.time)).toBe(before);
  await page.getByRole('button', { name: 'Return to the forest' }).click();
  await expect(page.getByTestId('adventure-stage')).toHaveAttribute('data-mode', 'play');
  expect(errors).toEqual([]);
});

test('forest gate has real collision until all three beacons are activated', async ({ page }) => {
  await ready(page); await start(page); await place(page, 0, -41);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => window.__adventure!.game.position.z)).toBeGreaterThan(-44);
  for (const [x, z] of [[-19, -9], [18, -20], [-16, -35]]) { await place(page, x, z); await page.keyboard.press('KeyE'); }
  await page.waitForFunction(() => window.__adventure!.game.progress.solved.includes('forest'));
  await place(page, 0, -41);
  await walk(page, 'KeyW', () => window.__adventure!.game.position.z < -47);
  expect(await page.evaluate(() => window.__adventure!.game.progress.checkpoint)).toBe(1);
});

test('physics stone can be pushed onto its plate, and reload preserves completed puzzle', async ({ page }) => {
  const p = freshProgress(); p.seals = ['brook', 'grove', 'ruins']; p.solved = ['forest']; p.checkpoint = 1; p.settings.quality = 'low';
  await page.addInitScript(({ key, save }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save)); }, { key: SAVE_KEY, save: p });
  await ready(page); await page.getByRole('button', { name: /Continue journey/ }).click();
  await place(page, -7, -53);
  await walk(page, 'KeyD', () => window.__adventure!.game.blocks.roots.x > 3.7, 30_000);
  const block = await page.evaluate(() => window.__adventure!.game.blocks.roots);
  await place(page, block.x, block.z + 2);
  await walk(page, 'KeyW', () => window.__adventure!.game.blocks.roots.z < -54.4, 30_000);
  await page.waitForFunction(() => window.__adventure!.game.progress.boomerang);
  await page.screenshot({ path: 'test-results/adventure/roots-solved.png' });
  await page.reload(); await expect(page.getByTestId('adventure-stage')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: /Continue journey/ }).click();
  expect(await page.evaluate(() => window.__adventure!.game.progress.solved)).toContain('roots');
});

test('blocked storage keeps play available with an explicit saving notice', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage disabled'); } }));
  await ready(page); await start(page);
  await expect(page.getByText('Saving is unavailable in this browser.', { exact: false })).toBeVisible();
  await walk(page, 'KeyW', () => window.__adventure!.game.position.z < 7);
});

test('touchscreen players have a working classic-game entry', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto('/game');
  const link = page.getByRole('link', { name: 'Play the touch adventure' });
  await expect(link).toBeVisible(); await expect(link).toHaveAttribute('href', '/game/classic');
  await page.screenshot({ path: 'test-results/adventure/touch.png' });
  await context.close();
});

test('unavailable WebGL offers recovery instead of a permanently disabled start button', async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
      return Reflect.apply(get, this, [type, ...args]);
    } as typeof get;
  });
  await page.goto('/game/adventure');
  await expect(page.getByRole('heading', { name: 'The forest couldn’t load.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Play Classic', exact: true })).toHaveAttribute('href', '/game/classic');
});

test('standard controller can start, pause, resume and safely disconnect', async ({ page }) => {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
    Object.assign(window, { testPad: pad });
  });
  const button = async (n: number) => {
    await page.evaluate(n => { (window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[n].pressed = true; }, n);
    await page.waitForTimeout(300);
    await page.evaluate(n => { (window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[n].pressed = false; }, n);
    await page.waitForTimeout(200);
  };
  await ready(page); await button(0);
  await expect(page.getByTestId('adventure-stage')).toHaveAttribute('data-mode', 'play');
  await page.waitForFunction(() => window.__adventure!.game.time > 1);
  await button(9); await expect(page.getByRole('dialog')).toBeVisible();
  await button(9); await expect(page.getByTestId('adventure-stage')).toHaveAttribute('data-mode', 'play');
  await page.evaluate(() => { (window as unknown as { testPad: { connected: boolean } }).testPad.connected = false; });
  await expect(page.getByRole('dialog')).toBeVisible();
});
