/**
 * Listing Studio — 5-step wizard e2e (tolley.io/realestateanimated).
 *
 * Proves the thing being SOLD: a fresh agent signs up through the real-estate
 * front door, walks Photo → Address → Details → Video type → Look & price,
 * pays through MoneyConfirmModal at LIST price, approves the staged still,
 * and gets a ready video — and the money logic wrote exactly one ledger
 * debit `re:before_after:<listingJobId>`. The second test forces the render
 * to fail and asserts the refund row `refund:<listingJobId>`.
 *
 * Pattern: vater-v2-3click.spec.ts (auth / storage state) + animate-billing
 * .spec.ts (prisma seed + assert + cleanup).
 *
 * ── HOW TO RUN ─────────────────────────────────────────────────────────────
 * The DGX is STUBBED via lib/vater/autopilot-client.ts — the dev server must
 * be started with LISTING_RENDER_STUB set, and the SAME value passed to the
 * Playwright process so the spec knows which test applies:
 *
 *   # happy path (stage → approve → ready, ledger debit)
 *   LISTING_RENDER_STUB=1 PORT=3210 npm run dev -- --webpack &
 *   LISTING_RENDER_STUB=1 PLAYWRIGHT_BASE_URL=http://localhost:3210 \
 *     DATABASE_URL=<neon> npx playwright test tests/e2e/listing-wizard.spec.ts --reporter=list
 *
 *   # refund path (staging fails with errorCode=moderation → refund row)
 *   LISTING_RENDER_STUB=fail PORT=3210 npm run dev -- --webpack &
 *   LISTING_RENDER_STUB=fail PLAYWRIGHT_BASE_URL=http://localhost:3210 \
 *     DATABASE_URL=<neon> npx playwright test tests/e2e/listing-wizard.spec.ts --reporter=list
 *
 * Both runs create a throwaway user (e2e-listing+<stamp>@tolley.io) via the
 * register API with a minted BetaInvite (studio signups are invite-only), seed a
 * $50 PURCHASE ledger row (the $10 starter grant is stills-only and cannot
 * fund a video SKU), and delete everything they created in afterAll.
 * Stripe is never touched. Requires the ListingJob + VaterAccount origin
 * migrations to be applied (routes answer FEATURE_NOT_READY otherwise).
 */
import { test, expect as baseExpect, type Page } from "@playwright/test";

// Dev-mode compiles of a route can take 30–90 s on a loaded box; every
// assertion that may be the first hit on a route gets that much headroom.
const expect = baseExpect.configure({ timeout: 120_000 });
import { PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { TOS_VERSION } from "../../lib/legal-animate";

const prisma = new PrismaClient();
// The ListingJob model is added by a hand-applied migration; keep the client
// access loose so this spec compiles before `prisma generate` picks it up.
const db = prisma as unknown as {
  listingJob: { deleteMany: (a: { where: { userId: string } }) => Promise<unknown> };
  vaterAccount: { deleteMany: (a: { where: { userId: string } }) => Promise<unknown> };
};

const STUB = process.env.LISTING_RENDER_STUB ?? "";
const SHOT_DIR = process.env.E2E_SHOT_DIR || "/home/jelly/Shared/listing-e2e";
const STAMP = Date.now();
const TEST_EMAIL = `e2e-listing+${STAMP}@tolley.io`;
const TEST_PASSWORD = "e2e-Pass-word-123";
const HOME = "/realestateanimated";
const SEED_PURCHASE_CENTS = 5000;
/** Studio signups are invite-only (app/api/auth/register): mint one for this run. */
const INVITE_CODE = `E2E${String(STAMP).slice(-9)}`.toUpperCase();

/** 1×1 PNG — enough for /api/vater/upload to accept an image/png file. */
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function shot(name: string) {
  return join(SHOT_DIR, `${String(STAMP)}-${name}.png`);
}

test.describe.configure({ mode: "serial" });

test.describe("listing wizard e2e", () => {
  let userId = "";
  let listingJobId = "";

  test.beforeAll(async ({ request }) => {
    mkdirSync(SHOT_DIR, { recursive: true });
    test.skip(!STUB, "Set LISTING_RENDER_STUB=1 (or =fail) on BOTH the dev server and this process.");
    // Warm every API route the flow touches BEFORE any page is open.
    // Next dev (webpack) sometimes skips compiling a route that is first hit
    // while other compiles are running and then serves an HTML 404 for it
    // until the file is touched; an unauthenticated warm-up hit compiles it
    // (401 JSON = live). Warming while a page is open would HMR-reload it.
    const apiPaths = [
      "/api/auth/providers",
      "/api/auth/csrf",
      "/api/auth/session",
      "/api/vater/me",
      "/api/vater/billing/status",
      "/api/vater/billing/credits",
      "/api/vater/listing",
      "/api/vater/listing/warmup",
      "/api/vater/listing/warmup/preflight",
      "/api/vater/listing/warmup/poll",
      "/api/vater/listing/warmup/mls-export",
    ];
    for (const path of apiPaths) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const r = await request.get(path, { timeout: 240_000 }).catch(() => null);
        const ct = r?.headers()["content-type"] ?? "";
        if (r && r.status() !== 404 && !ct.includes("text/html")) break;
        console.log(`[e2e] warm-up ${path} → ${r?.status() ?? "no response"} (${ct}) — attempt ${attempt}`);
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
    for (const path of ["/api/vater/listing/warmup/stage", "/api/vater/listing/warmup/approve-still", "/api/vater/listing/warmup/restage", "/api/vater/listing/property-image", "/api/vater/listing/verify-license", "/api/vater/upload"]) {
      await request.post(path, { data: {}, timeout: 240_000 }).catch(() => {});
    }
    await request.get(HOME, { timeout: 240_000 }).catch(() => {});
    await request.get(`/login?callbackUrl=${encodeURIComponent(HOME)}`, { timeout: 240_000 }).catch(() => {});
  });

  test.afterAll(async () => {
    await prisma.betaInvite.deleteMany({ where: { code: INVITE_CODE } }).catch(() => {});
    if (userId) {
      await db.listingJob.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.vaterCreditLedger.deleteMany({ where: { userId } }).catch(() => {});
      await db.vaterAccount.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.vaterSubscription.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.credentialAuth.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log(`[e2e-cleanup] email=${TEST_EMAIL} userId=${userId || "(none)"} listingJobId=${listingJobId || "(none)"}`);
  });

  /**
   * Fresh account through the real-estate front door (POST /api/auth/register
   * with the minted invite + callbackUrl → VaterAccount.origin='realestate'),
   * then a UI sign-in on /login and a seeded credit purchase.
   */
  async function signupAndSeed(page: Page) {
    page.on("pageerror", (err) => console.log(`[e2e] pageerror: ${err.message.slice(0, 200)}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log(`[e2e] console.error: ${msg.text().slice(0, 200)}`);
    });
    await prisma.betaInvite.create({
      data: { code: INVITE_CODE, email: TEST_EMAIL.toLowerCase(), maxUses: 1, usedCount: 0, createdBy: "e2e", note: "listing-wizard e2e" },
    });
    const reg = await page.request.post("/api/auth/register", {
      // The real click-wrap stamp — otherwise BetaGate's terms dialog covers the wizard.
      data: { email: TEST_EMAIL, password: TEST_PASSWORD, callbackUrl: HOME, invite: INVITE_CODE, termsVersion: TOS_VERSION },
      timeout: 120_000,
    });
    expect(reg.ok(), `register should succeed: ${reg.status()} ${await reg.text().catch(() => "")}`).toBe(true);

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL }, select: { id: true } });
    expect(user, "register should have created a User row").toBeTruthy();
    userId = user!.id;

    // Purchased credit — video SKUs are `animation` budget actions, which the
    // stills-only starter grant cannot fund.
    await prisma.vaterCreditLedger.create({
      data: {
        userId,
        deltaCents: SEED_PURCHASE_CENTS,
        kind: "purchase",
        dedupeKey: `e2e:listing:purchase:${STAMP}`,
        note: "e2e listing wizard seed",
      },
    });

    // In dev the click can land before React hydrates, in which case the form
    // does a native GET submit to "/login?" (callbackUrl lost). Wait for the
    // network to settle, and retry when that happens.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await page.goto(`/login?callbackUrl=${encodeURIComponent(HOME)}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1500);
      await page.locator('input[type="email"]').fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
      // First signed-in render compiles the studio Shell in dev — be generous.
      const landed = await page
        .waitForURL((u) => u.pathname.startsWith(HOME) || u.search === "?" || /\/login\?$/.test(u.href), { timeout: 300_000 })
        .then(() => page.url().includes(HOME))
        .catch(() => false);
      if (landed) return;
      console.log(`[e2e] sign-in attempt ${attempt} did not land on ${HOME} (url=${page.url()}) — retrying`);
    }
    throw new Error("Could not sign in through /login after 3 attempts");
  }

  /** Steps 1–5 up to and including the MoneyConfirm click. Returns the listing id. */
  async function walkToPay(page: Page): Promise<string> {
    // Surface every failed listing API call in the test log — the wizard shows
    // a friendly banner, which hides the server's actual status/body.
    page.on("response", (res) => {
      if (/\/api\/vater\/(listing|me|upload)/.test(res.url()) && !res.ok()) {
        void res.text().then((body) => console.log(`[e2e] ${res.request().method()} ${res.url()} → ${res.status()} ${body.slice(0, 300)}`)).catch(() => {});
      }
    });
    // ── 1 Photo ──
    // Dev-mode webpack occasionally answers a page with a half-written
    // manifest (a 500 "Unexpected end of JSON input"); a reload clears it.
    let stepOneVisible = false;
    for (let attempt = 1; attempt <= 3 && !stepOneVisible; attempt += 1) {
      await page.goto(`${HOME}#r=listing`);
      await page.waitForLoadState("networkidle").catch(() => {});
      stepOneVisible = await page
        .getByTestId("listing-step-1")
        .waitFor({ state: "visible", timeout: 120_000 })
        .then(() => true)
        .catch(() => false);
      if (!stepOneVisible) console.log(`[e2e] wizard step 1 not visible on attempt ${attempt} (url=${page.url()}) — reloading`);
    }
    // Belt and braces: if the click-wrap dialog is up anyway, accept it.
    const termsBtn = page.getByTestId("terms-accept-button");
    if (await termsBtn.isVisible().catch(() => false)) {
      await page.getByTestId("terms-accept-checkbox").check().catch(() => {});
      await termsBtn.click();
      await expect(termsBtn).toBeHidden();
    }
    await expect(page.getByTestId("listing-step-1")).toBeVisible();
    await page.waitForFunction(() => new URLSearchParams(location.hash.slice(1)).get("p"), null, { timeout: 120_000 });
    const id = await page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get("p") as string);
    expect(id, "draft id must be in the hash").toBeTruthy();
    await page.getByTestId("listing-upload").setInputFiles({ name: "room.png", mimeType: "image/png", buffer: PNG_1x1 });
    await expect(page.getByTestId("listing-photo-preview")).toBeVisible();
    await page.screenshot({ path: shot("1-photo") });
    await page.getByTestId("listing-next").click();

    // ── 2 Address ──
    await expect(page.getByTestId("listing-step-2")).toBeVisible();
    await page.getByTestId("listing-address").fill("123 E2E Test St");
    await page.getByTestId("listing-city").fill("Independence");
    await page.getByTestId("listing-state").selectOption("MO");
    await page.getByTestId("listing-zip").fill("64050");
    await expect(page.getByTestId("listing-state-rule")).toContainText(/Missouri/);
    await page.screenshot({ path: shot("2-address") });
    await page.getByTestId("listing-next").click();

    // ── 3 Details + agent profile ──
    await expect(page.getByTestId("listing-step-3")).toBeVisible();
    await page.getByTestId("listing-beds").fill("3");
    await page.getByTestId("listing-baths").fill("2");
    await page.getByTestId("listing-sqft").fill("1800");
    await page.getByTestId("listing-feature-updated-kitchen").click();
    // Fair-Housing WARN chip shows for risky-but-fixable wording, and Fix it clears it.
    await page.getByTestId("listing-notes").fill("Cozy ranch with a great master bedroom.");
    const warn = page.getByTestId("listing-fh-warning").first();
    if (await warn.count()) {
      await warn.click();
      await expect(page.getByTestId("listing-fh-warning")).toHaveCount(0);
    }
    const profileName = page.getByTestId("listing-profile-name");
    if (!(await profileName.isVisible().catch(() => false))) {
      await page.getByTestId("listing-profile-toggle").click();
    }
    await profileName.fill("E2E Agent");
    await page.getByTestId("listing-profile-phone").fill("8165550100");
    await page.getByTestId("listing-profile-broker").fill("Your KC Homes LLC");
    await page.getByTestId("listing-profile-broker-phone").fill("8165550101");
    await page.getByTestId("listing-profile-save").click();
    await expect(page.getByTestId("listing-agent-profile")).toContainText(/Saved\.|Complete/, { timeout: 30_000 });
    await page.screenshot({ path: shot("3-details") });
    await page.getByTestId("listing-next").click();

    // ── 4 Video type ──
    await expect(page.getByTestId("listing-step-4")).toBeVisible();
    await page.getByTestId("listing-sku-before_after").click();
    await expect(page.getByTestId("listing-material-change-note")).toBeVisible();
    await page.screenshot({ path: shot("4-type") });
    await page.getByTestId("listing-next").click();

    // ── 5 Look & price → MoneyConfirm ──
    await expect(page.getByTestId("listing-step-5")).toBeVisible();
    await page.getByTestId("listing-look-photoreal").click();
    await expect(page.getByTestId("listing-price-ticket")).toContainText("$29.00");
    // Pay → preflight → MoneyConfirm. In dev a first hit on /preflight can
    // come back as an HTML 404 (route not compiled yet); the wizard shows a
    // retryable error, so press Pay again.
    const confirm = page.getByTestId("money-confirm-submit");
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await page.getByTestId("listing-pay").click();
      const shown = await confirm.waitFor({ state: "visible", timeout: 90_000 }).then(() => true).catch(() => false);
      if (shown) break;
      console.log(`[e2e] MoneyConfirm not shown after Pay (attempt ${attempt}) — retrying`);
    }
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText(/\$29(\.00)?\b/);
    await page.screenshot({ path: shot("5-money-confirm") });
    await confirm.click();
    return id;
  }

  test("stage → approve → ready, one ledger debit re:before_after:<id>", async ({ page }) => {
    test.skip(STUB === "fail", "This is the happy-path run; LISTING_RENDER_STUB=fail runs the refund test instead.");
    await signupAndSeed(page);
    listingJobId = await walkToPay(page);

    // Staging (stub resolves on the 2nd poll → awaiting_approval)
    await expect(page.getByTestId("listing-progress")).toBeVisible();
    const approve = page.getByTestId("listing-approve-still");
    await expect(approve).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("listing-staged-still")).toBeVisible();
    await page.screenshot({ path: shot("6-approval"), fullPage: true });
    await approve.click();

    // Filming → ready (2nd poll again)
    await expect(page.getByTestId("listing-ready")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("listing-video")).toBeVisible();
    await page.screenshot({ path: shot("7-ready"), fullPage: true });

    // ── Ledger: exactly one debit for this job at LIST price ──
    const debit = await prisma.vaterCreditLedger.findUnique({ where: { dedupeKey: `re:before_after:${listingJobId}` } });
    expect(debit, "one debit row keyed re:before_after:<id>").toBeTruthy();
    expect(debit!.userId).toBe(userId);
    expect(debit!.kind).toBe("debit");
    expect(debit!.deltaCents, "debited at the $29 list price").toBe(-2900);
    const refund = await prisma.vaterCreditLedger.findUnique({ where: { dedupeKey: `refund:${listingJobId}` } });
    expect(refund, "no refund on the happy path").toBeNull();
  });

  test("forced failure → refund:<id> row, refund note + support strip", async ({ page }) => {
    test.skip(STUB !== "fail", "Run with LISTING_RENDER_STUB=fail on the dev server AND this process.");
    await signupAndSeed(page);
    listingJobId = await walkToPay(page);

    await expect(page.getByTestId("listing-failed")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("listing-refund-note")).toContainText(/not charged/i);
    await expect(page.getByTestId("listing-support-strip")).toBeVisible();
    await page.screenshot({ path: shot("6-failed"), fullPage: true });

    const debit = await prisma.vaterCreditLedger.findUnique({ where: { dedupeKey: `re:before_after:${listingJobId}` } });
    expect(debit, "the debit was booked at /stage").toBeTruthy();
    const refund = await prisma.vaterCreditLedger.findUnique({ where: { dedupeKey: `refund:${listingJobId}` } });
    expect(refund, "refund row keyed refund:<id>").toBeTruthy();
    expect(refund!.kind).toBe("refund");
    expect(refund!.deltaCents, "refund reverses the whole debit").toBe(-debit!.deltaCents);
  });
});
