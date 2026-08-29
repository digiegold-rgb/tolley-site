/**
 * tests/e2e/_studio-auth.ts — shared sign-in for the /animate stepped-flow
 * specs (create-flow, progress-tab, create-resume).
 *
 * Seeds a throwaway studio user straight into the DB (the register route is
 * IP rate-limited to 5/hr), mints the BetaInvite studio signup requires,
 * accepts the ToS, and signs in on /login. Same recipe as
 * create-video.spec.ts, factored so three specs do not carry three copies.
 *
 * Needs DATABASE_URL (the isolated E2E copy's env) and PLAYWRIGHT_BASE_URL.
 */
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { TOS_VERSION } from "../../lib/legal-animate";
import { hashPassword } from "../../lib/password";

export const HOME = "/animate";
export const TEST_PASSWORD = "e2e-Pass-word-123";

export interface StudioUser {
  email: string;
  userId: string;
  inviteId: string;
  cookies: Awaited<ReturnType<BrowserContext["cookies"]>>;
}

export async function seedAndSignIn(browser: Browser, prisma: PrismaClient, tag: string): Promise<StudioUser> {
  const stamp = Date.now();
  const email = `e2e-${tag}+${stamp}@tolley.io`.toLowerCase();
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await prisma.user.create({ data: { email } });
  const userId = user.id;
  await prisma.credentialAuth.create({ data: { userId, passwordHash } });
  const invite = await prisma.betaInvite.create({
    data: {
      code: `${tag.slice(0, 2).toUpperCase()}${String(stamp).slice(-9)}`,
      email,
      maxUses: 1,
      usedCount: 1,
      createdBy: "e2e",
      note: `${tag} e2e`,
    },
  });
  await prisma.$executeRaw`UPDATE "User" SET "betaInviteId" = ${invite.id} WHERE "id" = ${userId}`;
  await prisma.$executeRaw`
    UPDATE "User" SET "termsAcceptedAt" = NOW(), "termsVersion" = ${TOS_VERSION} WHERE "id" = ${userId}
  `;
  await (prisma as unknown as { vaterAccount: { upsert: (a: unknown) => Promise<unknown> } }).vaterAccount
    .upsert({
      where: { userId },
      create: { userId, tier: "public", unmetered: false, notes: `${tag} e2e` },
      update: {},
    })
    .catch(() => {});

  const ctx = await browser.newContext();
  // Sign in through the Auth.js API (the 302 path) rather than the login
  // form. The form's signIn(..., {redirect:false}) sends
  // X-Auth-Return-Redirect, and under a local `next start` on Node 22 that
  // JSON branch returns no Response (prod on Vercel/Node 24 is fine — verified
  // 2026-08-28). APIRequestContext shares the context's cookie jar, so the
  // session cookie lands on the pages this context opens.
  let landed = false;
  for (let attempt = 1; attempt <= 3 && !landed; attempt += 1) {
    try {
      const csrfRes = await ctx.request.get("/api/auth/csrf");
      const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
      const cb = await ctx.request.post("/api/auth/callback/credentials", {
        form: { csrfToken, email, password: TEST_PASSWORD, callbackUrl: HOME },
        maxRedirects: 0,
      });
      const session = await ctx.request.get("/api/auth/session");
      const body = (await session.json().catch(() => null)) as { user?: { id?: string } } | null;
      landed = Boolean(body?.user?.id);
      if (!landed) console.log(`[e2e] api sign-in attempt ${attempt}: callback ${cb.status()} session ${session.status()}`);
    } catch (err) {
      // Non-JSON (e.g. a Vercel protection page) — fall through to the UI.
      console.log(`[e2e] api sign-in attempt ${attempt} threw: ${(err as Error).message.slice(0, 80)}`);
      break;
    }
  }
  if (!landed) {
    // UI fallback (works in prod-like runtimes).
    const page = await ctx.newPage();
    await page.goto(`/login?callbackUrl=${encodeURIComponent(HOME)}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    landed = await page
      .waitForURL((u) => u.pathname.startsWith(HOME), { timeout: 60_000 })
      .then(() => true)
      .catch(() => false);
    await page.close();
  }
  if (!landed) throw new Error("could not sign in");
  const cookies = await ctx.cookies();
  await ctx.close();
  return { email, userId, inviteId: invite.id, cookies };
}

export async function cleanupUser(prisma: PrismaClient, u: StudioUser | null): Promise<void> {
  if (!u) return;
  const { userId, inviteId } = u;
  await prisma.$executeRaw`UPDATE "User" SET "betaInviteId" = NULL WHERE "id" = ${userId}`.catch(() => {});
  if (inviteId) await prisma.betaInvite.deleteMany({ where: { id: inviteId } }).catch(() => {});
  await (prisma as unknown as { vaterAccount: { deleteMany: (a: unknown) => Promise<unknown> } }).vaterAccount
    .deleteMany({ where: { userId } })
    .catch(() => {});
  await prisma.vaterCreditLedger.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.vaterSubscription.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.credentialAuth.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
}

/** Dismiss the ToS modal if it shows, then wait for the shell. */
export async function landOnStudio(page: Page, hash = ""): Promise<void> {
  await page.goto(`${HOME}${hash}`);
  await page.waitForLoadState("networkidle").catch(() => {});
  const termsBtn = page.getByTestId("terms-accept-button");
  if (await termsBtn.isVisible().catch(() => false)) {
    await page.getByTestId("terms-accept-checkbox").check().catch(() => {});
    await termsBtn.click();
  }
  await expect(page.getByTestId("sidebar")).toBeVisible();
}

/* ── Fake project rows for the mocked API ──────────────────────────────── */

/** Full shape of GET /api/vater/billing/status — the Header dereferences
 *  usage/trial/subscription/card, so a partial mock blanks the Shell. */
export const MOCK_BILLING_STATUS = {
  subscription: null,
  card: null,
  usage: {
    usedCents: 0,
    includedCents: 0,
    limitCents: 10000,
    periodStart: new Date(Date.now() - 864e5).toISOString(),
    periodEnd: new Date(Date.now() + 29 * 864e5).toISOString(),
  },
  trial: { transcripts: 0, scenes: 0, animations: 0, caps: { transcripts: 3, scenes: 6, animations: 2 }, capHitAt: null },
  unmetered: false,
  isTrial: false,
  defaultLimitCents: 10000,
};

export const MOCK_STYLE = {
  id: "sty_e2e",
  name: "E2E Style",
  emoji: null,
  voice: "Mark",
  isSystem: false,
  artStylePresetId: "cinematic",
  referenceTranscripts: [],
  _count: { characters: 1 },
};

export const MOCK_TRANSCRIPT = Array.from({ length: 60 })
  .map((_, i) => `Sentence ${i + 1} of the source transcript, explaining one idea at a time.`)
  .join(" ");

export const MOCK_SCRIPT = Array.from({ length: 40 })
  .map((_, i) => `Line ${i + 1} of the rewritten script, in the house voice.`)
  .join(" ");

export interface MockProject {
  id: string;
  status: string;
  progress: number;
  flowStep: number;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceChannel: string | null;
  transcript: string | null;
  script: string | null;
  targetWordCount: number;
  targetDuration: number;
  animUntilS: number | null;
  scriptApprovedAt: string | null;
  approvalExpiresAt: string | null;
  finalVideoUrl: string | null;
  thumbnailUrl: string | null;
  publishTitle: string | null;
  description: string | null;
  tags: string[];
  thumbnailConcept: string | null;
  youtubeVideoId: string | null;
  publishedAt: string | null;
  shortVideoUrl: string | null;
  shortDescription: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  scriptVersions: Array<{ ts: string; source: string; script: string }> | null;
  stepDetails: Record<string, unknown> | null;
  settingsJson: Record<string, unknown> | null;
  variationJson: { count: number; seed: number; directive: string; requestedAt: string } | null;
  autopilotJobId: string | null;
  styleId: string | null;
  topic: string | null;
}

export function mockProject(overrides: Partial<MockProject> = {}): MockProject {
  const now = new Date().toISOString();
  return {
    id: "proj_e2e",
    status: "draft",
    progress: 0,
    flowStep: 1,
    sourceUrl: null,
    sourceTitle: null,
    sourceChannel: null,
    transcript: null,
    script: null,
    targetWordCount: 1500,
    targetDuration: 10,
    animUntilS: 0,
    scriptApprovedAt: null,
    approvalExpiresAt: null,
    finalVideoUrl: null,
    thumbnailUrl: null,
    publishTitle: null,
    description: null,
    tags: [],
    thumbnailConcept: null,
    youtubeVideoId: null,
    publishedAt: null,
    shortVideoUrl: null,
    shortDescription: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    scriptVersions: null,
    stepDetails: null,
    settingsJson: null,
    variationJson: null,
    autopilotJobId: null,
    styleId: MOCK_STYLE.id,
    topic: null,
    ...overrides,
  };
}

/** Mirror of lib/vater/create-steps deriveCreateStep for the summary mock. */
export function summaryRow(p: MockProject) {
  // Import lazily so the spec compiles without the app's tsconfig paths.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { deriveCreateStep } = require("../../lib/vater/create-steps") as typeof import("../../lib/vater/create-steps");
  const d = deriveCreateStep(p);
  return {
    id: p.id,
    title: p.publishTitle || p.sourceTitle || p.topic || p.id,
    status: p.status,
    flowStep: p.flowStep,
    scriptApprovedAt: p.scriptApprovedAt,
    approvalExpiresAt: p.approvalExpiresAt,
    updatedAt: p.updatedAt,
    thumbnailUrl: p.thumbnailUrl,
    finalVideoUrl: p.finalVideoUrl,
    hasTranscript: !!p.transcript,
    hasScript: !!p.script,
    failedPhase: null,
    conciergeStage: null,
    step: d.step,
    kind: d.kind,
    needsUser: d.needsUser,
    active: d.active,
    variationCount: p.variationJson?.count ?? 0,
  };
}

export function summaryFor(rows: MockProject[]) {
  const projects = rows.map(summaryRow);
  return {
    needsApproval: projects.filter((r) => r.kind === "approval" || r.kind === "money").length,
    active: projects.filter((r) => r.active).length,
    projects,
  };
}

export const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});
