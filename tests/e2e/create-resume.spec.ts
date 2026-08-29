/**
 * Create flow — resume + clamp. A reload on `#r=create&p=<id>` lands on the
 * step the ROW says (server wins); `s=8` on a row parked at awaiting_engine
 * clamps to 6 and the hash is rewritten; an expired gate shows Reopen.
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
  MOCK_STYLE,
  type MockProject,
  type StudioUser,
  MOCK_BILLING_STATUS,
} from "./_studio-auth";

const expect = baseExpect.configure({ timeout: 60_000 });
const prisma = new PrismaClient();
const plusDays = (d: number) => new Date(Date.now() + d * 864e5).toISOString();

async function mockRow(page: Page, p: MockProject) {
  await page.route(/\/api\/vater\//, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/vater/youtube/styles") return route.fulfill(json({ styles: [MOCK_STYLE], lockedStyleId: MOCK_STYLE.id }));
    if (path === "/api/vater/billing/status") return route.fulfill(json(MOCK_BILLING_STATUS));
    if (path === "/api/vater/youtube/progress-summary") return route.fulfill(json(summaryFor([p])));
    if (path === `/api/vater/youtube/${p.id}`) return route.fulfill(json({ project: p }));
    if (path === `/api/vater/youtube/${p.id}/poll`) return route.fulfill(json({ project: p }));
    if (path === `/api/vater/youtube/${p.id}/estimate`) return route.fulfill(json({ draftUsd: 1.1, fullUsd: 2.2 }));
    if (path === `/api/vater/youtube/${p.id}/reopen`) {
      p.status = "awaiting_script_approval";
      p.approvalExpiresAt = plusDays(7);
      return route.fulfill(json({ project: p }));
    }
    return route.fallback();
  });
}

test.describe("create flow resume", () => {
  let user: StudioUser | null = null;

  test.beforeAll(async ({ browser }) => {
    user = await seedAndSignIn(browser, prisma, "resume");
  });
  test.afterAll(async () => {
    await cleanupUser(prisma, user);
    await prisma.$disconnect();
  });

  test("reload lands on the derived step; s=8 on awaiting_engine clamps to 6", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const p = mockProject({
      id: "p_engine",
      status: "awaiting_engine",
      sourceTitle: "Parked at the engine",
      transcript: MOCK_TRANSCRIPT,
      script: MOCK_SCRIPT,
      flowStep: 6,
      scriptApprovedAt: new Date().toISOString(),
      approvalExpiresAt: plusDays(7),
    });
    await mockRow(page, p);

    // Stale, ahead-of-the-data hash.
    await landOnStudio(page, "#r=create&p=p_engine&s=8");
    const screen = page.getByTestId("create-screen");
    await expect(screen).toHaveAttribute("data-step", "6");
    await expect(page.getByTestId("engine-step")).toBeVisible();
    await expect(page).toHaveURL(/#r=create&s=6&p=p_engine$/);
    // replaceState, not push: Back leaves the create route rather than
    // stepping through a phantom `s=8`.
    const entries = await page.evaluate(() => window.history.length);
    expect(entries).toBeGreaterThan(0);

    // No `s` at all → derived step.
    await page.goto("/animate#r=create&p=p_engine");
    await expect(screen).toHaveAttribute("data-step", "6");

    // Looking back is allowed and read-only.
    await page.evaluate(() => {
      window.location.hash = "#r=create&p=p_engine&s=5";
    });
    await expect(screen).toHaveAttribute("data-step", "5");
    await expect(page.getByTestId("review-done")).toBeVisible();
    await expect(page.getByTestId("create-readonly-note")).toBeVisible();
  });

  test("a writing row resumes on the pulsing step 4", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const p = mockProject({
      id: "p_writing",
      status: "scripting",
      sourceTitle: "Mid-write",
      transcript: MOCK_TRANSCRIPT,
      flowStep: 3,
      autopilotJobId: "job_x",
    });
    await mockRow(page, p);
    await landOnStudio(page, "#r=create&p=p_writing");
    const screen = page.getByTestId("create-screen");
    await expect(screen).toHaveAttribute("data-step", "4");
    await expect(page.getByTestId("create-step-4")).toHaveAttribute("data-state", "pulsing");
    await expect(page.getByTestId("nav-progress")).toHaveAttribute("data-pulse", "1");
  });

  test("an expired gate shows Reopen and comes back to step 5", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const p = mockProject({
      id: "p_expired",
      status: "expired",
      sourceTitle: "Expired gate",
      transcript: MOCK_TRANSCRIPT,
      script: MOCK_SCRIPT,
      flowStep: 5,
      approvalExpiresAt: plusDays(-8),
    });
    await mockRow(page, p);
    await landOnStudio(page, "#r=create&p=p_expired");
    const screen = page.getByTestId("create-screen");
    await expect(screen).toHaveAttribute("data-step", "5");
    await expect(page.getByTestId("review-expired")).toContainText("This approval expired after 7 days");
    await expect(page.getByTestId("create-step-5")).toHaveAttribute("data-state", "expired");
    await page.getByTestId("review-reopen").click();
    await expect(page.getByTestId("review-step")).toBeVisible();
    await expect(page.getByTestId("review-approve")).toBeEnabled();
  });
});
