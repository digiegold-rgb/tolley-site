import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import { prisma } from "../../lib/prisma";
import { enrollmentKey, signMfaProof } from "../../lib/auth/mfa-proof";

async function main() {
  assert.equal(process.env.DATABASE_URL, "postgresql://postgres@127.0.0.1:55438/tolley_live_growth_test");
  const base = process.env.STREAM_TEST_URL || "http://127.0.0.1:3065";
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  context.setDefaultTimeout(180000);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  async function signIn(email: string, mfaVerified: boolean) {
    await context.clearCookies();
    const user = await prisma.user.upsert({ where: { email }, create: { email }, update: {} });
    const mfa = await prisma.userMfa.upsert({ where: { userId: user.id }, create: { userId: user.id, verified: true, totpSecret: "test-only" }, update: { verified: true } });
    const session = `mac-mini-${user.id}`, now = Math.floor(Date.now() / 1000);
    const token = await encode({ secret: process.env.AUTH_SECRET!, salt: "authjs.session-token", token: { sub: user.id, email, authSessionId: session, authAt: now, sv: user.sessionVersion, svAt: now }, maxAge: 3600 });
    await context.addCookies([{ name: "authjs.session-token", value: token, domain: "127.0.0.1", path: "/" }]);
    if (mfaVerified) await context.addCookies([{ name: "tolley_mfa", value: signMfaProof(user.id, session, enrollmentKey(mfa)), domain: "127.0.0.1", path: "/" }]);
  }
  async function blockedDownload() {
    const response = await context.request.get(base + "/api/stream/mac-mini-setup", { maxRedirects: 0, timeout: 180000 });
    assert.ok([401, 403, 307].includes(response.status()), `Unexpected download status ${response.status()}`);
    assert.ok(!(await response.text()).includes("Tolley Mac mini bootstrap"), "Setup must not leak through the download endpoint");
  }
  try {
    await blockedDownload();
    await page.goto(base + "/stream/mac-mini", { waitUntil: "domcontentloaded", timeout: 180000 });
    assert.match(page.url(), /\/login/);
    await signIn("mac-mini-hub@tolley.invalid", false);
    await blockedDownload();
    await signIn("mac-mini-nonowner@tolley.invalid", true);
    await blockedDownload();
    await signIn("mac-mini-hub@tolley.invalid", true);
    await page.goto(base + "/stream/mac-mini", { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.getByRole("heading", { name: "Mac mini control hub", exact: true }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Open Show Assistant →", exact: true }).getAttribute("href"), "/stream/assistant");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: "/tmp/tolley-mac-mini-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const response = await context.request.get(base + "/api/stream/mac-mini-setup", { timeout: 180000 });
    assert.equal(response.status(), 200);
    assert.equal(response.headers()["cache-control"], "private, no-store");
    assert.match(response.headers()["content-disposition"], /attachment; filename="Tolley-Mac-Mini-Setup.command"/);
    assert.equal(await response.text(), await readFile("ops/stream/mac-mini-hub/Tolley-Mac-Mini-Setup.command", "utf8"));
    assert.deepEqual(errors, []);
    console.log("Anonymous, missing-MFA and nonowner downloads blocked; owner page, exact setup download and mobile/desktop layout passed.");
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
