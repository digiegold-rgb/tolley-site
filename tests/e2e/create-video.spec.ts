/**
 * Create Video — start-lane / import / slider e2e (tolley.io/animate).
 *
 * Investigation spec: walks the stepped Create screen (#r=create, 2026-08-28 —
 * the StylePickerModal survives only behind "Batch") the way a customer does and
 * asserts the things a customer would notice. Nothing here spends money —
 * "Transcribe & rewrite", "Generate" and "Animate" are never clicked; only the
 * free reads ("Get the text" → POST /api/vater/script/from-url) are exercised.
 *
 * ── HOW TO RUN ─────────────────────────────────────────────────────────────
 * Against an ISOLATED production copy (never the shared tree's `next dev`):
 *
 *   rsync -a --exclude node_modules --exclude .next ~/tolley-site/ /tmp/e2e-createvideo/
 *   cd /tmp/e2e-createvideo && ln -s ~/tolley-site/node_modules node_modules
 *   npx prisma generate
 *   AUTH_SECRET=<any> AUTH_TRUST_HOST=true AUTH_URL=http://localhost:3218 \
 *     npx next dev --webpack -p 3218 &
 *   PLAYWRIGHT_BASE_URL=http://localhost:3218 \
 *     npx playwright test tests/e2e/create-video.spec.ts --reporter=list
 *
 * ⚠️ `next build --webpack` + `next start` in the copy is NOT usable: every
 * route that returns a NextResponse answers 500 "No response is returned from
 * route handler" when node_modules is a symlink into the shared tree. Dev mode
 * in the copy is fine and is what these findings were taken from.
 *
 * ⚠️ Test 5 needs `VATER_STUDIO_ALLOWLIST_EMAILS=<the test email>` on the dev
 * server: #r=script-review is minTier 'studio' (lib/vater/nav-visibility.ts:59)
 * and /api/vater/me derives tier from that env allowlist, NOT VaterAccount.tier
 * (app/api/vater/me/route.ts:118).
 *
 * Creates a throwaway user (e2e-createvideo+<stamp>@tolley.io) with a minted
 * BetaInvite (studio signup is invite-only) and deletes it in afterAll.
 */
import { test, expect as baseExpect, type Page } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 60_000 });
import { PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { TOS_VERSION } from "../../lib/legal-animate";
import { hashPassword } from "../../lib/password";

const prisma = new PrismaClient();

const SHOT_DIR = process.env.E2E_SHOT_DIR || "/home/jelly/Shared/createvideo-e2e";
const STAMP = Date.now();
const TEST_EMAIL = `e2e-createvideo+${STAMP}@tolley.io`;
const TEST_PASSWORD = "e2e-Pass-word-123";
const HOME = "/animate";
/** Real, caption-bearing YouTube video supplied by the owner. */
const SOURCE_URL = "https://www.youtube.com/watch?v=1mIp0mUyCKU";

function shot(name: string) {
  return join(SHOT_DIR, `${String(STAMP)}-${name}.png`);
}

const consoleErrors: string[] = [];
const pageErrors: string[] = [];

function watch(page: Page) {
  page.on("pageerror", (e) => pageErrors.push(e.message.slice(0, 300)));
  page.on("console", (m) => {
    if (m.type() === "error" || /hydrat|unique "key"|Warning:/i.test(m.text())) {
      consoleErrors.push(`${m.type()}: ${m.text().slice(0, 300)}`);
    }
  });
}

// Not serial: a failing observation must not skip the remaining probes.

test.describe("create video", () => {
  let userId = "";
  let inviteId = "";
  let cookies: Awaited<ReturnType<import("@playwright/test").BrowserContext["cookies"]>> = [];

  /** Register once, sign in once, keep the cookies for every test. */
  test.beforeAll(async ({ browser }) => {
    mkdirSync(SHOT_DIR, { recursive: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await signIn(page);
    cookies = await ctx.cookies();
    await ctx.close();
  });

  test.afterAll(async () => {
    if (userId) {
      await prisma.$executeRaw`UPDATE "User" SET "betaInviteId" = NULL WHERE "id" = ${userId}`.catch(() => {});
      if (inviteId) await prisma.betaInvite.deleteMany({ where: { id: inviteId } }).catch(() => {});
      await (prisma as unknown as { vaterAccount: { deleteMany: (a: unknown) => Promise<unknown> } })
        .vaterAccount.deleteMany({ where: { userId } })
        .catch(() => {});
      await prisma.vaterCreditLedger.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.vaterSubscription.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.credentialAuth.deleteMany({ where: { userId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log(`\n[console-errors] ${consoleErrors.length}`);
    for (const e of [...new Set(consoleErrors)]) console.log(`  ${e}`);
    console.log(`[page-errors] ${pageErrors.length}`);
    for (const e of [...new Set(pageErrors)]) console.log(`  ${e}`);
    console.log(`[e2e-cleanup] email=${TEST_EMAIL} userId=${userId || "(none)"}`);
  });

  /**
   * Seed the account directly (the register route is IP rate-limited to 5/hr,
   * which a repeated investigation run burns through), then sign in on /login.
   */
  async function signIn(page: Page) {
    watch(page);
    const passwordHash = await hashPassword(TEST_PASSWORD);
    const user = await prisma.user.create({ data: { email: TEST_EMAIL.toLowerCase() } });
    userId = user.id;
    await prisma.credentialAuth.create({ data: { userId, passwordHash } });
    // BetaGate blocks any studio account with no redeemed invite (User.betaInviteId).
    const invite = await prisma.betaInvite.create({
      data: {
        code: `CV${String(STAMP).slice(-9)}`.toUpperCase(),
        email: TEST_EMAIL.toLowerCase(),
        maxUses: 1,
        usedCount: 1,
        createdBy: "e2e",
        note: "create-video e2e",
      },
    });
    inviteId = invite.id;
    await prisma.$executeRaw`UPDATE "User" SET "betaInviteId" = ${invite.id} WHERE "id" = ${userId}`;
    await prisma.$executeRaw`
      UPDATE "User" SET "termsAcceptedAt" = NOW(), "termsVersion" = ${TOS_VERSION} WHERE "id" = ${userId}
    `;
    await (prisma as unknown as {
      vaterAccount: { upsert: (a: unknown) => Promise<unknown> };
    }).vaterAccount
      .upsert({
        where: { userId },
        create: { userId, tier: "public", unmetered: false, notes: "create-video e2e" },
        update: {},
      })
      .catch(() => {});

    // API sign-in first (302 path) — the login form's redirect:false branch
    // returns no Response under a local `next start` on Node 22 (prod is
    // fine). Same recipe as tests/e2e/_studio-auth.ts.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const csrfRes = await page.request.get("/api/auth/csrf");
        const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
        await page.request.post("/api/auth/callback/credentials", {
          form: { csrfToken, email: TEST_EMAIL, password: TEST_PASSWORD, callbackUrl: HOME },
          maxRedirects: 0,
        });
        const session = (await (await page.request.get("/api/auth/session")).json().catch(() => null)) as
          | { user?: { id?: string } }
          | null;
        if (session?.user?.id) return;
        console.log(`[e2e] api sign-in attempt ${attempt} had no session`);
      } catch (err) {
        console.log(`[e2e] api sign-in threw: ${(err as Error).message.slice(0, 80)} — using the login form`);
        break;
      }
    }
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await page.goto(`/login?callbackUrl=${encodeURIComponent(HOME)}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1500);
      await page.locator('input[type="email"]').fill(TEST_EMAIL);
      await page.locator('input[type="password"]').fill(TEST_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();
      const landed = await page
        .waitForURL((u) => u.pathname.startsWith(HOME), { timeout: 300_000 })
        .then(() => true)
        .catch(() => false);
      if (landed) return;
      console.log(`[e2e] sign-in attempt ${attempt} landed on ${page.url()}`);
    }
    throw new Error("could not sign in");
  }

  /** /animate → "+ Create Video" → the Create screen (step 1, PathChooser). */
  async function openModal(page: Page) {
    await page.goto(HOME);
    await page.waitForLoadState("networkidle").catch(() => {});
    const termsBtn = page.getByTestId("terms-accept-button");
    if (await termsBtn.isVisible().catch(() => false)) {
      await page.getByTestId("terms-accept-checkbox").check().catch(() => {});
      await termsBtn.click();
    }
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await page.getByTestId("create-video").click({ timeout: 60_000 }).catch(() => {});
      const open = await page
        .getByTestId("path-own-script")
        .waitFor({ state: "visible", timeout: 60_000 })
        .then(() => true)
        .catch(() => false);
      if (open) return;
      console.log(`[e2e] create screen did not open on attempt ${attempt} — reloading`);
      await page.reload().catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
    }
    await expect(page.getByTestId("path-own-script")).toBeVisible();
  }

  test("1 — three start lanes render, select, and cycle with arrow keys", async ({ page }) => {
    await page.context().addCookies(cookies);
    watch(page);
    await openModal(page);

    const own = page.getByTestId("path-own-script");
    const video = page.getByTestId("path-from-video");
    const jelly = page.getByTestId("path-jelly-writes");
    for (const l of [own, video, jelly]) await expect(l).toBeVisible();

    // Default selection.
    const initial = await Promise.all(
      [own, video, jelly].map((l) => l.getAttribute("aria-checked")),
    );
    console.log(`[lanes] initial aria-checked own/video/jelly = ${initial.join("/")}`);

    // Click each lane; the clicked one must be the only checked one.
    for (const [name, lane] of [["own", own], ["video", video], ["jelly", jelly]] as const) {
      await lane.click();
      await expect(lane).toHaveAttribute("aria-checked", "true");
      const others = [own, video, jelly].filter((l) => l !== lane);
      for (const o of others) await expect(o).toHaveAttribute("aria-checked", "false");
      await expect(lane).toContainText("SELECTED");
      console.log(`[lanes] ${name} selects cleanly`);
    }

    // Arrow-key cycle from own: → video → jelly → own.
    await own.click();
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press("ArrowRight");
      const checked = await page.evaluate(() =>
        (document.querySelector('[role="radio"][aria-checked="true"]') as HTMLElement | null)
          ?.dataset.testid ?? "none",
      );
      seen.push(checked);
    }
    console.log(`[lanes] ArrowRight cycle = ${seen.join(" → ")}`);
    console.log(`[lanes] activeElement mid-cycle = ${await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid ?? document.activeElement?.tagName ?? "none")}`);
    expect.soft(seen).toEqual(["path-from-video", "path-jelly-writes", "path-own-script"]);

    // Where does keyboard focus sit after an arrow press? (a11y: the roving
    // tabindex should follow the selection in a radiogroup)
    const focused = await page.evaluate(
      () => (document.activeElement as HTMLElement | null)?.dataset.testid ?? document.activeElement?.tagName ?? "none",
    );
    console.log(`[lanes] activeElement after arrow keys = ${focused}`);
  });

  test("2 — Start from a video: Read the video lands a transcript on step 2", async ({ page }) => {
    await page.context().addCookies(cookies);
    watch(page);
    await openModal(page);
    await page.getByTestId("path-from-video").click();

    const url = page.getByTestId("own-script-import-url");
    await expect(url).toBeVisible();
    await url.fill(SOURCE_URL);
    await page.getByTestId("create-screen").screenshot({ path: shot("source-before-import") });

    const resp = page.waitForResponse((r) => r.url().includes("/api/vater/script/from-url"), {
      timeout: 180_000,
    });
    // Step 1 → 2: the read happens ON step 2 (auto-runs with the queued URL).
    await page.getByTestId("source-continue").click();
    await expect(page.getByTestId("create-screen")).toHaveAttribute("data-step", "2");
    const r = await resp;
    const body = await r.text().catch(() => "");
    console.log(`[import] POST from-url → ${r.status()} ${body.slice(0, 400)}`);

    const box = page.getByTestId("transcript-box");
    const note = page.getByTestId("own-script-import-note");
    const noteVisible = await note.isVisible({ timeout: 120_000 }).catch(() => false);
    const text = await box.inputValue().catch(() => "");
    console.log(`[import] note visible=${noteVisible} transcript words=${text.split(/\s+/).filter(Boolean).length}`);
    if (noteVisible) console.log(`[import] note = ${(await note.textContent())?.slice(0, 300)}`);
    await page.getByTestId("create-screen").screenshot({ path: shot("transcript-after-import") });
    expect.soft(text.length, "transcript should land in the box").toBeGreaterThan(50);
    await expect.soft(page.getByTestId("transcript-next")).toContainText("How long should your personalized video be?");
    // The row exists now; the hash carries it so a reload resumes here.
    await expect.soft(page).toHaveURL(/#r=create&s=2&p=/);
  });

  test("3 — length slider (step 3) updates the word figure", async ({ page }) => {
    await page.context().addCookies(cookies);
    watch(page);
    await openModal(page);
    await page.getByTestId("path-from-video").click();
    await page.getByTestId("own-script-import-url").fill(SOURCE_URL);
    await page.getByTestId("source-continue").click();
    await expect(page.getByTestId("transcript-box")).toBeVisible({ timeout: 180_000 });
    await page.getByTestId("transcript-continue").click();
    await expect(page.getByTestId("create-screen")).toHaveAttribute("data-step", "3");

    const slider = page.getByTestId("target-minutes");
    await expect(slider).toBeVisible();
    const readout = () => page.getByTestId("target-minutes-label").innerText();

    console.log(`[slider] at 0 → ${await readout()}`);
    await slider.focus();
    for (let i = 0; i < 5; i += 1) await page.keyboard.press("ArrowRight");
    const v5 = await slider.inputValue();
    console.log(`[slider] value=${v5} → ${await readout()}`);
    expect.soft(v5).not.toBe("0");
    await expect.soft(page.getByTestId("target-minutes-label")).toContainText(/5 min · ~750 words/);

    // Real pointer drag to the far end.
    const box = (await slider.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width, box.y + box.height / 2, { steps: 10 });
    await page.mouse.up();
    const vmax = await slider.inputValue();
    console.log(`[slider] after pointer drag value=${vmax} → ${await readout()}`);

    const panelText = await page.getByTestId("length-step").innerText();
    console.log(`[slider] panel text after drag:\n${panelText.slice(0, 1200)}`);
    // Nothing is spent here: Confirm is the metered script write and is not clicked.
  });

  test("4 — layout at 1280 and 390", async ({ page }) => {
    await page.context().addCookies(cookies);
    watch(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openModal(page);
    await page.getByTestId("path-from-video").click();
    await page.getByTestId("create-screen").screenshot({ path: shot("create-1280") });
    await page.screenshot({ path: shot("page-1280"), fullPage: false });

    // The rail sits beside the panel on desktop…
    const wide = await page.evaluate(() => {
      const rail = document.querySelector('[data-testid="create-stepper"]')?.getBoundingClientRect();
      const step = document.querySelector('[data-testid="source-step"]')?.getBoundingClientRect();
      return rail && step ? { railRight: Math.round(rail.right), stepLeft: Math.round(step.left) } : null;
    });
    console.log(`[layout] 1280 → ${JSON.stringify(wide)}`);
    expect.soft(wide && wide.railRight <= wide.stepLeft, "rail left of the panel at 1280").toBeTruthy();

    // …and stacks above it on a phone, with no horizontal scroll.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.getByTestId("create-screen").screenshot({ path: shot("create-390") });
    const narrow = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      railTop: Math.round(document.querySelector('[data-testid="create-stepper"]')?.getBoundingClientRect().top ?? -1),
      stepTop: Math.round(document.querySelector('[data-testid="source-step"]')?.getBoundingClientRect().top ?? -1),
    }));
    console.log(`[layout] 390 → ${JSON.stringify(narrow)}`);
    expect.soft(narrow.scrollW, "no horizontal scroll at 390").toBeLessThanOrEqual(narrow.innerW + 1);
    expect.soft(narrow.railTop <= narrow.stepTop, "rail above the panel at 390").toBeTruthy();
  });

  test("5 — Script step: scene-stepped animation slider", async ({ page }) => {
    await page.context().addCookies(cookies);
    watch(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    // #r=script-review is minTier 'studio' (lib/vater/nav-visibility.ts:59) —
    // a public beta account gets the "PRIVATE SCREENING" card instead.
    await (prisma as unknown as {
      vaterAccount: { update: (a: unknown) => Promise<unknown> };
    }).vaterAccount.update({ where: { userId }, data: { tier: "studio" } }).catch(() => {});
    await page.goto(`${HOME}#r=script-review`);
    await page.waitForLoadState("networkidle").catch(() => {});
    const slider = page.getByTestId("anim-window");
    const visible = await slider.isVisible({ timeout: 60_000 }).catch(() => false);
    console.log(`[anim] anim-window visible on #r=script-review: ${visible}`);
    if (!visible) {
      await page.screenshot({ path: shot("script-review-no-slider"), fullPage: true });
      console.log(`[anim] page text: ${(await page.locator("body").innerText()).slice(0, 800)}`);
      return;
    }

    const state = async () =>
      page.evaluate(() => {
        const el = document.querySelector('[data-testid="anim-window"]') as HTMLInputElement;
        const label = el.closest("div")?.querySelector("span:last-child") as HTMLElement | null;
        const help = el.nextElementSibling as HTMLElement | null;
        return {
          value: el.value,
          min: el.min,
          max: el.max,
          step: el.step,
          valueText: el.getAttribute("aria-valuetext"),
          label: (el.parentElement?.querySelector("span") as HTMLElement)?.innerText ?? label?.innerText ?? "",
          headline: (el.previousElementSibling as HTMLElement)?.innerText ?? "",
          help: help?.innerText ?? "",
        };
      });

    console.log(`[anim] EMPTY script: ${JSON.stringify(await state(), null, 2)}`);
    await page.screenshot({ path: shot("anim-empty"), fullPage: false });

    // Paste a script so the cap has something to derive from (~450 words = 3 min).
    const words = Array.from({ length: 450 }, (_, i) => `word${i}`).join(" ");
    const ta = page.locator("textarea").first();
    await ta.fill(words);
    await page.waitForTimeout(500);
    console.log(`[anim] 450-word script: ${JSON.stringify(await state(), null, 2)}`);

    // Step the slider one notch at a time and record every readout.
    await slider.click();
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press("ArrowRight");
      const s = await state();
      console.log(`[anim] +${i + 1} → value=${s.value} label="${s.headline}" valueText="${s.valueText}"`);
    }
    await page.screenshot({ path: shot("anim-stepped"), fullPage: false });

    // Now shorten the script and see whether the slider value follows the cap.
    await ta.fill("only twelve words in this script now which is much shorter than before ok");
    await page.waitForTimeout(500);
    console.log(`[anim] shortened script: ${JSON.stringify(await state(), null, 2)}`);
    await page.screenshot({ path: shot("anim-shortened"), fullPage: false });
  });
});
