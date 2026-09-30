import assert from "node:assert/strict";
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import { prisma } from "../../lib/prisma";
import { enrollmentKey, signMfaProof } from "../../lib/auth/mfa-proof";

async function main() {
  assert.equal(process.env.DATABASE_URL, "postgresql://postgres@127.0.0.1:55438/tolley_live_growth_test");
  const base = "http://127.0.0.1:3039";
  const email = "stream-handoff@tolley.invalid";
  const user = await prisma.user.upsert({ where: { email }, create: { email }, update: {} });
  const mfa = await prisma.userMfa.upsert({ where: { userId: user.id }, create: { userId: user.id, verified: true, totpSecret: "test-only" }, update: { verified: true } });
  const session = "stream-guide-test", now = Math.floor(Date.now() / 1000);
  const jwt = await encode({ secret: process.env.AUTH_SECRET!, salt: "authjs.session-token", token: { sub: user.id, email, authSessionId: session, authAt: now, sv: user.sessionVersion, svAt: now }, maxAge: 3600 });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(base + "/stream/assistant", { waitUntil: "domcontentloaded", timeout: 240000 });
    assert.match(page.url(), /\/login/);
    assert.equal(await page.getByRole("heading", { name: "Your Whatnot show assistants", exact: true }).count(), 0);
    await context.addCookies([{ name: "authjs.session-token", value: jwt, domain: "127.0.0.1", path: "/" }]);
    await page.goto(base + "/stream/assistant", { waitUntil: "domcontentloaded", timeout: 240000 });
    assert.match(page.url(), /\/login|\/mfa/);
    await context.addCookies([{ name: "tolley_mfa", value: signMfaProof(user.id, session, enrollmentKey(mfa)), domain: "127.0.0.1", path: "/" }]);
    await page.goto(base + "/stream/assistant", { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.getByRole("heading", { name: "Your Whatnot show assistants", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: "/tmp/stream-guide-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: "/tmp/stream-guide-desktop.png", fullPage: true });

    await page.goto(base + "/stream/assistant", { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.getByRole("heading", { name: "Your Whatnot show assistants", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Open Classic Show Assistant →", exact: true }).getAttribute("href"), "/api/stream/whatnot-bot/admin");
    assert.equal(await page.getByRole("link", { name: "Open Inventory Assistant V2 →", exact: true }).getAttribute("href"), "/api/stream/whatnot-bot-v2/admin");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    const facebook = { verified: true, pageId: "1156652300855210", pageName: "Ruthann’s Treasure Haul", videoId: "123456", title: "Test preview", phase: "UNPUBLISHED", liveNow: false, checkedAt: Date.now()/1000, error: "" };
    const status = { facebook, armed: false, privacy: false, liveSinceS: 0, camera: { connected: false, kbps: 0, sinceS: 0, goneS: 0 }, obs: { connected: true, scene: "Ending", streaming: false, programReady: false, lastError: "" }, mediamtx: { ok: true }, destinations: { facebook: { enabled: false, configured: true, running: false, uptimeS: 0 }, youtube: { enabled: false, configured: true, running: false, uptimeS: 0 }, tiktok: { enabled: false, configured: false, running: false, uptimeS: 0 } }, cameras: [], limits: { camGoneEndMin: 15, maxStreamMin: 480, brbAfterS: 5 }, ingest: { url: "test", keyTail: "test" }, studio: { online: true, ageS: 0, studioRunning: false, obsRunning: true, host: "test" }, events: [] };
    let mutations = 0;
    let chatStage = 0;
    const commands: { path: string; body: unknown }[] = [];
    const stamp = Math.floor(Date.now()/1000);
    const feeds = [
      { epoch: "first", sources: { fb: "facebook:page:old", yt: "youtube:old" }, items: [{ id: 1, p: "fb", t: stamp, u: "Facebook viewer", m: "First Facebook message", source: "facebook:page:old", eventId: "comment1", k: "chat" }, { id: 2, p: "yt", t: stamp, u: "YouTube viewer", m: "YouTube message", source: "youtube:old", eventId: "yt1", k: "chat" }], last: 2 },
      { epoch: "second", reset: true, sources: { fb: "facebook:page:new", yt: "youtube:old" }, items: [{ id: 1, p: "fb", t: stamp, u: "New viewer", m: "New show message", source: "facebook:page:new", eventId: "comment2", k: "chat" }], last: 1 },
    ];
    await page.route("**/api/stream/**", async route => {
      if (route.request().method() !== "GET") { mutations++; commands.push({ path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() }); }
      await route.fulfill({ json: route.request().url().includes("/chat") ? { ...feeds[chatStage], facebook: { ...facebook, connected: true } } : status });
    });
    await page.route("**/api/stream-lineup", route => route.fulfill({ json: { active: null } }));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/stream", { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.getByRole("link", { name: "Show Assistant · Classic", exact: true }).waitFor();
    await page.getByRole("link", { name: "Inventory Assistant · V2", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Inventory Assistant · V2", exact: true }).getAttribute("href"), "/api/stream/whatnot-bot-v2/admin");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: "/tmp/stream-assistant-buttons-mobile.png", fullPage: true });
    assert.equal(mutations, 0, "Opening controls must not start assistants or broadcast");
    assert.deepEqual(errors, []);
    console.log("Assistant owner/MFA gate, chooser links, separate buttons, mobile layout and zero mutations: passed");
  } finally { await browser.close(); await prisma.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
