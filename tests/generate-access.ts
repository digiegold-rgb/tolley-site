/** Real credentials + MFA + Generate API regression, isolated local DB only. No paid requests. */
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { defaultJobCard } from "../lib/generate-job-card";
import { emptyMotionCard } from "../lib/generate-motion-card";
import { planLongformQueue } from "../lib/generate-longform";
import { planCinemaQueue } from "../lib/generate-cinema";

async function main() {
  const db = process.env.DATABASE_URL || "";
  assert.match(db, /^postgresql:\/\/postgres@127\.0\.0\.1:55438\/tolley_revenue_test$/);
  const base = process.env.GENERATE_TEST_URL || "http://localhost:3034";
  assert.match(base, /^http:\/\/localhost:3034$/);
  const prisma = new PrismaClient();
  const email = `generate-test-${randomUUID()}@example.test`, password = randomUUID();
  const user = await prisma.user.create({ data: { email, name: "Generate local test", credentialAuth: { create: { passwordHash: await hashPassword(password) } } } });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.setDefaultNavigationTimeout(120_000);
  try {
    await prisma.vaterAccount.create({ data: { userId: user.id, tier: "owner" } });
    // A known disposable enrollment, used only in this isolated fixture.
    await prisma.userMfa.create({ data: { userId: user.id, totpSecret: "JBSWY3DPEHPK3PXP", verified: true, enabledAt: new Date() } });
    const denied = await context.request.get(`${base}/api/generate/access`);
    assert.equal(denied.status(), 401); assert.equal((await denied.json()).code, "LOGIN_REQUIRED");
    console.log("PASS signed-out API gate; opening form");
    await page.goto(`${base}/generate`);
    await expect(page.getByRole("link", { name: "Sign in to Generate ↗", exact: true })).toBeVisible({ timeout: 120_000 });
    await page.getByRole("button", { name: "Start this workflow" }).click();
    await page.getByLabel("Your prompt", { exact: true }).fill("A ceramic vase. Preserve this draft through login.");
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("link", { name: "Sign in to Generate ↗", exact: true }).click();
    const login = await popupPromise;
    console.log("Opened login tab");
    login.setDefaultTimeout(60_000);
    await expect(login.getByRole("heading", { name: "Sign in to Generate", exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(login.getByRole("button", { name: "Sign In", exact: true })).toBeEnabled({ timeout: 60_000 });
    await login.locator('input[type="email"]').fill(email);
    await login.locator('input[type="password"]').fill(password);
    await login.locator('form').filter({ has: login.locator('input[type="password"]') }).getByRole("button", { name: /sign in/i }).click();
    console.log("Submitted authentication form");
    await login.waitForURL(`${base}/generate`, { timeout: 60_000, waitUntil: "domcontentloaded" });
    const mfa = await context.request.get(`${base}/api/generate/access`);
    assert.equal(mfa.status(), 403); assert.equal((await mfa.json()).code, "MFA_REQUIRED");
    await expect(login.getByRole("link", { name: "Complete two-factor ↗" })).toBeVisible({ timeout: 60_000 });
    const challengeUrl = await login.getByRole("link", { name: "Complete two-factor ↗" }).getAttribute("href");
    await login.goto(`${base}${challengeUrl}`);
    const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
    const digest = createHmac("sha1", Buffer.from("48656c6c6f21deadbeef", "hex")).update(counter).digest();
    const offset = digest[digest.length - 1] & 15;
    const code = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
    await login.getByPlaceholder("000000").fill(code);
    const verificationResponse = login.waitForResponse(r => r.url().includes("/api/auth/mfa/verify"));
    await login.getByRole("button", { name: "Verify", exact: true }).click();
    const verification = await verificationResponse;
    assert.equal(verification.status(), 200, verification.status() === 200 ? undefined : JSON.stringify(await verification.json()));
    console.log("PASS real credentials and TOTP verification");
    await login.waitForURL(`${base}/generate`, { timeout: 60_000, waitUntil: "domcontentloaded" });
    const allowed = await context.request.get(`${base}/api/generate/access`);
    assert.equal(allowed.status(), 200); assert.equal((await allowed.json()).authenticated, true);
    await page.bringToFront();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByText("Signed in · owner access", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByLabel("Your prompt", { exact: true })).toHaveValue("A ceramic vase. Preserve this draft through login.");
    async function post(path: string, data: Record<string, unknown>) {
      assert.equal(data.dryRun, true, "Every generation request in this test must be a dry run");
      const response = await context.request.post(`${base}${path}`, { data });
      const json = await response.json();
      assert.equal(response.status(), 200, `${path}: ${JSON.stringify(json).slice(0, 800)}`);
      assert.equal(json.dryRun, true); return json;
    }
    for (const [kind, model] of [["t2i", "flux-dev"], ["t2i", "flux-schnell"], ["t2v", "wan26-720p"], ["t2v", "wan30-t2v"]]) {
      await post("/api/generate/jobs", { kind, prompt: "A ceramic vase on a table", card: { model, prompt: "A ceramic vase on a table" }, dryRun: true });
    }
    for (const model of ["qwen-modal", "qwen-edit", "flux2-edit"] as const) {
      const card = { ...defaultJobCard(null, {}), model, prompt: "Portrait of the adult in the reference", identity_ref_urls: ["https://example.com/reference.png"], num_images: 3 };
      const result = await post("/api/generate/jobs", { kind: "modal", card, dryRun: true });
      if (model !== "qwen-modal") {
        assert.equal(result.fal_model, model); assert.equal(result.fal_input.num_images, 3);
        const stored = await prisma.generateJob.findUniqueOrThrow({ where: { id: result.job.id } });
        assert.equal((stored.cardJson as { fal_model: string }).fal_model, model);
      }
    }
    for (const kind of ["i2v", "motion"]) for (const model of ["wan-legacy", "wan30-i2v"] as const) {
      await post("/api/generate/jobs", { kind, card: { ...emptyMotionCard(), model, prompt: "Camera slowly pans", source_image_url: "https://example.com/source.png" }, dryRun: true });
    }
    const longform = planLongformQueue({ sourceImageUrl: "https://example.com/source.png", script: "Camera moves slowly", targetSeconds: 10, beatSeconds: 5 });
    await post("/api/generate/longform", { action: "generate-next", queue: longform, dryRun: true });
    for (const model of ["seedance", "kling"] as const) {
      const queue = planCinemaQueue({ imageUrls: ["https://example.com/source.png"], script: "Camera moves slowly", model });
      await post("/api/generate/cinema", { action: "generate-next", queue, dryRun: true });
    }
    // A valid signed-in account without owner entitlement must still be rejected.
    await prisma.vaterAccount.update({ where: { userId: user.id }, data: { tier: "public" } });
    const forbidden = await context.request.get(`${base}/api/generate/access`);
    assert.equal(forbidden.status(), 403); assert.equal((await forbidden.json()).code, "FORBIDDEN");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("link", { name: "Sign out / switch account ↗" })).toHaveAttribute("href", "/logout", { timeout: 60_000 });
    console.log("PASS real owner credentials → MFA → automatic access refresh with draft preserved; all seven workflows and model variants accept real API dry runs; non-owner blocked.");
  } finally {
    await browser.close();
    await prisma.generateJob.deleteMany({ where: { createdBy: email } });
    await prisma.rateLimitBucket.deleteMany({ where: { OR: [{ key: { contains: email } }, { key: { contains: user.id } }] } });
    await prisma.vaterAccount.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
