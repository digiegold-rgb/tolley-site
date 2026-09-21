import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { encode } from 'next-auth/jwt';
import { prisma } from '../../lib/prisma';
import { enrollmentKey, signMfaProof } from '../../lib/auth/mfa-proof';

async function main() {
  if (process.env.DATABASE_URL !== 'postgresql://postgres@127.0.0.1:55438/tolley_live_growth_test') throw new Error('Isolated test DB required');
  const base = 'http://127.0.0.1:3026';
  const user = await prisma.user.upsert({ where: { email: 'coach-test@tolley.invalid' }, create: { email: 'coach-test@tolley.invalid' }, update: {} });
  const mfa = await prisma.userMfa.upsert({ where: { userId: user.id }, create: { userId: user.id, verified: true, totpSecret: 'test-only' }, update: { verified: true } });
  const session = 'coach-browser-test', now = Math.floor(Date.now() / 1000);
  const jwt = await encode({ secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token', token: { sub: user.id, email: user.email, authSessionId: session, authAt: now, sv: 0, svAt: now }, maxAge: 3600 });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const anon = await browser.newContext();
    anon.setDefaultTimeout(120000);

    assert.equal((await anon.request.get(base + '/api/stream-coach/snapshot', { timeout: 120000 })).status(), 401);
    assert.equal((await anon.request.post(base + '/api/stream-coach/action', { data: { action: 'start', title: 'blocked' } })).status(), 401);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: 'authjs.session-token', value: jwt, domain: '127.0.0.1', path: '/' }, { name: 'tolley_mfa', value: signMfaProof(user.id, session, enrollmentKey(mfa)), domain: '127.0.0.1', path: '/' }]);
    assert.equal((await context.request.post(base + '/api/stream-coach/action', { headers: { origin: 'https://not-tolley.invalid' }, data: { action: 'start', title: 'blocked' } })).status(), 403);
    assert.equal((await context.request.post(base + '/api/stream/coach/action', { data: { action: 'start', title: 'blocked' } })).status(), 404);
    assert.equal((await context.request.post(base + '/api/stream-coach/go-live', { data: {} })).status(), 404);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(120000);
    await page.goto(base + '/stream/coach', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('heading', { name: 'Saturday treasure haul · test fixture' }).waitFor();
    await page.getByText('Does the hair dryer work on 220v?', { exact: true }).first().waitFor();
    await page.screenshot({ path: '/tmp/stream-coach-desktop.png', fullPage: true });
    const before = await (await context.request.get(base + '/api/stream-coach/snapshot')).json();
    await page.getByRole('button', { name: '✓ Handled', exact: true }).first().click();
    await page.waitForTimeout(1000);
    const after = await (await context.request.get(base + '/api/stream-coach/snapshot')).json();
    assert.equal(after.metrics.openQuestions, before.metrics.openQuestions - 1);
    await page.getByRole('button', { name: 'Sales', exact: true }).click();
    await page.getByLabel('Item', { exact: true }).fill('Browser-tested dryer');
    await page.getByLabel('Total USD', { exact: true }).fill('12.50');
    await page.getByRole('button', { name: 'Save sale', exact: true }).click();
    await page.getByText('Browser-tested dryer', { exact: true }).waitFor();
    const sales = await (await context.request.get(base + '/api/stream-coach/snapshot')).json();
    assert.equal(sales.metrics.salesCents, before.metrics.salesCents + 1250);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Saturday treasure haul · test fixture' }).waitFor();
    await page.getByRole('button', { name: 'Recap & ask', exact: true }).click();
    await page.getByLabel('Ask about this show', { exact: true }).fill('What are the recorded gross sales? Keep it to one sentence.');
    await page.getByRole('button', { name: 'Ask coach', exact: true }).click();
    let answer;
    for (let attempt = 0; attempt < 40; attempt++) {
      answer = await (await context.request.get(base + '/api/stream-coach/snapshot')).json();
      if (answer.answers[0]?.status === 'ready' || answer.answers[0]?.status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    assert.equal(answer.answers[0]?.status, 'ready', JSON.stringify(answer.answers));
    assert(answer.answers[0].answer.includes((sales.metrics.salesCents / 100).toFixed(2)), JSON.stringify(answer.answers));
    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of ['Show board', 'Sales', 'Audience', 'Recap & ask']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${tab} fits mobile`);
    }
    await page.getByRole('button', { name: 'Show board', exact: true }).click();
    await page.screenshot({ path: '/tmp/stream-coach-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Finish tracking', exact: true }).click();
    await page.getByRole('button', { name: 'Finish this show’s tracking', exact: true }).click();
    await page.getByText('Saved show', { exact: false }).first().waitFor();
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('Owner/MFA gate, cross-origin rejection, allowlist, question handling, saved sales, real local AI, mobile views and tracking end passed.');
  } finally { await browser.close(); await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
