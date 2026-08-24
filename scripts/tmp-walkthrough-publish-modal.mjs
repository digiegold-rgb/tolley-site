import { chromium } from '@playwright/test';
const BASE = process.env.WALKTHROUGH_BASE_URL || 'http://localhost:3057';
const PASS = process.env.WALKTHROUGH_QA_PASSWORD;
const SHOTS = process.env.WALKTHROUGH_SHOTS || '/tmp/walkthrough-shots';
const failures = [];
const pass = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { console.log(`  ✗ ${m}`); failures.push(m); };
const b = await chromium.launch();
const page = await (await b.newContext({ viewport: { width: 1440, height: 2000 } })).newPage();
page.setDefaultTimeout(60000);
for (let i = 1; i <= 3; i++) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type=email]').first().fill('qa.walkthrough.0820@tolley.io');
  await page.locator('input[type=password]').first().fill(PASS);
  await page.locator('button[type=submit]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }).catch(() => {});
  await page.goto(`${BASE}/animate`, { waitUntil: 'networkidle' });
  if (!(await page.getByRole('link', { name: 'Sign in' }).count())) break;
}
await page.waitForSelector('.animate-shell', { timeout: 60000 });
await page.getByText('Script Review', { exact: true }).first().click();
await page.waitForTimeout(3000);
// Reveal the full pipeline, then open the fixture project.
const showAll = page.getByText('Show all projects', { exact: false }).first();
if (await showAll.count()) { await showAll.click(); await page.waitForTimeout(2000); }
const row = page.getByText('QA Shorts Fixture', { exact: false }).first();
await row.waitFor({ state: 'visible', timeout: 60000 });
await row.click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOTS}/pm-01-project.png`, fullPage: false });
const social = page.getByText('Post to your socials').first();
if (!(await social.count())) { fail('publish panel not found on project'); }
else {
  pass('publish panel visible');
  await social.scrollIntoViewIfNeeded();
  const chip = page.getByRole('button', { name: /tiktok/i }).first();
  await chip.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  if (await chip.count()) { await chip.click(); await page.waitForTimeout(500); }
  else fail('tiktok chip not found');
  const cap = page.locator('textarea').last();
  if (await cap.count()) await cap.fill('QA walkthrough caption — not a real post.');
  const postBtn = page.getByRole('button', { name: /Post to .+ platform/ }).first();
  if (!(await postBtn.count())) fail('post button missing');
  else {
    await postBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/pm-02-modal.png` });
    if (await page.getByText('Post now, or schedule?').count()) pass('decision modal opened');
    else fail('decision modal did not open');
    await page.getByText('Schedule for later').first().click();
    const when = new Date(Date.now() + 24 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    await page.locator('input[type=datetime-local]').first()
      .fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T09:00`);
    await page.screenshot({ path: `${SHOTS}/pm-03-scheduled.png` });
    const confirm = page.getByTestId('publish-decision-confirm');
    const label = (await confirm.textContent()) || '';
    if (label.includes('Schedule ·')) pass(`confirm label: "${label.trim()}"`);
    else fail(`confirm label wrong: "${label}"`);
    await confirm.click();
    await page.waitForTimeout(8000);
    await page.screenshot({ path: `${SHOTS}/pm-04-after.png` });
    pass('confirm clicked (fake vendor ids — expecting surfaced error, no real post)');
  }
}
await b.close();
console.log(failures.length ? `\nFAILURES: ${failures.length}` : '\nALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
