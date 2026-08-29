/**
 * Google Drive link — the per-user Drive connection in the /animate Create
 * flow, with the API mocked by page.route so it spends nothing and needs no
 * Google project.
 *
 *   (a) Review step, not linked → "Link Google Drive" navigates to
 *       /api/vater/drive/oauth/start?return=… → (mocked 302) →
 *       /animate?drive=connected#r=create&p=<id>&s=5 → toast "Google Drive
 *       linked", the Shell strips the query, the card refetches and shows
 *       the Google email.
 *   (b) An approved row with `driveError` shows the amber chip; Retry POSTs
 *       [id]/drive-sync and the chip becomes the "Saved to Drive ↗" link.
 *
 * Run like create-flow.spec.ts (isolated copy, PLAYWRIGHT_BASE_URL +
 * DATABASE_URL).
 */
import { test, expect as baseExpect, type Page, type Route } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  seedAndSignIn,
  cleanupUser,
  landOnStudio,
  mockProject,
  summaryFor,
  json,
  MOCK_STYLE,
  MOCK_SCRIPT,
  MOCK_BILLING_STATUS,
  type MockProject,
  type StudioUser,
} from "./_studio-auth";

const expect = baseExpect.configure({ timeout: 60_000 });
const prisma = new PrismaClient();

const PROJECT_ID = "proj_drive_e2e";
const DRIVE_EMAIL = "e2e-drive@gmail.com";
const FOLDER_URL = "https://drive.google.com/drive/folders/e2e-jelly-scripts";
const DOC_URL = "https://docs.google.com/document/d/e2e-doc-id/edit";

interface DriveState {
  project: MockProject | null;
  linked: boolean;
}

const driveStatus = (linked: boolean) =>
  linked
    ? { connected: true, email: DRIVE_EMAIL, folderUrl: FOLDER_URL, status: "active", lastError: null }
    : { connected: false, email: null, folderUrl: null, status: null, lastError: null };

/** The slice of the API these two flows touch, backed by one mutable row. */
function installMockApi(page: Page, state: DriveState) {
  return page.route(/\/api\/vater\//, async (route: Route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();

    if (path === "/api/vater/youtube/styles") {
      return route.fulfill(json({ styles: [MOCK_STYLE], lockedStyleId: MOCK_STYLE.id }));
    }
    if (path === "/api/vater/billing/status") return route.fulfill(json(MOCK_BILLING_STATUS));
    if (path === "/api/vater/youtube/progress-summary") {
      return route.fulfill(json(summaryFor(state.project ? [state.project] : [])));
    }
    if (path === "/api/vater/drive/status") return route.fulfill(json(driveStatus(state.linked)));
    if (path === "/api/vater/drive/disconnect" && method === "POST") {
      state.linked = false;
      return route.fulfill(json({ ok: true }));
    }
    if (path === "/api/vater/drive/oauth/start") {
      // Google's round trip, collapsed: land back on the return hash as linked.
      state.linked = true;
      const ret = new URL(req.url()).searchParams.get("return") ?? "";
      return route.fulfill({ status: 302, headers: { location: `/animate?drive=connected#${ret}` } });
    }

    const m = path.match(/^\/api\/vater\/youtube\/([^/]+)(?:\/([^/]+))?$/);
    if (m && m[1] === PROJECT_ID && state.project) {
      const sub = m[2];
      if (!sub && method === "GET") return route.fulfill(json({ project: state.project }));
      if (sub === "poll") return route.fulfill(json({ project: state.project }));
      if (sub === "estimate") return route.fulfill(json({ draftUsd: 1.23, fullUsd: 2.34 }));
      if (sub === "drive-sync" && method === "POST") {
        if (!state.linked) return route.fulfill(json({ reason: "not_linked" }, 412));
        state.project = {
          ...state.project,
          driveFileUrl: DOC_URL,
          driveError: null,
          driveSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        return route.fulfill(json({ project: state.project }));
      }
    }
    return route.fallback();
  });
}

/** A row parked on step 5 (awaiting approval) with a script in the box. */
function reviewRow(): MockProject {
  return mockProject({
    id: PROJECT_ID,
    status: "awaiting_script_approval",
    flowStep: 5,
    script: MOCK_SCRIPT,
    transcript: null,
    approvalExpiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
    scriptVersions: [{ ts: new Date().toISOString(), source: "generated", script: MOCK_SCRIPT }],
  });
}

test.describe("google drive link (mocked API)", () => {
  let user: StudioUser | null = null;

  test.beforeAll(async ({ browser }) => {
    user = await seedAndSignIn(browser, prisma, "drivelink");
  });
  test.afterAll(async () => {
    await cleanupUser(prisma, user);
    await prisma.$disconnect();
  });

  test("Review step: Link Google Drive round-trips through OAuth and shows the linked email", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const state: DriveState = { project: reviewRow(), linked: false };
    await installMockApi(page, state);

    await landOnStudio(page, `#r=create&p=${PROJECT_ID}&s=5`);
    const screen = page.getByTestId("create-screen");
    await expect(screen).toHaveAttribute("data-step", "5");
    await expect(page.getByTestId("review-step")).toBeVisible();

    // Not linked: the card offers the link and says where scripts go.
    const card = page.getByTestId("drive-card");
    await expect(card).toHaveAttribute("data-state", "unlinked");
    await expect(card).toContainText("Jelly Scripts");
    const link = page.getByTestId("drive-link");
    await expect(link).toBeVisible();
    await expect(page.getByTestId("drive-linked-email")).toHaveCount(0);

    // Click → OAuth start (with the current hash as `return`) → mocked 302 back.
    const startReq = page.waitForRequest((r) => r.url().includes("/api/vater/drive/oauth/start?return="));
    await link.click();
    const req = await startReq;
    const ret = new URL(req.url()).searchParams.get("return") ?? "";
    expect(new URL(req.url()).pathname).toBe("/api/vater/drive/oauth/start");
    expect(ret).toContain("r=create");
    expect(ret).toContain(`p=${PROJECT_ID}`);
    expect(ret).toContain("s=5");

    // Back on the studio: toast, query stripped, hash intact, card refetched.
    await expect(page.getByTestId("toast").filter({ hasText: "Google Drive linked" })).toBeVisible();
    // `?drive=connected` is gone, the hash survived (either param order).
    await expect(page).toHaveURL(new RegExp(`/animate#r=create&(p=${PROJECT_ID}&s=5|s=5&p=${PROJECT_ID})$`));
    await expect(page.getByTestId("drive-card")).toHaveAttribute("data-state", "linked");
    await expect(page.getByTestId("drive-linked-email")).toHaveText(DRIVE_EMAIL);
    await expect(page.getByTestId("drive-folder")).toHaveAttribute("href", FOLDER_URL);

    // Disconnect confirms inline, then the card is back to "Link".
    await page.getByTestId("drive-disconnect").click();
    await page.getByTestId("drive-disconnect-confirm").click();
    await expect(page.getByTestId("drive-card")).toHaveAttribute("data-state", "unlinked");
    await expect(page.getByTestId("drive-link")).toBeVisible();
    expect(state.linked).toBe(false);
  });

  test("a failed Drive save shows Retry; Retry syncs and the chip becomes the Doc link", async ({ page }) => {
    await page.context().addCookies(user!.cookies);
    const state: DriveState = {
      linked: true,
      project: mockProject({
        id: PROJECT_ID,
        status: "awaiting_engine",
        flowStep: 6,
        script: MOCK_SCRIPT,
        scriptApprovedAt: new Date().toISOString(),
        approvalExpiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
        driveFileUrl: null,
        driveError: "Google returned 403 (insufficient permissions)",
      }),
    };
    await installMockApi(page, state);
    let syncPosts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith(`/api/vater/youtube/${PROJECT_ID}/drive-sync`)) syncPosts += 1;
    });

    await landOnStudio(page, `#r=create&p=${PROJECT_ID}&s=6`);
    const screen = page.getByTestId("create-screen");
    await expect(screen).toHaveAttribute("data-step", "6");
    await expect(page.getByTestId("engine-step")).toBeVisible();

    const chip = page.getByTestId("drive-chip");
    await expect(chip).toHaveAttribute("data-state", "failed");
    await expect(chip).toContainText("Drive save failed");
    await expect(chip).toContainText("insufficient permissions");

    await page.getByTestId("drive-chip-retry").click();
    await expect(page.getByTestId("drive-chip")).toHaveAttribute("data-state", "saved");
    await expect(page.getByTestId("drive-chip")).toHaveAttribute("href", DOC_URL);
    await expect(page.getByTestId("drive-chip")).toContainText("Saved to Drive");
    expect(syncPosts).toBe(1);
    expect(state.project?.driveFileUrl).toBe(DOC_URL);

    // The Progress tab carries the compact chip on the same row.
    await page.evaluate(() => {
      window.location.hash = "#r=progress";
    });
    await expect(page.getByTestId(`progress-row-${PROJECT_ID}`)).toBeVisible();
    await expect(page.getByTestId(`progress-row-${PROJECT_ID}`).getByTestId("drive-chip")).toHaveAttribute("href", DOC_URL);
  });
});
