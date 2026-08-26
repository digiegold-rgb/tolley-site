/**
 * Walkthrough (2026-08-25): the ONLINE rulebook screen — list renders with gate
 * pills, studio user edits rule 157 (harmless PUT), revision recorded, and the
 * Characters tab shows the rulebook banner.
 * Usage: WALKTHROUGH_QA_PASSWORD=... node scripts/tmp-walkthrough-rules.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3058';
const EMAIL = 'qa.walkthrough.0820@tolley.io';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/claude-1000/-home-jelly/1444699e-c9f6-4aa2-9964-329c999ce70c/scratchpad/rules-shots';
if (!PASS) throw new Error('Set WALKTHROUGH_QA_PASSWORD');
mkdirSync(SHOTS, { recursive: true });
const failures = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.log(`  ✗ ${m}`); failures.push(m); };

const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 1100 } })).newPage();
page.setDefaultTimeout(90000);
await page.goto(`${BASE}/login`, { waitUntil: 'load' });
await page.locator('input[type=email]').first().fill(EMAIL);
await page.locator('input[type=password]').first().fill(PASS);
await page.locator('button[type=submit]').first().click();
await page.waitForTimeout(4000);

await page.goto(`${BASE}/animate`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
const api = await page.evaluate(async () => {
  const r = await fetch('/api/vater/rules', { cache: 'no-store' });
  const j = await r.json();
  return { status: r.status, version: j.version, count: j.count, sections: j.sections?.length };
});
console.log('api:', JSON.stringify(api));
if (api.status === 200 && /^[0-9a-f]{12}$/.test(api.version) && api.count >= 158) pass(`session JSON: ${api.count} rules, v${api.version}, ${api.sections} sections`);
else fail(`session JSON unexpected: ${JSON.stringify(api)}`);

// ── Rules screen ──────────────────────────────────────────────────────────
await page.goto(`${BASE}/animate#r=rules`, { waitUntil: 'load' });
await page.waitForTimeout(4000);
const header = page.locator('[data-testid="rules-header"]');
if (await header.count()) pass('rules header rendered'); else fail('rules header missing');
const hardCount = await page.locator('[data-testid^="rule-"] >> text=/^hard$/i').count();
if (hardCount >= 20) pass(`${hardCount} HARD pills visible`); else fail(`only ${hardCount} HARD pills`);
await page.screenshot({ path: `${SHOTS}/01-rules.png`, fullPage: false });

// filter → hard only
await page.locator('[data-testid="rules-filter-hard"]').click();
await page.waitForTimeout(500);
const rows = await page.locator('[data-testid^="rule-"]:not([data-testid^="rule-editor"]):not([data-testid^="rule-save"])').count();
console.log('hard-filter rows:', rows);
if (rows >= 20 && rows < 60) pass(`hard filter shows ${rows} rows`); else fail(`hard filter rows ${rows}`);
await page.locator('[data-testid="rules-filter-all"]').click();

// edit rule 157 harmlessly (source → same value)
const row157 = page.locator('[data-testid="rule-157"]');
await row157.scrollIntoViewIfNeeded();
await row157.click();
await page.waitForTimeout(500);
const editor = page.locator('[data-testid="rule-editor-157"]');
if (await editor.count()) pass('inline editor opened for #157'); else fail('editor did not open');
await page.screenshot({ path: `${SHOTS}/02-rule-157-editor.png`, fullPage: false });
await page.locator('[data-testid="rule-save-157"]').click();
await page.waitForTimeout(3000);
const rev = await page.evaluate(async () => {
  const r = await fetch('/api/vater/rules/157', { cache: 'no-store' });
  const j = await r.json();
  return { status: r.status, revisions: j.revisions?.length, lastBy: j.revisions?.[0]?.by, updatedBy: j.rule?.updatedBy };
});
console.log('rule 157:', JSON.stringify(rev));
if (rev.revisions >= 2 && rev.lastBy === 'qa.walkthrough.0820@tolley.io') pass(`revision recorded by ${rev.lastBy} (${rev.revisions} total)`); else fail(`revision not recorded: ${JSON.stringify(rev)}`);

// ── Characters tab banner ────────────────────────────────────────────────
await page.goto(`${BASE}/animate#r=characters`, { waitUntil: 'load' });
await page.waitForTimeout(4000);
const banner = page.locator('[data-testid="rules-banner"]');
if (await banner.count()) {
  const txt = await banner.innerText();
  if (/rules/i.test(txt) && /v[0-9a-f]{12}/.test(txt)) pass(`characters banner: ${txt.replace(/\s+/g, ' ').slice(0, 120)}`); else fail(`banner text odd: ${txt}`);
} else fail('characters banner missing');
await page.screenshot({ path: `${SHOTS}/03-characters-banner.png`, fullPage: false });

await b.close();
console.log(failures.length ? `FAILURES: ${failures.length}` : 'ALL PASS');
process.exit(failures.length ? 1 : 0);
