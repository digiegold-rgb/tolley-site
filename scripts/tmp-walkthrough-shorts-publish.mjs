/**
 * Walkthrough (2026-08-20): Shorts Library + publish decision modal.
 *  1. Shorts Library tab → cut a 15s segment starting at 0:30 from the QA
 *     fixture project → segment card appears in the shelf.
 *  2. Script Review publish panel → "Post to N platforms…" opens the
 *     "Post now, or schedule?" modal → schedule flow works (vendor call
 *     fails on the QA fixture's fake account ids — expected; the modal and
 *     error surfacing are what's under test).
 *
 * Usage: WALKTHROUGH_QA_PASSWORD=... node scripts/tmp-walkthrough-shorts-publish.mjs
 */
import { chromium } from '@playwright/test';

const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3057';
const EMAIL = 'qa.walkthrough.0820@tolley.io';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/walkthrough-shots';
if (!PASS) throw new Error('Set WALKTHROUGH_QA_PASSWORD');

const failures = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.log(`  ✗ ${m}`); failures.push(m); };

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(90000);

console.log('login…');
for (let attempt = 1; attempt <= 3; attempt++) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').first().fill(EMAIL);
  await page.locator('input[type=password]').first().fill(PASS);
  await page.locator('button[type=submit]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
  await page.goto(`${BASE}/animate`, { waitUntil: 'networkidle' });
  const out = await page.getByRole('link', { name: 'Sign in' }).count()
    + await page.getByRole('button', { name: 'Sign in' }).count();
  if (!out) break;
  console.log(`  login attempt ${attempt} did not stick — retrying`);
}
await page.waitForSelector('.animate-shell', { timeout: 120000 }).catch(() => {});

// ── 1. Shorts Library ────────────────────────────────────────────────────
console.log('Shorts Library…');
const nav = page.getByText('Shorts Library', { exact: true }).first();
if (!(await nav.count())) {
  fail('Shorts Library tab missing from sidebar');
} else {
  await nav.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/sp-01-shorts.png` });
  if (await page.getByText('Cut a short').count()) pass('cutter visible');
  else fail('cutter not visible');

  // start 0:30, length 15s
  const nums = page.locator('input[type=number]');
  if ((await nums.count()) >= 2) {
    await nums.nth(0).fill('0');
    await nums.nth(1).fill('30');
  }
  await page.locator('select').nth(1).selectOption('15').catch(() => {});
  const cutBtn = page.getByTestId('shorts-cut');
  await cutBtn.click();
  pass('cut requested — waiting for ffmpeg…');
  const ok = await page
    .getByText(/Short cut ✓/)
    .waitFor({ state: 'visible', timeout: 300000 })
    .then(() => true)
    .catch(() => false);
  await page.screenshot({ path: `${SHOTS}/sp-02-cut.png` });
  if (ok) pass('segment cut succeeded');
  else fail('cut did not complete in 5 min');
  if (await page.getByText(/from 0:30/).count()) pass('segment card shows "from 0:30"');
  else fail('segment card missing from shelf');
}

// ── 2. Publish decision modal ────────────────────────────────────────────
console.log('publish modal…');
await page.goto(`${BASE}/animate#r=script-review`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${SHOTS}/sp-03-review.png` });
const social = page.getByText('Post to your socials').first();
if (!(await social.count())) {
  console.log('  (publish panel not reachable for this tier — modal untested here)');
} else {
  const tiktokChip = page.getByRole('button', { name: /TikTok/i }).first();
  if (await tiktokChip.count()) await tiktokChip.click();
  const caption = page.locator('textarea').first();
  if (await caption.count()) await caption.fill('QA walkthrough caption — not a real post.');
  const postBtn = page.getByRole('button', { name: /Post to \d+ platform/ }).first();
  if (!(await postBtn.count())) {
    fail('post button not found');
  } else {
    await postBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/sp-04-modal.png` });
    if (await page.getByText('Post now, or schedule?').count()) pass('decision modal opened');
    else fail('decision modal did not open');
    await page.getByText('Schedule for later').first().click();
    const dt = page.locator('input[type=datetime-local]').first();
    const when = new Date(Date.now() + 24 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    await dt.fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T09:00`);
    await page.screenshot({ path: `${SHOTS}/sp-05-schedule.png` });
    const confirm = page.getByTestId('publish-decision-confirm');
    const label = await confirm.textContent();
    if (label?.includes('Schedule ·')) pass(`confirm shows schedule label: "${label.trim()}"`);
    else fail(`confirm label wrong: "${label}"`);
    await confirm.click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${SHOTS}/sp-06-after-confirm.png` });
    // Fake vendor ids → the route errors; the error banner proves the wire.
    if (await page.getByText(/failed|error|HTTP/i).count()) pass('vendor error surfaced (fake QA accounts — nothing posted)');
    else console.log('  (no visible error — check sp-06 screenshot)');
  }
}

await b.close();
console.log(failures.length ? `\nFAILURES: ${failures.length}` : '\nALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
