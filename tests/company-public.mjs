/** Read-only reviewer/crawler smoke check. No accounts, forms or paid actions.
 * COMPANY_TEST_URL=https://www.tolley.io node tests/company-public.mjs */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.COMPANY_TEST_URL || 'http://127.0.0.1:3027';
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const path of ['/', '/about', '/agent', '/animate', '/shop', '/pc']) {
    const response = await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 120000 });
    assert.equal(response.status(), 200, path);
    assert.equal(new URL(page.url()).pathname, path, `${path} redirected`);
    const body = await page.locator('body').innerText();
    const contact = page.locator('footer[aria-label="Company contact"]');
    assert.match(await contact.innerText(), /Tolley\.io[\s\S]*Independence, MO[\s\S]*support@tolley\.io/, path);
    assert.equal(await contact.locator('a[href="mailto:support@tolley.io"]').count(), 1, path);
    assert.equal(await page.locator('meta[name="robots"][content*="noindex"]').count(), 0, path);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://www.tolley.io${path}`, path);
    assert.doesNotMatch(body, /coming soon|under construction/i, path);
    assert.equal(await page.locator('input[type="password"]').count(), 0, `${path} has a gate`);
    if (path === '/') {
      assert.equal(await page.title(), 'Tolley.io | AI Software & Consumer Technology');
      assert.match(await page.locator('h1').innerText(), /Tolley\.io[\s\S]*AI software &[\s\S]*consumer technology/);
      assert.equal(await page.locator('#products article').count(), 3);
      for (const href of ['/agent','/animate','/shop']) assert.ok(await page.locator(`#products a[href="${href}"]`).count());
      assert.match(body,/~30K/); assert.match(body,/~20K/); assert.match(body,/Bitcoin/);
      const org = JSON.parse(await page.locator('#ld-organization').textContent());
      assert.equal(org.name,'Tolley.io'); assert.equal(org.founder.jobTitle,'Founder');
      assert.equal(org.contactPoint.email,'support@tolley.io');
    }
    if (path === '/about') {
      for (const fact of ['Jared Tolley','Founder','Independence','Apple','Bitcoin','million-dollar','30K','20K']) assert.ok(body.includes(fact),fact);
      const person = JSON.parse(await page.locator('#ld-founder').textContent());
      assert.equal(person.name,'Jared Tolley'); assert.match(person.description,/Bitcoin/);
    }
    if (['/', '/about'].includes(path)) assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} overflows mobile`);
    console.log(`PASS public HTML, contact, canonical, no gate: ${path}`);
  }
  for (const path of ['/llms.txt','/llms-full.txt']) {
    const r = await context.request.get(base+path); assert.equal(r.status(),200);
    const text = await r.text();
    for (const fact of ['AI software','Jared Tolley','Bitcoin','million-dollar','30K','20K','support@tolley.io','https://www.tolley.io/about']) assert.ok(text.includes(fact),`${path}: ${fact}`);
    console.log(`PASS company facts: ${path}`);
  }
  const index = await (await context.request.get(base+'/api/agent-index')).json();
  assert.equal(index.company.name,'Tolley.io'); assert.equal(index.company.products.length,3);
  const sitemap=await (await context.request.get(base+'/sitemap.xml')).text();
  assert.ok(sitemap.includes('https://www.tolley.io/about</loc>'));
  for (const path of ['/', '/about']) {
    const r = await context.request.get(base+path,{headers:{'User-Agent':'Mozilla/5.0 (compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)'}});
    assert.equal(r.status(),200); assert.ok((await r.text()).includes('ld-organization'));
  }
  console.log('PASS agent index, sitemap and synthetic AI crawler requests');
  await context.close();
} finally { await browser.close(); }
