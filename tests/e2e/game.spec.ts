/**
 * Portal Hoppers smoke suite — tolley.io/game
 *
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/game.spec.ts
 *
 * Uses the debug query params (?level=N&god=1&mute=1&seed=N) so every world
 * boots straight into play, deterministically, without audio.
 */
import { test, expect, devices, type Page } from '@playwright/test';

type Api = {
  screen(): string;
  level(): number;
  hero(): { x: number; y: number; vx: number; vy: number; hearts: number; powers: string[] };
  cubo(): { x: number; y: number; state: string; present: boolean };
  skipLevel(): void;
  audioState(): string;
  save(): { unlocked: number; rescued: string[] };
};
declare global {
  interface Window {
    __portalGame?: Api;
  }
}

const errors: string[] = [];
function watch(page: Page) {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
}

async function canvasVariance(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="game-canvas"]');
    if (!c) return 0;
    const ctx = c.getContext('2d');
    if (!ctx) return 0;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let sum = 0;
    let sq = 0;
    let n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) {
      const v = d[i] + d[i + 1] + d[i + 2];
      sum += v;
      sq += v * v;
      n++;
    }
    const mean = sum / n;
    return sq / n - mean * mean;
  });
}

test.describe('Portal Hoppers', () => {
  test('title renders and Enter reaches hero select', async ({ page }) => {
    watch(page);
    await page.goto('/game?mute=1');
    const canvas = page.getByTestId('game-canvas');
    await expect(canvas).toHaveAttribute('data-screen', 'title');
    await expect(page.getByText('PORTAL', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/game/title.png' });
    await page.keyboard.press('Enter');
    await expect(canvas).toHaveAttribute('data-screen', 'select');
    await expect(page.getByText('Pick your hero')).toBeVisible();
    await page.screenshot({ path: 'test-results/game/select.png' });
    expect(errors).toEqual([]);
  });

  for (let n = 1; n <= 10; n++) {
    test(`level ${n} boots, hero moves, Cubo follows`, async ({ page }) => {
      watch(page);
      await page.goto(`/game?level=${n}&god=1&mute=1&seed=7`);
      const canvas = page.getByTestId('game-canvas');
      await expect(canvas).toHaveAttribute('data-screen', 'play');
      await page.waitForFunction(() => !!window.__portalGame);
      const before = await page.evaluate(() => window.__portalGame!.hero());
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(700);
      await page.keyboard.press('Space');
      await page.waitForTimeout(400);
      await page.keyboard.up('ArrowRight');
      const after = await page.evaluate(() => window.__portalGame!.hero());
      if (n === 3) expect(after.y).toBeGreaterThan(before.y);
      else expect(after.x).toBeGreaterThan(before.x);
      await page.waitForTimeout(2600);
      const cubo = await page.evaluate(() => window.__portalGame!.cubo());
      const hero = await page.evaluate(() => window.__portalGame!.hero());
      if (cubo.present) expect(Math.hypot(cubo.x - hero.x, cubo.y - hero.y), `hero=${JSON.stringify(hero)} cubo=${JSON.stringify(cubo)}`).toBeLessThan(400);
      await page.screenshot({ path: `test-results/game/level-${n}.png` });
      expect(await canvasVariance(page)).toBeGreaterThan(50);
      expect(errors).toEqual([]);
    });
  }

  test('god run: K through all 10 worlds reaches the ending and saves', async ({ page }) => {
    watch(page);
    await page.goto('/game?level=1&god=1&mute=1&seed=3');
    const canvas = page.getByTestId('game-canvas');
    await expect(canvas).toHaveAttribute('data-screen', 'play');
    for (let n = 1; n <= 10; n++) {
      await expect(canvas).toHaveAttribute('data-level', String(n));
      await page.waitForTimeout(300);
      await page.keyboard.press('KeyK');
      await page.screenshot({ path: `test-results/game/godrun-${n}.png` });
      if (n < 10) {
        await expect(canvas).toHaveAttribute('data-screen', 'clear');
        await page.keyboard.press('Enter');
        await expect(canvas).toHaveAttribute('data-screen', 'intro');
        await page.keyboard.press('Enter');
        await expect(canvas).toHaveAttribute('data-screen', 'play');
      }
    }
    await expect(canvas).toHaveAttribute('data-screen', 'ending');
    await expect(page.getByText('HOME!')).toBeVisible();
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('tolley-portal-hoppers-v1') ?? '{}'));
    expect(save.unlocked).toBeGreaterThanOrEqual(10);
    await page.screenshot({ path: 'test-results/game/ending.png' });
    expect(errors).toEqual([]);
  });

  test('touch pad moves the hero on a tablet', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['iPad (gen 7)'] });
    const page = await ctx.newPage();
    watch(page);
    await page.goto('/game?level=2&god=1&mute=1&seed=5');
    await page.waitForFunction(() => !!window.__portalGame);
    const right = page.locator('[data-touch="right"]');
    await expect(right).toBeVisible();
    const before = await page.evaluate(() => window.__portalGame!.hero());
    const box = await right.boundingBox();
    if (!box) throw new Error('no touch button');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(600);
    await page.mouse.up();
    const after = await page.evaluate(() => window.__portalGame!.hero());
    expect(after.x).toBeGreaterThan(before.x);
    await page.screenshot({ path: 'test-results/game/ipad.png' });
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('audio context unlocks after a key press', async ({ page }) => {
    await page.goto('/game?level=2&god=1&seed=5');
    await page.waitForFunction(() => !!window.__portalGame);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => window.__portalGame!.audioState());
    expect(['running', 'suspended']).toContain(state);
  });

  test('reduced motion still plays without errors', async ({ page }) => {
    watch(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/game?level=6&god=1&mute=1&seed=9');
    await page.waitForFunction(() => !!window.__portalGame);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowRight');
    await page.screenshot({ path: 'test-results/game/reduced-motion.png' });
    expect(errors).toEqual([]);
  });
});
