/**
 * Walkthrough (2026-08-25 PM): rule SCOPES as a PUBLIC user — Global + My rules
 * tabs (no House), create an owner rule (#1), seed a character's rules from the
 * Characters tab drawer, banner shows "My rules · N".
 * Usage: WALKTHROUGH_QA_PASSWORD=... node scripts/tmp-walkthrough-rule-scopes.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3059';
const EMAIL = 'qa.walkthrough.0820@tolley.io';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/claude-1000/-home-jelly/1444699e-c9f6-4aa2-9964-329c999ce70c/scratchpad/rule-scopes-shots';
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
  const scopes = {};
  for (const x of j.rules || []) scopes[x.scope] = (scopes[x.scope] || 0) + 1;
  const house = await fetch('/api/vater/rules?scope=house', { cache: 'no-store' }).then((r) => r.json());
  const me = await fetch('/api/vater/me', { cache: 'no-store' }).then((r) => r.json());
  return { status: r.status, version: j.version, scopes, houseCount: house.count, caps: me.capabilities?.rules, houseCaps: me.capabilities?.houseRules, tier: me.tier };
});
console.log('api:', JSON.stringify(api));
if (api.status === 200 && api.scopes.global >= 80 && !api.scopes.house) pass(`public session sees global (${api.scopes.global}) and no house rules`); else fail(`public session scopes ${JSON.stringify(api.scopes)}`);
if (api.houseCount === 0) pass('scope=house request from a public session returns 0'); else fail(`public session got ${api.houseCount} house rules`);
if (api.caps === true && api.houseCaps === false) pass('capabilities rules=true houseRules=false'); else fail(`caps ${api.caps}/${api.houseCaps}`);

// ── Rules screen tabs ─────────────────────────────────────────────────────
await page.goto(`${BASE}/animate#r=rules`, { waitUntil: 'load' });
await page.waitForTimeout(4000);
const tabG = await page.locator('[data-testid="rules-tab-global"]').count();
const tabO = await page.locator('[data-testid="rules-tab-owner"]').count();
const tabH = await page.locator('[data-testid="rules-tab-house"]').count();
if (tabG && tabO && !tabH) pass('tabs: Global + My rules, no House'); else fail(`tabs G=${tabG} O=${tabO} H=${tabH}`);
const gRows = await page.locator('[data-testid^="rule-G"]').count();
if (gRows >= 80) pass(`${gRows} global rule rows rendered`); else fail(`only ${gRows} global rows`);
const addOnGlobal = await page.locator('[data-testid="rules-add"]').count();
if (!addOnGlobal) pass('no "+ Add rule" on Global for a public user'); else fail('public user sees + Add rule on Global');
await page.screenshot({ path: `${SHOTS}/01-global.png` });

// My rules → add one
await page.locator('[data-testid="rules-tab-owner"]').click();
await page.waitForTimeout(800);
await page.locator('[data-testid="rules-add"]').click();
await page.locator('[data-testid="rules-add-title"]').fill('My videos always open on a wide establishing shot.');
await page.locator('[data-testid="rules-add-submit"]').click();
await page.waitForTimeout(2500);
const mine = await page.evaluate(async () => (await fetch('/api/vater/rules?scope=owner', { cache: 'no-store' }).then((r) => r.json())).rules);
const first = mine.find((r) => r.title.startsWith('My videos always open'));
console.log('owner rules:', mine.map((r) => `${r.display} ${r.scope} ${r.characterId ?? '-'}`).join(', '));
if (first && /^#\d+$/.test(first.display) && first.scope === 'owner') pass(`owner rule created as ${first.display} (code ${first.code})`); else fail('owner rule not created');
const shown = await page.locator(`[data-testid="rule-${first?.code}"]`).count();
if (shown) pass('owner rule row rendered under My rules'); else fail('owner rule row missing');
await page.screenshot({ path: `${SHOTS}/02-my-rules.png` });

// cannot edit a global rule
const forbidden = await page.evaluate(async () => {
  const r = await fetch('/api/vater/rules/G1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'x' }) });
  return r.status;
});
if (forbidden === 403) pass('PUT on a global rule → 403 for a public user'); else fail(`PUT global → ${forbidden}`);

// ── Characters tab: banner + per-character drawer + seed ──────────────────
await page.goto(`${BASE}/animate#r=characters`, { waitUntil: 'load' });
await page.waitForTimeout(5000);
const banner = await page.locator('[data-testid="rules-banner-mine"]').textContent().catch(() => null);
if (banner && /My rules · \d+/.test(banner)) pass(`banner: ${banner.trim()}`); else fail(`banner mine text: ${banner}`);
const rulesBtns = page.locator('[data-testid^="character-rules-"]');
const n = await rulesBtns.count();
console.log('character cards with Rules button:', n);
if (n > 0) {
  await rulesBtns.first().click();
  await page.waitForTimeout(800);
  const seedBtn = page.locator('[data-testid="character-rules-seed"]');
  if (await seedBtn.count()) {
    await seedBtn.click();
    await page.waitForTimeout(4000);
  }
  const drawerRows = await page.locator('[data-testid="character-rules-drawer"] [data-testid^="rule-"]:not([data-testid^="rule-editor"]):not([data-testid^="rule-save"])').count();
  if (drawerRows >= 8) pass(`character drawer lists ${drawerRows} seeded rules`); else fail(`character drawer rows ${drawerRows}`);
  await page.screenshot({ path: `${SHOTS}/03-character-rules.png` });
} else {
  // no DGX-library card → seed via API with the DB character
  const seeded = await page.evaluate(async () => {
    const r = await fetch('/api/vater/rules/character-seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ characterId: 'cmt1rn7ml000al4fbzxh5nsoa' }) });
    return { status: r.status, ...(await r.json()) };
  });
  console.log('api seed:', JSON.stringify({ status: seeded.status, created: seeded.created, name: seeded.name }));
  if (seeded.created >= 8) pass(`API seeded ${seeded.created} rules for ${seeded.name}`); else fail(`API seed ${JSON.stringify(seeded).slice(0, 200)}`);
}
const after = await page.evaluate(async () => (await fetch('/api/vater/rules?scope=owner', { cache: 'no-store' }).then((r) => r.json())).rules);
const charRules = after.filter((r) => r.characterId);
if (charRules.length >= 8) pass(`${charRules.length} character-pinned rules for the QA user (template keys: ${[...new Set(charRules.map((r) => r.templateKey))].length})`); else fail(`character rules ${charRules.length}`);

// My rules groups by character
await page.goto(`${BASE}/animate#r=rules`, { waitUntil: 'load' });
await page.waitForTimeout(3500);
await page.locator('[data-testid="rules-tab-owner"]').click();
await page.waitForTimeout(800);
const groups = await page.locator('[data-testid^="rules-group-c:"]').count();
if (groups >= 1) pass(`My rules groups ${groups} character(s)`); else fail('no character group under My rules');
await page.screenshot({ path: `${SHOTS}/04-my-rules-grouped.png`, fullPage: true });

await b.close();
console.log(failures.length ? `\nFAILURES (${failures.length}):\n- ${failures.join('\n- ')}` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
