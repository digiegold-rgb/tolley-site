/**
 * tests/e2e/audit/hq.spec.ts — READ-ONLY audit sweep of /hq.
 *
 * Auth: POST /api/hq/auth {pin} (see app/api/hq/auth/route.ts — body shape is
 * `{ pin: string }`, response sets the httpOnly `wd_admin` cookie). The PIN
 * comes from AUDIT_HQ_PIN, falling back to WD_ADMIN_PIN_TOLLEY in .env.local.
 *
 * Every tab in app/hq/page.tsx TABS is visited via /hq?tab=<t>, plus
 * /hq/storefront. For each: networkidle, screenshots + overflow at 3
 * viewports, safe-click sweep, internal-link crawl.
 *
 * Nothing here mutates: the harness network guard aborts every non-GET
 * /api/** request except the auth allowlist.
 *
 * Run:
 *   set -a; . ~/.config/tolley-audit.env; set +a
 *   AUDIT_OUT_DIR=/home/jelly/Shared/site-audit/2026-08-15/baseline \
 *   npm run audit:hq
 */
import { test, expect } from '@playwright/test';

import {
  AUDIT_OUT_DIR,
  AUDIT_TIER,
  BASE_URL,
  assertNoHardFailures,
  attachCollectors,
  checkInternalLinks,
  gotoSettled,
  hqPin,
  installNetworkGuard,
  newCollector,
  safeClickSweep,
  shot,
  sweepViewports,
  writeReport,
  type AuditReport,
  type RouteRecord,
} from './_harness';

// Mirrors TABS in app/hq/page.tsx:47.
const TABS = [
  'empire',
  'must',
  'pipeline',
  'inbound',
  'approvals',
  'money',
  'estates',
  'stats',
  'site',
  'chats',
  'hauls',
  'posts',
  'tiktok',
  'bk',
  'dnc',
] as const;

const TRACK = 'hq';

test.describe.configure({ mode: 'serial' });

test('hq audit sweep', async ({ page }) => {
  test.setTimeout(3 * 60 * 60 * 1000);

  const c = newCollector();
  attachCollectors(page, c);
  await installNetworkGuard(page, c);

  const routes: RouteRecord[] = [];
  const startedAt = new Date().toISOString();

  const finish = () => {
    writeReport(TRACK, {
      track: TRACK,
      tier: AUDIT_TIER,
      baseUrl: BASE_URL,
      startedAt,
      finishedAt: new Date().toISOString(),
      routes,
      collector: c,
    } satisfies AuditReport);
  };

  try {
    /* ── 0. Unauthenticated posture ───────────────────────────────────── */
    c.route = 'unauth:/hq';
    await gotoSettled(page, '/hq');
    const pinInput = page.locator('input[placeholder="Enter PIN"]');
    const pinVisible = await pinInput
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    const unauthShot = await shot(page, TRACK, 'unauth-hq');
    routes.push({
      id: c.route,
      url: `${BASE_URL}/hq`,
      persona: 'signed-out',
      notes: [pinVisible ? 'PIN screen shown' : 'NO PIN SCREEN — investigate'],
      overflow: {},
      screenshots: [unauthShot],
    });
    expect(pinVisible, '/hq unauthenticated must show the PIN screen').toBe(true);

    c.route = 'unauth:/api/hq/leads';
    const leadsUnauth = await page.request.get(`${BASE_URL}/api/hq/leads`);
    routes.push({
      id: c.route,
      url: `${BASE_URL}/api/hq/leads`,
      persona: 'signed-out',
      notes: [`status=${leadsUnauth.status()} (expected 401)`],
      overflow: {},
      screenshots: [],
    });
    expect(leadsUnauth.status(), 'GET /api/hq/leads unauthenticated must be 401').toBe(401);

    /* ── 1. Authenticate ──────────────────────────────────────────────── */
    const pin = hqPin();
    expect(
      typeof pin === 'string' && pin.length > 0,
      'AUDIT_HQ_PIN or WD_ADMIN_PIN_TOLLEY (.env.local) must be set',
    ).toBe(true);

    c.route = 'auth';
    const authRes = await page.request.post(`${BASE_URL}/api/hq/auth`, {
      data: { pin },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(authRes.status(), 'POST /api/hq/auth should return 200').toBe(200);

    /* ── 2. Every tab ─────────────────────────────────────────────────── */
    const targets: Array<{ id: string; path: string }> = [
      ...TABS.map((t) => ({ id: `tab:${t}`, path: `/hq?tab=${t}` })),
      { id: 'page:/hq/storefront', path: '/hq/storefront' },
    ];

    for (const target of targets) {
      c.route = target.id;
      const nav = () => gotoSettled(page, target.path);
      const quickNav = () => gotoSettled(page, target.path, 15_000, true);
      await nav();

      const sweep = await sweepViewports(page, TRACK, target.id);
      await safeClickSweep(page, c, quickNav);
      await nav();
      await checkInternalLinks(page, c);

      routes.push({
        id: target.id,
        url: `${BASE_URL}${target.path}`,
        persona: 'admin (PIN)',
        notes: [],
        overflow: sweep.overflow,
        screenshots: sweep.screenshots,
      });
      // Flush after every route so a timeout or kill still leaves a report.
      finish();
      // eslint-disable-next-line no-console
      console.log(`[audit:hq] done ${target.id}`);
    }
  } finally {
    finish();
    // eslint-disable-next-line no-console
    console.log(`[audit:hq] output → ${AUDIT_OUT_DIR}/${TRACK}`);
  }

  assertNoHardFailures(c);
});
