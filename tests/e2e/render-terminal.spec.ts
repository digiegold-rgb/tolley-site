/**
 * RenderTerminal — the "last 4 terminal lines" box on every Progress row
 * (mocked progress-summary + mocked `[id]/log`).
 *
 *   - the In-progress row shows `render-terminal` with the LAST 4 of 6 lines,
 *     the 4th being the newest, and the phase header "rendering scenes · 78%"
 *   - a second poll (7 lines) updates the newest line within ~7s
 *   - a Needs-your-approval row keeps its terminal collapsed behind "Log"
 *
 * Run like progress-tab.spec.ts (isolated copy).
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

const LINES = [
  "01:23:01 scenes: scene 25/55 done",
  "01:23:03 scenes: scene 26/55 done",
  "01:23:05 scenes: scene 27/55 done",
  "01:23:07 scenes: scene 28/55 done",
  "01:23:08 scenes: scene 29/55 done",
  "01:23:09 scenes: scene 30/55 done",
];
const LINE_7 = "01:23:11 scenes: scene 31/55 done";

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
      autopilotJobId: "job_r",
    }),
    mockProject({
      id: "p_render",
      status: "generating_scenes",
      sourceTitle: "Being rendered",
      transcript: MOCK_TRANSCRIPT,
      script: MOCK_SCRIPT,
      flowStep: 7,
      scriptApprovedAt: plusDays(-1),
      autopilotJobId: "job_x",
      progress: 78,
    }),
  ];
}

function logBody(lines: string[]) {
  return {
    jobId: "job_x",
    status: "running",
    phase: "rendering_scenes",
    progress: 78,
    updatedAt: new Date().toISOString(),
    lines,
  };
}

async function mockApi(page: Page, list: MockProject[], logCalls: string[]) {
  await page.route(/\/api\/vater\//, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/vater/youtube/progress-summary") return route.fulfill(json(summaryFor(list)));
    if (path === "/api/vater/billing/status") return route.fulfill(json(MOCK_BILLING_STATUS));
    const log = path.match(/^\/api\/vater\/youtube\/([^/]+)\/log$/);
    if (log) {
      logCalls.push(log[1]);
      if (log[1] !== "p_render") {
        return route.fulfill(json({ jobId: null, status: null, phase: null, progress: null, updatedAt: null, lines: [] }));
      }
      // First poll → 6 lines; every poll after → 7 (a new worker line landed).
      const n = logCalls.filter((id) => id === "p_render").length;
      return route.fulfill(json(logBody(n === 1 ? LINES : [...LINES, LINE_7])));
    }
    const poll = path.match(/^\/api\/vater\/youtube\/([^/]+)\/poll$/);
    if (poll) return route.fulfill(json({ project: list.find((p) => p.id === poll[1]) ?? null }));
    const one = path.match(/^\/api\/vater\/youtube\/([^/]+)$/);
    if (one && route.request().method() === "GET") {
      const p = list.find((x) => x.id === one[1]);
      return p ? route.fulfill(json({ project: p })) : route.fulfill(json({ error: "not found" }, 404));
    }
    return route.fallback();
  });
}

test.describe("render terminal", () => {
  let user: StudioUser | null = null;

  test.beforeAll(async ({ browser }) => {
    user = await seedAndSignIn(browser, prisma, "rterm");
  });
  test.afterAll(async () => {
    await cleanupUser(prisma, user);
    await prisma.$disconnect();
  });

  test("in-progress row shows the last 4 worker lines, phase header, and follows the next poll", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const logCalls: string[] = [];
    await mockApi(page, rows(), logCalls);
    await landOnStudio(page, "#r=progress");

    await expect(page.getByTestId("progress-screen")).toBeVisible();
    const row = page.getByTestId("progress-row-p_render");
    await expect(row).toBeVisible();

    // Always-visible terminal inside the In-progress row (not behind expand).
    const term = row.getByTestId("render-terminal");
    await expect(term).toBeVisible();
    await expect(term).toHaveAttribute("data-active", "1");

    // Last 4 of 6 — the 4th is the newest.
    const lines = term.getByTestId("render-terminal-line");
    await expect(lines).toHaveCount(4);
    await expect(lines.nth(0)).toContainText("scene 27/55 done");
    await expect(lines.nth(3)).toContainText("scene 30/55 done");
    await expect(lines.nth(3)).toHaveAttribute("data-newest", "1");

    // Header: phase (underscores → spaces) · progress%.
    const phase = term.getByTestId("render-terminal-phase");
    await expect(phase).toContainText("rendering scenes");
    await expect(phase).toContainText("78%");
    await expect(term).toContainText("live");

    // Second poll (5s) brings the 7th line → it becomes the newest, still 4 shown.
    await expect(lines.nth(3)).toContainText("scene 31/55 done", { timeout: 9_000 });
    await expect(lines).toHaveCount(4);
    await expect(lines.nth(0)).toContainText("scene 28/55 done");
    expect(logCalls.filter((id) => id === "p_render").length).toBeGreaterThanOrEqual(2);

    // The approval row keeps its log collapsed behind "Log" — and does not poll.
    const review = page.getByTestId("progress-row-p_review");
    await expect(review.getByTestId("render-terminal-toggle")).toBeVisible();
    await expect(review.getByTestId("render-terminal")).toHaveCount(0);
    expect(logCalls.filter((id) => id === "p_review")).toEqual([]);
    await review.getByTestId("render-terminal-toggle").click();
    const reviewTerm = review.getByTestId("render-terminal");
    await expect(reviewTerm).toBeVisible();
    await expect(reviewTerm).toHaveAttribute("data-active", "0");
    await expect(reviewTerm.getByTestId("render-terminal-empty")).toHaveText("No worker log for this render");
  });
});
