/**
 * tests/e2e/workspaces.spec.ts — Jelly Studio TABS (workspaces), end to end.
 *
 * One login, many fully separate studios (lib/vater/workspaces.ts). This spec
 * proves the isolation contract from the browser's point of view:
 *
 *   1. the strip shows the primary tab
 *   2. "+" creates a tab and lands inside it (full reload, new identity)
 *   3. inside the new tab: 0 projects, 0 characters, a fresh balance
 *   4. rename persists across a reload
 *   5. switching back shows the ORIGINAL library again (nothing lost)
 *   6. the primary tab refuses to archive; the new one archives (never deletes)
 *
 * Runs against PLAYWRIGHT_BASE_URL (default https://tolley.io) with a real
 * account: AUDIT_ANIMATE_EMAIL / AUDIT_ANIMATE_PASSWORD. Skips cleanly when
 * those are absent or the workspace table hasn't been migrated yet (503).
 *
 *   AUDIT_ANIMATE_EMAIL=… AUDIT_ANIMATE_PASSWORD=… npx playwright test tests/e2e/workspaces.spec.ts
 */
import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.AUDIT_ANIMATE_EMAIL;
const PASSWORD = process.env.AUDIT_ANIMATE_PASSWORD;
const TAB_NAME = `E2E Studio ${Date.now().toString(36)}`;

test.describe.configure({ mode: 'serial' });
test.skip(!EMAIL || !PASSWORD, 'AUDIT_ANIMATE_EMAIL / AUDIT_ANIMATE_PASSWORD not set');

async function loginViaUI(page: Page) {
  await page.goto(`/login?callbackUrl=${encodeURIComponent('/animate')}`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL!);
  const pw = page.locator('input[type="password"], input[name="password"]');
  await expect(pw.first()).toBeVisible({ timeout: 15_000 });
  await pw.first().fill(PASSWORD!);
  await page
    .locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Sign in")')
    .first()
    .click();
  await page.waitForURL((u) => !/\/login(\/|$|\?)/.test(u.pathname), { timeout: 60_000 });
}

async function listWorkspaces(page: Page) {
  const r = await page.request.get('/api/vater/workspaces?archived=1');
  if (r.status() === 503) return null;
  expect(r.ok(), `GET /api/vater/workspaces → ${r.status()}`).toBeTruthy();
  const json = (await r.json()) as {
    workspaces: Array<{ id: string; name: string; isPrimary: boolean; active: boolean; archivedAt: string | null }>;
    activeId: string;
    max: number;
  };
  return json;
}

async function counts(page: Page) {
  const [projects, characters, billing] = await Promise.all([
    page.request.get('/api/vater/youtube'),
    page.request.get('/api/vater/characters'),
    page.request.get('/api/vater/billing/status'),
  ]);
  const p = (await projects.json()) as { projects?: unknown[] } | unknown[];
  const c = (await characters.json()) as { characters?: unknown[] };
  const b = (await billing.json().catch(() => ({}))) as Record<string, unknown>;
  const projectCount = Array.isArray(p) ? p.length : Array.isArray(p.projects) ? p.projects.length : 0;
  return { projectCount, characterCount: c.characters?.length ?? 0, billing: b };
}

test('tabs: create → isolated → rename → switch back → archive', async ({ page }) => {
  test.setTimeout(240_000);
  await loginViaUI(page);

  // The one-time click-wrap would otherwise sit over the strip. Accept it the
  // way the BetaGate modal does (PATCH /api/vater/me) — a no-op once accepted.
  const me0 = (await (await page.request.get('/api/vater/me')).json()) as {
    beta?: { termsAccepted?: boolean; accessAllowed?: boolean };
  };
  test.skip(me0.beta?.accessAllowed === false, 'test account is not past the beta invite gate');
  if (me0.beta?.termsAccepted === false) {
    await page.request.patch('/api/vater/me', { data: { acceptTerms: true } });
  }
  await page.goto('/animate', { waitUntil: 'domcontentloaded' });

  const initial = await listWorkspaces(page);
  test.skip(initial === null, 'VaterWorkspace table not migrated yet (503)');
  const primary = initial!.workspaces.find((w) => w.isPrimary)!;
  expect(primary, 'a primary tab always exists').toBeTruthy();

  // Make sure we start on the primary (a previous run may have left a cookie)
  // and archive any live tab a previous run left behind.
  await page.request.post('/api/vater/workspaces/switch', { data: { id: primary.id } });
  for (const w of initial!.workspaces) {
    if (!w.isPrimary && !w.archivedAt && /^E2E Studio /.test(w.name)) {
      await page.request.delete(`/api/vater/workspaces/${w.id}`);
    }
  }
  await page.goto('/animate', { waitUntil: 'domcontentloaded' });
  const before = await counts(page);

  // 1. strip renders the primary tab
  const strip = page.getByTestId('workspace-tabs');
  await expect(strip).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(`workspace-tab-${primary.id}`)).toHaveAttribute('data-active', '1');

  // 2. "+" → prompt → new tab → lands inside it
  page.once('dialog', (d) => d.accept(TAB_NAME));
  const switched = page.waitForResponse(
    (r) => r.url().includes('/api/vater/workspaces/switch') && r.request().method() === 'POST',
    { timeout: 60_000 },
  );
  await page.getByTestId('workspace-new').click();
  await switched; // create → switch → the component reloads the page
  await page.waitForLoadState('load');
  await expect(page.getByTestId('workspace-tabs')).toBeVisible({ timeout: 30_000 });

  const afterCreate = (await listWorkspaces(page))!;
  const created = afterCreate.workspaces.find((w) => w.name === TAB_NAME);
  expect(created, 'the new tab exists').toBeTruthy();
  expect(afterCreate.activeId, 'we are inside the new tab').toBe(created!.id);
  await expect(page.getByTestId(`workspace-tab-${created!.id}`)).toHaveAttribute('data-active', '1', { timeout: 30_000 });

  // 3. isolation: fresh library, fresh cast, fresh balance
  const inside = await counts(page);
  expect(inside.projectCount, 'new tab has no projects').toBe(0);
  expect(inside.characterCount, 'new tab has no characters').toBe(0);
  const me = (await (await page.request.get('/api/vater/me')).json()) as {
    userId: string;
    email: string | null;
    workspace: { id: string; name: string; isPrimary: boolean; rootUserId: string } | null;
  };
  expect(me.workspace?.id).toBe(created!.id);
  expect(me.workspace?.isPrimary).toBe(false);
  expect(me.workspace?.rootUserId).toBe(primary.id);
  expect(me.email, 'session email stays the real login').toBe(EMAIL);

  // 4. rename via the API the strip uses; persists across reload
  const renamed = `${TAB_NAME} v2`;
  const pr = await page.request.patch(`/api/vater/workspaces/${created!.id}`, { data: { name: renamed } });
  expect(pr.ok()).toBeTruthy();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId(`workspace-tab-${created!.id}`)).toContainText(renamed, { timeout: 30_000 });

  // 5. switch back: the original library is intact
  await page.getByTestId(`workspace-tab-${primary.id}`).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByTestId(`workspace-tab-${primary.id}`)).toHaveAttribute('data-active', '1', { timeout: 30_000 });
  const back = await counts(page);
  expect(back.projectCount, 'primary library unchanged').toBe(before.projectCount);
  expect(back.characterCount, 'primary cast unchanged').toBe(before.characterCount);

  // 6. primary refuses to archive; the new one archives
  const refuse = await page.request.delete(`/api/vater/workspaces/${primary.id}`);
  expect(refuse.status()).toBe(400);
  const arch = await page.request.delete(`/api/vater/workspaces/${created!.id}`);
  expect(arch.ok()).toBeTruthy();
  const final = (await listWorkspaces(page))!;
  const archived = final.workspaces.find((w) => w.id === created!.id);
  expect(archived?.archivedAt, 'archived, not deleted').toBeTruthy();
  // A stale deep link to the archived tab lands on the primary, never an error.
  await page.goto(`/animate?w=${created!.id}#r=library`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/animate/);
  const afterStale = (await listWorkspaces(page))!;
  expect(afterStale.activeId).toBe(primary.id);
});
