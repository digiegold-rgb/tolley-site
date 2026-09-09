import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const base = process.argv[2] || process.env.REVENUE_TEST_URL || "http://127.0.0.1:3018";
const publicOnly = !["localhost", "127.0.0.1"].includes(new URL(base).hostname) || process.env.FRONT_DOORS_PUBLIC_ONLY === "1";
const shots = "/tmp/tolley-front-doors";
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
// No marketing pixels or production analytics writes during verification.
await context.route("**/*", async route => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== new URL(base).origin && !["data:", "blob:"].includes(url.protocol)) return route.abort();
  if (publicOnly && !["GET", "HEAD"].includes(request.method())) return route.fulfill({status:200,contentType:"application/json",body:'{"ok":true}'});
  return route.continue();
});
const page = await context.newPage();
const errors = [];
const analytics = [];
page.on("request", request => { if (new URL(request.url()).pathname === "/api/analytics" && request.method() === "POST") { try { analytics.push(request.postDataJSON()); } catch {} } });
page.on("pageerror", error => errors.push(error.message));
page.setDefaultTimeout(30000);
page.setDefaultNavigationTimeout(60000);
async function visit(path) {
  console.log("Checking " + path);
  const response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 180000 });
  assert(response && response.status() < 400, `${path}: ${response?.status()}`);
  await page.waitForTimeout(800);
}
try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit("/");
  assert.match(await page.locator("h1").innerText(), /Tolley/);
  assert.equal(await page.getByRole("link", { name: "Explore T-Agent", exact: false }).getAttribute("href"), "/agent");
  assert.equal(await page.getByRole("link", { name: "Explore Jelly Studio", exact: false }).getAttribute("href"), "/animate");
  assert.equal(new URL(await page.locator('link[rel="canonical"]').getAttribute("href")).href, "https://www.tolley.io/");
  await page.screenshot({ path: `${shots}/home-desktop.png`, fullPage: true });
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 850 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `home overflow at ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 850 });
  await page.screenshot({ path: `${shots}/home-mobile.png`, fullPage: true });
  await page.getByRole("link", { name: "Explore T-Agent", exact: false }).click();
  await page.waitForURL(/\/agent$/);
  await page.locator("#features").waitFor();
  await page.waitForLoadState("networkidle");
  // A soft navigation can be network-idle before React flushes passive effects.
  const eventDeadline = Date.now() + 15000;
  while (!analytics.some(e => e.type === "view" && e.path === "/agent") && Date.now() < eventDeadline) await page.waitForTimeout(100);
  await page.waitForTimeout(500);
  const agentViews = analytics.filter(e => e.type === "view" && e.path === "/agent");
  assert.equal(agentViews.length, 1, "one tracker owns each /agent visit");
  assert.equal(agentViews[0].site, "agent");
  assert.match(agentViews[0].sessionId, /^[a-f0-9-]{36}$/i);
  for (const id of ["features", "pricing", "demo"]) assert.equal(await page.locator(`#${id}`).count(), 1);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://www.tolley.io/agent");
  const schema = JSON.parse(await page.locator("#ld-t-agent").textContent());
  assert.equal(schema.url, "https://www.tolley.io/agent");
  assert.deepEqual(schema.offers.map(x => x.price), ["49.00", "99.00", "199.00"]);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "agent mobile overflow");
  await page.screenshot({ path: `${shots}/agent-mobile.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: `${shots}/agent-desktop.png`, fullPage: true });
  for (const hash of ["features", "pricing", "demo"]) {
    await visit(`/?utm_source=route-test#${hash}`);
    await page.waitForURL(`**/agent?utm_source=route-test#${hash}`);
  }
  await visit("/#products");
  assert.equal(new URL(page.url()).pathname, "/");
  for (const [from, to] of [["/pricing", "/leads/pricing"], ["/agent/pricing", "/leads/pricing"], ["/leads/demo", "/agent#demo"], ["/agent/demo", "/agent#demo"]]) {
    await visit(from);
    assert.equal(new URL(page.url()).pathname + new URL(page.url()).hash, to, from);
  }
  await visit("/leads/pricing");
  assert.equal(await page.getByRole("link", {name:"T-Agent",exact:true}).getAttribute("href"), "/agent");
  assert.equal(await page.getByRole("switch", {name:"Annual billing"}).count(), 0, "unconfigured annual plans must not be advertised");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", {name:"Sign up to subscribe"}).first().click();
  await page.waitForURL(/\/signup\?/);
  assert.equal(new URL(page.url()).searchParams.get("callbackUrl"), "/leads/pricing");
  await visit("/signup?callbackUrl=%2Fleads%2Fdashboard");
  assert.equal(await page.getByRole("link", {name:"t-agent",exact:true}).getAttribute("href"), "/agent");
  await visit("/signup?callbackUrl=%2Fanimate");
  assert(await page.getByRole("link", {name:/Jelly Studio/i}).count() > 0);
  assert.equal(await page.locator('input[name="invite"][required]').count(), 0);
  await visit("/animate");
  assert(await page.getByRole("link", {name:"Start creating",exact:true}).count() >= 2);
  for (const link of await page.getByRole("link", {name:"Start creating",exact:true}).all()) {
    assert.equal(await link.getAttribute("href"), "/signup?callbackUrl=%2Fanimate");
  }
  const sitemap = await context.request.get(base + "/sitemap.xml", {timeout:180000});
  assert.equal(sitemap.status(), 200);
  assert.match(await sitemap.text(), /<loc>https:\/\/www\.tolley\.io\/agent<\/loc>/);
  const product = await (await context.request.get(base + "/api/leads/public")).json();
  assert.equal(product.url, "https://www.tolley.io/agent");
  assert.deepEqual(Object.values(product.pricing).map(p => p.monthly), [49,99,199]);
  await visit("/agents");
  assert.equal(new URL(page.url()).pathname, "/login", "protected /agents stays protected");
  assert.deepEqual(errors, [], "browser JavaScript errors");
  console.log(JSON.stringify({ok:true,base,screenshots:shots,checks:"root, agent, legacy anchors, aliases, signup callbacks, pricing, Animate, sitemap, metadata, protected workspace, responsive layouts"}));
} finally {
  await browser.close();
}
