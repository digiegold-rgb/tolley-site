/**
 * Progress tab + sidebar badge (mocked progress-summary).
 *
 *   - badge = 1 for one awaiting_script_approval row
 *   - pulse while a row is scripting
 *   - an expired gate (approvalExpiresAt −8d) is NOT counted, shows Reopen
 *   - a saved nav order that still says `queue` renders `progress` in that slot
 *   - row click deep-links to #r=create&p=<id>&s=<step>
 *
 * Run like create-flow.spec.ts (isolated copy).
 */
import { test, expect as baseExpect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  seedAndSignIn,
  cleanupUser,
  landOnStudio,
  mockProject,
  summaryFor,
  json,
  MOCK_SCRIPT,
  MOCK_TRANSCRIPT,
  type MockProject,
  type StudioUser,
  MOCK_BILLING_STATUS,
} from "./_studio-auth";

const expect = baseExpect.configure({ timeout: 60_000 });
const prisma = new PrismaClient();

const plusDays = (d: number) => new Date(Date.now() + d * 864e5).toISOString();

function rows(): MockProject[] {
  return [
    mockProject({
      id: "p_review",
      status: "awaiting_script_approval",
      sourceTitle: "Needs review",
      transcript: MOCK_TRANSCRIPT,
      script: MOCK_SCRIPT,
      flowStep: 5,
      approvalExpiresAt: plusDays(7),
    }),
    mockProject({
      id: "p_writing",
      status: "scripting",
      sourceTitle: "Being written",
      transcript: MOCK_TRANSCRIPT,
      flowStep: 4,
      autopilotJobId: "job_w",
    }),
    mockProject({
      id: "p_expired",
      status: "expired",
      sourceTitle: "Sat too long",
      transcript: MOCK_TRANSCRIPT,
      script: MOCK_SCRIPT,
      flowStep: 5,
      approvalExpiresAt: plusDays(-8),
    }),
    mockProject({
      id: "p_done",
      status: "ready",
      sourceTitle: "Landed",
      transcript: MOCK_TRANSCRIPT,
      script: MOCK_SCRIPT,
      flowStep: 8,
      finalVideoUrl: "https://example.blob.vercel-storage.com/x.mp4",
    }),
  ];
}

async function mockSummary(page: Page, list: MockProject[], reopened: string[]) {
  await page.route(/\/api\/vater\//, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/vater/youtube/progress-summary") return route.fulfill(json(summaryFor(list)));
    if (path === "/api/vater/billing/status") return route.fulfill(json(MOCK_BILLING_STATUS));
    const poll = path.match(/^\/api\/vater\/youtube\/([^/]+)\/poll$/);
    if (poll) return route.fulfill(json({ project: list.find((p) => p.id === poll[1]) ?? null }));
    const one = path.match(/^\/api\/vater\/youtube\/([^/]+)$/);
    if (one && route.request().method() === "GET") {
      const p = list.find((x) => x.id === one[1]);
      return p ? route.fulfill(json({ project: p })) : route.fulfill(json({ error: "not found" }, 404));
    }
    const reopen = path.match(/^\/api\/vater\/youtube\/([^/]+)\/reopen$/);
    if (reopen && route.request().method() === "POST") {
      reopened.push(reopen[1]);
      const p = list.find((x) => x.id === reopen[1]);
      if (p) {
        p.status = "awaiting_script_approval";
        p.approvalExpiresAt = plusDays(7);
      }
      return route.fulfill(json({ project: p }));
    }
    return route.fallback();
  });
}

test.describe("progress tab", () => {
  let user: StudioUser | null = null;

  test.beforeAll(async ({ browser }) => {
    user = await seedAndSignIn(browser, prisma, "progress");
  });
  test.afterAll(async () => {
    await cleanupUser(prisma, user);
    await prisma.$disconnect();
  });

  test("badge counts the approval, pulses for writing, ignores expired", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const list = rows();
    const reopened: string[] = [];
    await mockSummary(page, list, reopened);
    await landOnStudio(page);

    const nav = page.getByTestId("nav-progress");
    await expect(nav).toBeVisible();
    await expect(nav).toHaveAttribute("data-badge", "1");
    await expect(nav).toHaveAttribute("data-pulse", "1");
    await expect(page.getByTestId("nav-badge-progress")).toHaveText("1");
    // The old id is gone from the rail.
    await expect(page.getByTestId("nav-queue")).toHaveCount(0);

    await nav.click();
    await expect(page).toHaveURL(/#r=progress$/);
    const screen = page.getByTestId("progress-screen");
    await expect(screen).toBeVisible();
    await expect(page.getByTestId("progress-section-approval")).toContainText("Needs review");
    await expect(page.getByTestId("progress-section-active")).toContainText("Being written");
    await expect(page.getByTestId("progress-section-done")).toContainText("Landed");
    await expect(page.getByTestId("progress-section-expired")).toContainText("Sat too long");
    await expect(page.getByTestId("progress-row-p_expired")).toHaveAttribute("data-kind", "expired");

    // Expand → compact stepper with the right step lit.
    await page.getByTestId("progress-expand-p_review").click();
    const row = page.getByTestId("progress-row-p_review");
    await expect(row.getByTestId("create-step-5")).toHaveAttribute("data-state", "needs-you");

    // Reopen the expired one → the mock flips it, the badge follows.
    await page.getByTestId("progress-reopen-p_expired").click();
    await expect.poll(() => reopened).toEqual(["p_expired"]);
    await expect(nav).toHaveAttribute("data-badge", "2", { timeout: 40_000 });

    // Row click → the step deep link.
    await page.getByTestId("progress-open-p_review").click();
    await expect(page).toHaveURL(/#r=create&p=p_review&s=5$/);
    await expect(page.getByTestId("create-screen")).toHaveAttribute("data-step", "5");
  });

  test("legacy `queue` alias route and saved nav order still land on Progress", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    await mockSummary(page, rows(), []);

    // Saved layout from before the rename: `queue` first in STUDIO.
    await page.addInitScript((email: string) => {
      window.localStorage.setItem(
        `jelly.nav-order.${email}`,
        JSON.stringify({ v: 1, order: ["queue", "dashboard", "library"], sections: { queue: "primary" } }),
      );
    }, user!.email.toLowerCase());

    await landOnStudio(page, "#r=queue");
    await expect(page.getByTestId("progress-screen")).toBeVisible();
    await expect(page.getByTestId("nav-progress")).toHaveAttribute("aria-current", "page");

    // Diagnostics (kept: cheap, and this test guards a localStorage migration).
    const me = await (await page.request.get("/api/vater/me")).json().catch(() => null);
    console.log(
      `[nav-order] me.email=${me?.email} workspace=${me?.workspace?.id ?? null} ls=${JSON.stringify(
        await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith("jelly.nav"))),
      )} rows=${JSON.stringify(
        await page.getByTestId("nav-section-primary").locator("[data-nav-row]").evaluateAll((els) => els.slice(0, 3).map((e) => e.getAttribute("data-nav-row"))),
      )}`,
    );
    const firstRow = page.getByTestId("nav-section-primary").locator("[data-nav-row]").first();
    // Prefs apply once /api/vater/me resolves (loading → false); allow for a slow preview.
    await expect(firstRow).toHaveAttribute("data-nav-row", "progress", { timeout: 20_000 });
  });
});
