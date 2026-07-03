/**
 * Vater v2 — 3-click TubeGen-parity smoke spec.
 *
 * Verifies the full create-a-video flow from /vater/youtube/v2:
 *   1. Click Create Video on Dashboard → Style Picker modal
 *   2. Pick a style → editor route with PillStepper visible
 *   3. Title step (channel-mode) → paste YT URL → Generate → pick title
 *   4. (Optional) walk Script → Voiceover happy paths
 *
 * Auth: storage state at PLAYWRIGHT_STORAGE_STATE (preferred). Falls
 * back to credentialed login via PLAYWRIGHT_TEST_USER /
 * PLAYWRIGHT_TEST_PASSWORD against the /login page if no state file.
 *
 * Run:
 *   PLAYWRIGHT_BASE_URL=https://tolley.io \
 *   PLAYWRIGHT_STORAGE_STATE=./tests/e2e/.auth/state.json \
 *     npx playwright test tests/e2e/vater-v2-3click.spec.ts --reporter=list
 *
 * The flow is intentionally generous on timeouts: title-from-channel
 * waits up to 5 minutes for the DGX transcribe + suggest-titles round
 * trip (matching TitleStep.tsx's 5-min ceiling).
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const FIXTURE_YT_URL =
  process.env.PLAYWRIGHT_VATER_FIXTURE_URL ??
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const TEST_USER = process.env.PLAYWRIGHT_TEST_USER;
const TEST_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD;
const FIVE_MIN = 5 * 60 * 1000;

/** Best-effort credentialed login when no storage state is present. */
async function loginViaUI(page: Page) {
  if (!TEST_USER || !TEST_PASSWORD) {
    test.skip(
      true,
      'No PLAYWRIGHT_STORAGE_STATE and no PLAYWRIGHT_TEST_USER/PASSWORD set — skipping auth-required e2e.',
    );
    return;
  }
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(TEST_USER);
  const pwField = page.getByLabel(/password/i);
  if (await pwField.count()) {
    await pwField.first().fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /sign in|log in|continue/i }).click();
    await page.waitForURL((u) => !/\/login(\/|$|\?)/.test(u.pathname), {
      timeout: 60_000,
    });
  } else {
    test.skip(true, 'Login page does not expose a password field — magic-link flow is not testable headlessly.');
  }
}

/** Ensure at least one style exists; returns the id of one we can click. */
async function ensureFixtureStyle(api: APIRequestContext): Promise<string> {
  const list = await api.get('/api/vater/youtube/styles');
  expect(list.ok(), 'GET /api/vater/youtube/styles should succeed').toBe(true);
  const data = (await list.json()) as { styles?: Array<{ id: string }> };
  const first = data.styles?.[0]?.id;
  if (first) return first;

  // Create a minimal fixture style if none exist. Endpoint shape per
  // app/api/vater/youtube/styles/route.ts — name is required.
  const created = await api.post('/api/vater/youtube/styles', {
    data: { name: `e2e fixture ${Date.now()}` },
  });
  expect(created.ok(), 'POST /api/vater/youtube/styles should succeed').toBe(true);
  const body = (await created.json()) as { style?: { id?: string } };
  const id = body.style?.id;
  expect(typeof id === 'string' && id.length > 0).toBe(true);
  return id as string;
}

test.describe('vater v2 3-click', () => {
  test.beforeEach(async ({ page, context }) => {
    // If no state cookie present, attempt UI login.
    const cookies = await context.cookies();
    const looksAuthed = cookies.some((c) => /next-auth|authjs|session/i.test(c.name));
    if (!looksAuthed) {
      await loginViaUI(page);
    }
  });

  test('Create Video → Style → Title (channel mode)', async ({ page, request }) => {
    const fixtureStyleId = await ensureFixtureStyle(request);

    // 1. Land on v2 dashboard
    await page.goto('/vater/youtube/v2');
    await expect(page).toHaveURL(/\/vater\/youtube\/v2/);

    // 2. Click Create Video → Style Picker modal opens
    await page.getByRole('button', { name: /create video/i }).first().click();
    const modal = page.getByRole('dialog', { name: /select a style/i });
    await expect(modal).toBeVisible({ timeout: 15_000 });

    // 3. Pick the fixture style (look up by id via data-testid or the name).
    // StylePickerModal renders style cards as role=button — click the first one
    // that's NOT the "Create Style" tile. Our fixture happens to be that first
    // existing-style tile because we just created it (or one already existed).
    const allStyleCards = modal.getByRole('button');
    // The first role=button is the "Create Style" tile — skip it.
    await allStyleCards.nth(1).click();

    // 4. Wait for editor route + PillStepper. The Shell pushes
    // #r=editor&p=<projectId> into the URL hash on success.
    await page.waitForURL(/#.*r=editor.*p=/, { timeout: 30_000 });
    const stepper = page.locator('[data-testid="pill-stepper"]').first();
    // Fallback: PillStepper may not have a testid — assert the steps text instead.
    if (!(await stepper.count())) {
      await expect(page.getByText(/^Title$/, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(/^Script$/, { exact: true }).first()).toBeVisible();
    } else {
      await expect(stepper).toBeVisible();
    }

    // Sanity: the project id is in the hash, in case the rest of the flow
    // ever needs to talk to the backend directly.
    const projectId = await page.evaluate(() => {
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      return h.get('p');
    });
    expect(projectId, 'project id must be present in URL hash').toBeTruthy();
    expect(fixtureStyleId).toBeTruthy(); // referenced for traceability

    // 5. Type the fixture URL into the Channel-mode card.
    const channelInput = page.locator('input[type="url"]').first();
    await expect(channelInput).toBeVisible();
    await channelInput.fill(FIXTURE_YT_URL);

    // 6. Find the Generate button inside the Channel card and assert
    // it became enabled, then click it.
    const channelGenBtn = page
      .getByRole('button', { name: /generate titles/i })
      .nth(1); // 0=sample card, 1=channel card, 2=style card
    await expect(channelGenBtn).toBeEnabled({ timeout: 10_000 });
    await channelGenBtn.click();

    // 7. Wait up to 5 min for the title list to render (the DGX transcribe
    // round-trip happens inside this window).
    const suggestedHeader = page.getByText(/Suggested Titles/i);
    await expect(suggestedHeader).toBeVisible({ timeout: FIVE_MIN });

    // Click the first title item — TitleStep renders them as plain
    // clickable divs prefixed with "1." . Use locator-by-text on "1.".
    const firstTitle = page
      .locator('div')
      .filter({ hasText: /^\s*1\./ })
      .first();
    await firstTitle.click();

    // 8. After PATCH succeeds, ProjectShell auto-advances to Script. We
    // assert the "Current title" sticker appears (means sourceTitle saved).
    await expect(page.getByText(/Current title/i)).toBeVisible({ timeout: 30_000 });

    // 9. (Optional happy-path) — kick the Script generate to confirm
    // the auto-advance landed on Script. We don't wait the full 5 min
    // here unless RUN_FULL_PIPELINE is set; we just assert the script
    // step rendered.
    if (process.env.RUN_FULL_PIPELINE === '1') {
      const scriptGenerate = page
        .getByRole('button', { name: /generate.*script|generate script/i })
        .first();
      await expect(scriptGenerate).toBeVisible({ timeout: 30_000 });
      await scriptGenerate.click();
      await expect(page.getByText(/^Script$/).first()).toBeVisible();
      // Poll-style wait: just look for any script text rendering.
      await expect(
        page.locator('textarea, pre, [data-testid="script-body"]').first(),
      ).toBeVisible({ timeout: FIVE_MIN });
    }
  });
});
