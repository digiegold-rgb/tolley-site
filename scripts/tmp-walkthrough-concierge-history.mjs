/**
 * Walkthrough (2026-08-25): Fable 5 feedback lines live in Project History,
 * and Script Review shows ONLY the script for a concierge project.
 *
 * Uses the QA account's own delivered ticket F5-0XJ7MQ (cmt654bsn0001ju041tu6aitk).
 * Usage: WALKTHROUGH_QA_PASSWORD=... node scripts/tmp-walkthrough-concierge-history.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3057';
const EMAIL = 'qa.walkthrough.0820@tolley.io';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const PROJECT = 'cmt654bsn0001ju041tu6aitk';
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/claude-1000/-home-jelly/1444699e-c9f6-4aa2-9964-329c999ce70c/scratchpad/concierge-history-shots';
if (!PASS) throw new Error('Set WALKTHROUGH_QA_PASSWORD');
mkdirSync(SHOTS, { recursive: true });
const failures = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.log(`  ✗ ${m}`); failures.push(m); };

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
page.setDefaultTimeout(60000);
await page.goto(`${BASE}/login`, { waitUntil: 'load' });
await page.locator('input[type=email]').first().fill(EMAIL);
await page.locator('input[type=password]').first().fill(PASS);
await page.locator('button[type=submit]').first().click();
await page.waitForTimeout(4000);

// expected history count from the API
await page.goto(`${BASE}/animate`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
const expected = await page.evaluate(async (id) => {
  const r = await fetch(`/api/vater/youtube/${id}`, { cache: 'no-store' });
  const j = await r.json();
  const p = j.project ?? j;
  return { n: p?.settingsJson?.concierge?.history?.length ?? -1, status: p?.status };
}, PROJECT);
console.log('api history entries:', expected.n, 'status', expected.status);

// ── Project History → open the project → feedback lines ───────────────────
await page.goto(`${BASE}/animate#r=project-history`, { waitUntil: 'load' });
await page.waitForTimeout(3000);
const row = page.locator(`[data-project-id="${PROJECT}"], [data-testid="project-${PROJECT}"]`).first();
if (await row.count()) await row.click();
else {
  // fall back: click the first card whose text mentions the QA script title
  // the title also sits inside a display:none legacy card — take the visible one
  const card = page.getByText('Here is the simplest money rule', { exact: false }).locator('visible=true').first();
  await card.click();
}
await page.waitForTimeout(2500);
const lines = page.getByTestId('concierge-history-line');
const n = await lines.count();
if (n === expected.n && n > 0) pass(`Project History shows ${n} feedback lines (= API history)`);
else fail(`Project History feedback lines ${n} ≠ api ${expected.n}`);
const card = page.getByTestId('concierge-history');
if (await card.count()) pass('ConciergeHistory panel rendered');
else fail('ConciergeHistory panel missing');
const firstNote = await lines.first().innerText().catch(() => '');
console.log('  newest line:', firstNote.replace(/\s+/g, ' ').slice(0, 140));
await page.screenshot({ path: `${SHOTS}/01-project-history.png`, fullPage: true });

// ── Script Review → same project → no ladder / chips ──────────────────────
await page.goto(`${BASE}/animate#r=script-review`, { waitUntil: 'load' });
await page.waitForTimeout(3000);
const srRow = page.getByText('Here is the simplest money rule', { exact: false }).locator('visible=true').first();
if (await srRow.count()) { await srRow.click(); await page.waitForTimeout(2000); pass('Script Review lists the Fable 5 project (inPipeline)'); }
else fail('Script Review does not list the Fable 5 project');
const detail = page.getByTestId('fable5-script-detail');
if (await detail.count()) pass('Script Review shows the script-only Fable 5 detail'); else fail('fable5-script-detail missing');
const bodyText = await page.locator('body').innerText();
const leaked = ['Quality check', 'Picked up', 'Directing', 'scene ', 'Refreshing', '%'].filter((k) => new RegExp(k.replace('%','\\d+%')).test(bodyText.split('SCRIPT ·')[0] ?? bodyText));
const hasHistoryLines = await page.getByTestId('concierge-history-line').count();
if (hasHistoryLines === 0) pass('Script Review has no feedback lines'); else fail(`Script Review still shows ${hasHistoryLines} feedback lines`);
if (!(await page.getByText(/queued → picked up/i).count())) pass('no concierge stage chips in Script Review'); else fail('stage chips still in Script Review');
console.log('  suspicious tokens in detail area:', leaked.join(',') || 'none');
await page.screenshot({ path: `${SHOTS}/02-script-review.png`, fullPage: true });

await b.close();
console.log(failures.length ? `\nFAILURES (${failures.length}):\n - ${failures.join('\n - ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
