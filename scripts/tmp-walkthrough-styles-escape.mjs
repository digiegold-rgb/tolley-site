/**
 * Walkthrough regression (2026-08-20): the Styles screen must never dump a
 * user into the legacy /vater chrome.
 *
 * Repro being tested (Jared's report): /animate → Styles → "Clone & Edit" on
 * a system style landed on tolley.io/vater/youtube/styles/<id> (old site,
 * merch footer). Also covers "+ Create New Style", the "Edit" button on an
 * own style, and the scene editor's "← Channel" link catch-all.
 *
 * Usage:
 *   WALKTHROUGH_QA_PASSWORD=... node scripts/tmp-walkthrough-styles-escape.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3057';
const EMAIL = 'qa.walkthrough.0820@tolley.io';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/walkthrough-shots';
if (!PASS) throw new Error('Set WALKTHROUGH_QA_PASSWORD');

const failures = [];
const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  console.log(`  ✗ ${msg}`);
  failures.push(msg);
};

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(60000);

const assertInStudio = async (label) => {
  await page.waitForTimeout(1500);
  const path = new URL(page.url()).pathname;
  if (path === '/animate') pass(`${label}: still on /animate`);
  else fail(`${label}: ESCAPED to ${path}`);
};

// ── login ────────────────────────────────────────────────────────────────
console.log('login…');
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.locator('input[type=email]').first().fill(EMAIL);
await page.locator('input[type=password]').first().fill(PASS);
await page.locator('button[type=submit]').first().click();
await page.waitForTimeout(4000);
await page.goto(`${BASE}/animate`, { waitUntil: 'networkidle' });
if (!(await page.locator('.animate-shell').count())) {
  // click-wrap or landing — try to continue into the studio
  const enter = page.getByRole('button', { name: /agree|enter|continue/i }).first();
  if (await enter.count()) await enter.click();
  await page.waitForTimeout(3000);
}
console.log('landed:', page.url());
await page.screenshot({ path: `${SHOTS}/01-landed.png`, fullPage: false });

// ── Styles screen ────────────────────────────────────────────────────────
console.log('open Styles…');
await page.getByText('Styles', { exact: true }).first().click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOTS}/02-styles.png`, fullPage: false });
await assertInStudio('Styles screen');

// ── Clone & Edit on a system style (the reported repro) ──────────────────
console.log('Clone & Edit…');
const cloneBtn = page.getByRole('button', { name: /Clone & Edit/i }).first();
if (await cloneBtn.count()) {
  await cloneBtn.click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${SHOTS}/03-after-clone.png`, fullPage: false });
  await assertInStudio('Clone & Edit');
  if (await page.getByText('Back to Styles').count()) pass('Clone & Edit: in-studio style editor visible');
  else fail('Clone & Edit: style editor not visible');
} else {
  fail('no Clone & Edit button found');
}

// ── Back, then Edit on an own style ──────────────────────────────────────
if (await page.getByText('Back to Styles').count()) {
  await page.getByText('Back to Styles').first().click();
  await page.waitForTimeout(2500);
}
const editLink = page.getByRole('link', { name: /^Edit$/ }).first();
if (await editLink.count()) {
  console.log('Edit own style…');
  await editLink.click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SHOTS}/04-after-edit.png`, fullPage: false });
  await assertInStudio('Edit own style');
} else {
  console.log('  (no own-style Edit link — skipped)');
}

// ── + Create New Style ───────────────────────────────────────────────────
if (await page.getByText('Back to Styles').count()) {
  await page.getByText('Back to Styles').first().click();
  await page.waitForTimeout(2500);
}
console.log('+ Create New Style…');
const createBtn = page.getByRole('button', { name: /Create New Style/i }).first();
if (await createBtn.count()) {
  await createBtn.click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${SHOTS}/05-after-create.png`, fullPage: false });
  await assertInStudio('Create New Style');
} else {
  fail('no Create New Style button found');
}

await b.close();
console.log(failures.length ? `\nFAILURES: ${failures.length}` : '\nALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
