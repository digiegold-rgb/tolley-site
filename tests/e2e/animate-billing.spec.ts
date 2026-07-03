/**
 * Animate Studio — pay-per-video billing e2e (2D).
 *
 * Proves the thing being SOLD end-to-end: a stranger can sign up, reach the
 * studio, and the money logic (budget gate + usage recording) behaves exactly
 * as intended for trialing / capped / past_due states.
 *
 * Runs against a LOCAL dev server (npm run dev on :3210) pointed at the prod
 * Neon DB, with the DGX autopilot STUBBED (AUTOPILOT_URL → local stub) so no
 * real GPU/Modal cost is incurred, and Stripe left untouched — every path
 * exercised here is the TRIAL path (no card), so recordUsage never calls
 * Stripe. No LIVE Stripe object is ever created.
 *
 * Env expected:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3210
 *   DATABASE_URL=<prod Neon>          (for the seed/assert prisma client)
 *   E2E_SHOT_DIR=/home/jelly/Shared/animate-e2e   (screenshots)
 *
 * The dev server must be started with AUTOPILOT_URL pointed at the stub and a
 * dummy STRIPE_SECRET_KEY (defense-in-depth). See run-animate-billing-e2e.sh.
 */
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

const SHOT_DIR = process.env.E2E_SHOT_DIR || "/home/jelly/Shared/animate-e2e";
const STAMP = Date.now();
const TEST_EMAIL = `e2e-billing-test+${STAMP}@tolley.io`;
const TEST_PASSWORD = "e2e-Pass-word-123";

function shot(name: string) {
  return join(SHOT_DIR, `${String(STAMP)}-${name}.png`);
}

test.describe.configure({ mode: "serial" });

test.describe("animate billing e2e", () => {
  let userId = "";
  let projectId = "";

  test.beforeAll(() => {
    mkdirSync(SHOT_DIR, { recursive: true });
  });

  test.afterAll(async () => {
    // Clean up everything this run created. Reported in the harness log too.
    if (userId) {
      await prisma.vaterUsage.deleteMany({ where: { userId } });
      await prisma.vaterTrialUsage.deleteMany({ where: { userId } });
      await prisma.vaterSubscription.deleteMany({ where: { userId } });
      await prisma.vaterMonthlyLimit.deleteMany({ where: { userId } }).catch(() => {});
      if (projectId) {
        await prisma.youTubeProject.deleteMany({ where: { id: projectId } });
      }
      await prisma.credentialAuth.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
    await prisma.$disconnect();
    // Surface the ids so the harness/report can double-check cleanup.
    console.log(
      `[e2e-cleanup] email=${TEST_EMAIL} userId=${userId || "(none)"} projectId=${projectId || "(none)"}`,
    );
  });

  test("signup → studio → billing gates", async ({ page }) => {
    // ── 1. Fresh signup (also signs the user in) ──────────────────────────
    await page.goto("/signup?callbackUrl=%2Fanimate");
    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    const pw = page.locator('input[type="password"]');
    await pw.nth(0).fill(TEST_PASSWORD);
    await pw.nth(1).fill(TEST_PASSWORD);
    await page.screenshot({ path: shot("1-signup-filled") });
    await page.getByRole("button", { name: /create account/i }).click();

    // signup-form registers then signIn()s and router.push(callbackUrl).
    await page.waitForURL(/\/animate/, { timeout: 60_000 });

    // ── 2. Studio Shell renders for the authed stranger ───────────────────
    // /animate renders <AnimateLanding> for signed-out, <Shell> for signed-in.
    // Give the client shell a moment to hydrate, then snapshot.
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.screenshot({ path: shot("2-studio-loaded"), fullPage: true });

    // Resolve the freshly-created user id from the DB.
    const user = await prisma.user.findUnique({
      where: { email: TEST_EMAIL },
      select: { id: true },
    });
    expect(user, "signup should have created a User row").toBeTruthy();
    userId = user!.id;

    // Sanity: a brand-new user has no subscription (pure trial state).
    const sub0 = await prisma.vaterSubscription.findUnique({ where: { userId } });
    expect(sub0, "new user should start with no subscription (trial)").toBeNull();

    // ── 3. Seed a project owned by the test user (skip the fetch-source
    //       pipeline — we only need a row to animate against). ─────────────
    const project = await prisma.youTubeProject.create({
      data: {
        userId,
        topic: "E2E billing test project",
        sourceTitle: "E2E billing test project",
        status: "ready",
        autopilotJobId: "stub-pipeline-job-0001",
        scenesJson: [
          {
            idx: 0,
            imageUrl: "/vater/file/stub/scene/0",
            startS: 0,
            endS: 5,
            beatText: "e2e",
            imagePrompt: "e2e test scene",
            version: 0,
            overlays: [],
          },
        ] as unknown as object,
      },
      select: { id: true },
    });
    projectId = project.id;

    // ── 4a. Trialing user is ALLOWED the first animation, and it records
    //        exactly one VaterUsage row (via the stubbed DGX). ─────────────
    const animateUrl = `/api/vater/youtube/${projectId}/scene/animate`;
    const r1 = await page.request.post(animateUrl, {
      data: { sceneIdx: 0, animationPrompt: "gentle zoom", quality: "modal-wan22" },
    });
    const r1body = await r1.json().catch(() => ({}));
    expect(
      r1.status(),
      `first animation should succeed for a trial user (got ${r1.status()}: ${JSON.stringify(r1body)})`,
    ).toBe(200);
    expect(r1body.billing?.isTrial, "first animation should be on the trial").toBe(true);

    const usageRows = await prisma.vaterUsage.findMany({
      where: { userId, action: "animation" },
    });
    expect(usageRows.length, "exactly one usage row recorded").toBe(1);
    const idemKey = usageRows[0].idempotencyKey;
    expect(idemKey, "usage row must carry the idempotency key").toBeTruthy();
    // Trial usage must NOT touch Stripe.
    expect(usageRows[0].stripeInvoiceItemId, "trial usage has no Stripe item").toBeNull();

    // ── 4b. recordUsage idempotency: a second write with the SAME key is a
    //        no-op (unique constraint) — assert the ledger stays at 1 row.
    await prisma
      .$executeRawUnsafe(
        `INSERT INTO "VaterUsage" (id, "userId", action, "costCents", "idempotencyKey", ts)
         VALUES ($1,$2,'animation',150,$3, now())`,
        `dup-${STAMP}`,
        userId,
        idemKey,
      )
      .then(
        () => {
          throw new Error("duplicate idempotencyKey insert should have failed");
        },
        () => {
          /* expected unique-violation — idempotency holds */
        },
      );
    const afterDup = await prisma.vaterUsage.count({
      where: { userId, action: "animation" },
    });
    expect(afterDup, "idempotency: still exactly one row").toBe(1);

    // ── 4c. Trial cap: animation cap is 1 — the SECOND animation is blocked
    //        with 402 trial_cap_reached (gate fires before any DGX work). ──
    const r2 = await page.request.post(animateUrl, {
      data: { sceneIdx: 0, animationPrompt: "another", quality: "modal-wan22" },
    });
    const r2body = await r2.json().catch(() => ({}));
    expect(r2.status(), "second animation blocked by trial cap").toBe(402);
    expect(r2body.budget?.reason).toBe("trial_cap_reached");

    // ── 4d. past_due: give the user a delinquent subscription and assert the
    //        gate returns 402 payment_past_due. No Stripe customer → no live
    //        Stripe call. ─────────────────────────────────────────────────
    await prisma.vaterSubscription.create({
      data: { userId, status: "past_due" },
    });
    const r3 = await page.request.post(animateUrl, {
      data: { sceneIdx: 0, animationPrompt: "past due", quality: "modal-wan22" },
    });
    const r3body = await r3.json().catch(() => ({}));
    expect(r3.status(), "past_due user is blocked").toBe(402);
    expect(r3body.budget?.reason).toBe("payment_past_due");

    await page.screenshot({ path: shot("3-final") });
  });
});
