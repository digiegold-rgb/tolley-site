import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3057';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/walkthrough-shots';
const failures = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.log(`  ✗ ${m}`); failures.push(m); };
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(90000);
for (let i = 1; i <= 3; i++) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').first().fill('qa.walkthrough.0820@tolley.io');
  await page.locator('input[type=password]').first().fill(PASS);
  await page.locator('button[type=submit]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
  await page.goto(`${BASE}/animate`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('link', { name: 'Sign in' }).count())) break;
}
await page.waitForSelector('.animate-shell', { timeout: 120000 });

// 1. Wizard scroll: open via Characters → Use in new project
await page.getByText('Characters', { exact: true }).first().click();
const useBtn = page.getByRole('button', { name: 'Use in new project' }).first();
await useBtn.waitFor({ state: 'visible', timeout: 90000 });
await useBtn.click();
await page.getByText('Create New Style').first().waitFor({ state: 'visible', timeout: 30000 });
// expand every collapsible section, then check the footer save button is reachable
for (const sec of ['Script', 'Voice', 'Visual', 'Overlay', 'Brand']) {
  const hdr = page.getByRole('button', { name: new RegExp(sec, 'i') }).first();
  if (await hdr.count()) await hdr.click().catch(() => {});
}
await page.waitForTimeout(800);
const saveBtn = page.getByRole('button', { name: /Create Style|Save/i }).last();
const reachable = await saveBtn.scrollIntoViewIfNeeded().then(() => true).catch(() => false);
const visible = reachable && await saveBtn.isVisible();
await page.screenshot({ path: `${SHOTS}/ux-01-wizard.png` });
if (visible) pass('wizard scrolls to the bottom with sections expanded');
else fail('wizard bottom unreachable');
await page.keyboard.press('Escape');
await page.waitForTimeout(800);

// 2. Step 2 banner in own-script mode
await page.getByRole('button', { name: '+ Create Video' }).first().click().catch(async () => {
  await page.getByText('+ Create Video').first().click();
});
await page.waitForTimeout(2000);
const toggle = page.getByText('I already have a script — use mine').first();
await toggle.waitFor({ state: 'visible', timeout: 30000 });
await toggle.click();
await page.locator('textarea').first().fill('This is a QA script about patience and compounding. '.repeat(4));
await page.waitForTimeout(600);
await page.screenshot({ path: `${SHOTS}/ux-02-step2.png` });
if (await page.getByText('Step 2', { exact: true }).count()) pass('Step 2 guidance banner shows');
else fail('Step 2 banner missing');
if (await page.getByText(/No character yet|👤/).first().count()) pass('style cards show character presence');
else fail('character presence line missing on cards');

await b.close();
console.log(failures.length ? `\nFAILURES: ${failures.length}` : '\nALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
