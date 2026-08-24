/**
 * Walkthrough + live proof (2026-08-23): the own-script → Fable 5 Concierge
 * lane on /animate, exactly the way a customer clicks it, ending in a REAL
 * ticket that the headless fable5-runner on the DGX must pick up and render.
 *
 *   Create Video → [banner] "I already have my script" → Fable 5 Concierge →
 *   paste script → pick a Style → RenderConfirmModal → "Send to Fable 5 · $"
 *   → ticket code shown.
 *
 * Usage:
 *   WALKTHROUGH_QA_PASSWORD=... WALKTHROUGH_BASE_URL=http://localhost:3057 \
 *     node scripts/tmp-walkthrough-fable5-runner-proof.mjs
 * Add SUBMIT=1 to actually click the final confirm (creates a real ticket +
 * spends real Modal money on the QA account's test credits).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3057';
const EMAIL = 'qa.walkthrough.0820@tolley.io';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/claude-1000/-home-jelly/b718344e-9fe3-4598-a44a-a204ad7fce2a/scratchpad/f5-proof-shots';
const SUBMIT = process.env.SUBMIT === '1';
if (!PASS) throw new Error('Set WALKTHROUGH_QA_PASSWORD');
mkdirSync(SHOTS, { recursive: true });

const SCRIPT = process.env.PROOF_SCRIPT || [
  'Here is the simplest money rule I know.',
  'Every time you get paid, move ten percent into a separate savings account before you touch anything else.',
  'Do that for twelve months and you will have more than a month of expenses set aside.',
  'Small, boring, automatic.',
  'That is how most people build their first real cushion.',
].join(' ');

const failures = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.log(`  ✗ ${m}`); failures.push(m); };
const shot = (p, name) => p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
const apiCalls = [];
page.on('response', (r) => { if (r.url().includes('/api/vater/concierge/submit')) apiCalls.push({ url: r.url(), status: r.status() }); });

console.log('login…');
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.locator('input[type=email]').first().fill(EMAIL);
await page.locator('input[type=password]').first().fill(PASS);
await page.locator('button[type=submit]').first().click();
await page.waitForTimeout(4000);
await page.goto(`${BASE}/animate`, { waitUntil: 'networkidle' });
if (!(await page.locator('.animate-shell').count())) {
  const enter = page.getByRole('button', { name: /agree|enter|continue/i }).first();
  if (await enter.count()) await enter.click();
  await page.waitForTimeout(3000);
}
console.log('landed:', page.url());
await shot(page, '01-dashboard');

console.log('Create Video…');
await page.getByRole('button', { name: /Create Video/i }).first().click();
await page.waitForTimeout(2500);
await shot(page, '02-modal-open');

const ownBtn = page.getByTestId('path-own-script');
if (await ownBtn.count()) {
  pass('banner: "I already have my script" card present');
  const checked0 = await ownBtn.getAttribute('aria-checked');
  await ownBtn.click();
  await page.waitForTimeout(800);
  const checked1 = await ownBtn.getAttribute('aria-checked');
  if (checked0 !== 'true' && checked1 === 'true') pass('banner: click selects (aria-checked false → true)');
  else fail(`banner: aria-checked ${checked0} → ${checked1}`);
  if (await page.getByText('✓ SELECTED').count()) pass('banner: SELECTED pill visible');
  else fail('banner: no SELECTED pill');
} else {
  fail('banner card not found — falling back to legacy checkbox');
  const cb = page.locator('input[type=checkbox]').first();
  await cb.check();
}
await shot(page, '03-own-script-selected');

const ta = page.locator('textarea').first();
await ta.waitFor();
await ta.fill(SCRIPT);
await page.waitForTimeout(800);
pass(`script pasted (${SCRIPT.split(/\s+/).length} words)`);

const f5 = page.getByTestId('engine-fable5');
await f5.waitFor();
await f5.click();
await page.waitForTimeout(600);
if ((await f5.getAttribute('aria-checked')) === 'true') pass('engine: Fable 5 Concierge selected');
else fail('engine: Fable 5 not selected');
await shot(page, '04-fable5-selected');

// first real style card (skip the "Create Style" tile)
const cards = page.locator('[aria-label="Select a style"] [role=button]');
const n = await cards.count();
console.log(`  style cards: ${n}`);
let clicked = false;
for (let i = 0; i < n; i++) {
  const txt = (await cards.nth(i).innerText()).trim();
  if (/create/i.test(txt.split('\n')[0]) && !/3d|pixar|cinematic|anime|flat|noir|claymation|watercolor/i.test(txt)) continue;
  console.log(`  clicking style card: ${txt.split('\n')[0]}`);
  await cards.nth(i).click();
  clicked = true;
  break;
}
if (!clicked) fail('no style card to click');
await page.waitForTimeout(2500);
await shot(page, '05-confirm-modal');

const confirm = page.getByTestId('render-confirm');
if (await confirm.count()) {
  const label = (await confirm.innerText()).trim();
  if (/Send to Fable 5/i.test(label)) pass(`confirm modal: button = "${label}"`);
  else fail(`confirm modal: unexpected button "${label}"`);
  const body = await page.locator('[aria-label="Confirm before sending to Fable 5"]').innerText().catch(() => '');
  if (/Fable 5/.test(body)) pass('confirm modal: Fable 5 manifest shown');
  writeFileSync(`${SHOTS}/confirm-modal.txt`, body);
  if (await confirm.isDisabled()) fail('confirm button DISABLED — blocker: ' + body.slice(0, 400));
  if (SUBMIT && !(await confirm.isDisabled())) {
    console.log('SUBMIT=1 → clicking Send to Fable 5…');
    await confirm.click();
    await page.waitForTimeout(8000);
    await shot(page, '06-after-submit');
    // 1 script → the editor opens with the ConciergeStatusCard ("Fable 5 has
    // your script." + F5 code); 2+ scripts → the batch card in the modal.
    const queued = (await page.getByTestId('concierge-batch-queued').count())
      ? page.getByTestId('concierge-batch-queued')
      : page.getByText(/Fable 5 has your script|Concierge render/i).first();
    if (await queued.count()) {
      const text = await page.locator('body').innerText();
      const code = (text.match(/F5-[A-Z0-9]{6}/) || [])[0];
      pass(`ticket queued: ${code || '(code not on screen)'}`);
      writeFileSync(`${SHOTS}/ticket.txt`, `${code || ''}\n${text}`);
      console.log(text.slice(0, 600));
    } else {
      const errText = await page.locator('[role=alert], .error').allInnerTexts().catch(() => []);
      fail('no queued confirmation after submit ' + JSON.stringify(errText).slice(0, 300));
    }
    console.log('submit API calls:', JSON.stringify(apiCalls));
  }
} else {
  fail('RenderConfirmModal did not open after style click');
}

await b.close();
console.log(failures.length ? `\nFAILURES (${failures.length}):\n - ${failures.join('\n - ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
