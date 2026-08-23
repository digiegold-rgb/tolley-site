/**
 * Walkthrough (2026-08-23): per-user sidebar reorder in /animate.
 *
 * Asserts: every nav row shows a ≡ grip; dragging Voices above Library
 * reorders; the order survives a full reload; keyboard (ArrowUp on the grip)
 * moves a row; a row dragged into the ACCOUNT half moves section; "Reset menu
 * order" restores the default.
 *
 * Usage: WALKTHROUGH_QA_PASSWORD=... node scripts/tmp-walkthrough-nav-reorder.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3057';
const EMAIL = 'qa.walkthrough.0820@tolley.io';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/claude-1000/-home-jelly/b718344e-9fe3-4598-a44a-a204ad7fce2a/scratchpad/nav-reorder-shots';
if (!PASS) throw new Error('Set WALKTHROUGH_QA_PASSWORD');
mkdirSync(SHOTS, { recursive: true });

const failures = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.log(`  ✗ ${m}`); failures.push(m); };

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
page.setDefaultTimeout(60000);


/** HTML5 DnD via dispatched DragEvents — Playwright's raw mouse can't drive
 *  native drag-and-drop. clientY picks the top/bottom half of the target row
 *  (insert before / after). */
async function dragRow(gripId, targetId, where /* 'above' | 'below' */) {
  const dt = await page.evaluateHandle(() => new DataTransfer());
  const grip = page.getByTestId(gripId);
  const target = page.getByTestId(targetId);
  const tb = await target.boundingBox();
  if (!tb) throw new Error(`no box for ${targetId}`);
  const y = where === 'above' ? tb.y + 2 : tb.y + tb.height - 2;
  const x = tb.x + tb.width / 2;
  await grip.dispatchEvent('dragstart', { dataTransfer: dt });
  await target.dispatchEvent('dragover', { dataTransfer: dt, clientX: x, clientY: y });
  await page.waitForTimeout(150);
  await target.dispatchEvent('drop', { dataTransfer: dt, clientX: x, clientY: y });
  await grip.dispatchEvent('dragend', { dataTransfer: dt });
  await page.waitForTimeout(500);
}

const navOrder = async () => {
  const ids = await page.$$eval('[data-testid^="nav-"]', (els) =>
    els
      .map((e) => e.getAttribute('data-testid'))
      .filter((id) => id && !id.startsWith('nav-grip-') && id !== 'nav-reset-order')
      .map((id) => id.replace('nav-', '')),
  );
  return ids;
};

console.log('login…');
await page.goto(`${BASE}/login`, { waitUntil: 'load' });
await page.locator('input[type=email]').first().fill(EMAIL);
await page.locator('input[type=password]').first().fill(PASS);
await page.locator('button[type=submit]').first().click();
await page.waitForTimeout(4000);
await page.goto(`${BASE}/animate`, { waitUntil: 'load' });
await page.waitForTimeout(2500);
await page.evaluate(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('jelly.nav-order.')) localStorage.removeItem(k); } catch {} });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);

const before = await navOrder();
console.log('default order:', before.join(', '));
if (before.length < 8) fail(`unexpectedly few nav items (${before.length})`);

// grips present on every row
const gripCount = await page.locator('[data-testid^="nav-grip-"]').count();
if (gripCount === before.length) pass(`grip on every row (${gripCount})`);
else fail(`grips ${gripCount} ≠ rows ${before.length}`);
await page.screenshot({ path: `${SHOTS}/01-default.png` });

// ── drag Voices above Library ────────────────────────────────────────────
await dragRow('nav-grip-voices', 'nav-library', 'above');
let order = await navOrder();
const vi = order.indexOf('voices');
const li = order.indexOf('library');
if (vi >= 0 && li >= 0 && vi < li) pass(`drag: voices (${vi}) now above library (${li})`);
else fail(`drag did not reorder: voices ${vi}, library ${li} — ${order.join(',')}`);
await page.screenshot({ path: `${SHOTS}/03-after-drag.png` });

// ── survives reload ──────────────────────────────────────────────────────
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);
order = await navOrder();
if (order.indexOf('voices') < order.indexOf('library')) pass('order survives reload');
else fail('order lost on reload');

// ── keyboard: ArrowUp moves a row up ─────────────────────────────────────
const beforeKey = await navOrder();
await page.getByTestId('nav-grip-queue').focus();
await page.keyboard.press('ArrowUp');
await page.waitForTimeout(500);
const afterKey = await navOrder();
if (afterKey.indexOf('queue') === beforeKey.indexOf('queue') - 1) pass('keyboard: ArrowUp moved Queue up one');
else fail(`keyboard move failed (${beforeKey.indexOf('queue')} → ${afterKey.indexOf('queue')})`);

// ── cross-section: drag Learning Center into ACCOUNT (onto Billing) ──────
await dragRow('nav-grip-learning-center', 'nav-pricing', 'below');
order = await navOrder();
{
  const lc = order.indexOf('learning-center');
  const sys = order.indexOf('system-log');
  if (lc > sys && sys >= 0) pass('cross-section: Learning Center now in ACCOUNT half');
  else fail(`cross-section move failed: learning-center ${lc}, system-log ${sys}`);
}
await page.screenshot({ path: `${SHOTS}/04-cross-section.png` });

// ── reset ────────────────────────────────────────────────────────────────
const reset = page.getByTestId('nav-reset-order');
if (await reset.count()) {
  await reset.click();
  await page.waitForTimeout(600);
  const restored = await navOrder();
  if (JSON.stringify(restored) === JSON.stringify(before)) pass('reset restores the default order');
  else fail(`reset mismatch: ${restored.join(',')}`);
} else fail('reset button not shown despite custom order');
await page.screenshot({ path: `${SHOTS}/05-after-reset.png` });

await b.close();
console.log(failures.length ? `\nFAILURES (${failures.length}):\n - ${failures.join('\n - ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
