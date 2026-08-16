/**
 * tests/e2e/audit/animate.spec.ts — READ-ONLY audit sweep of /animate.
 *
 * Personas
 *   (a) signed-out  — /animate marketing landing (AnimateLanding), /login, /signup
 *   (b) public      — AUDIT_ANIMATE_EMAIL / AUDIT_ANIMATE_PASSWORD, a plain
 *                     account NOT on any allowlist. This is the tier a stranger
 *                     who signs up actually gets.
 *   (c) studio      — only when AUDIT_STUDIO_EMAIL / AUDIT_STUDIO_PASSWORD set.
 *
 * Sidebar routing note: components/animate/Shell.tsx parses the URL hash on
 * mount and on `popstate` — but NOT on `hashchange`. A same-document hash
 * change therefore does not re-route, so `gotoHashRoute` forces a reload.
 * That is a real product finding, recorded in FINDINGS.md.
 *
 * Run:
 *   set -a; . ~/.config/tolley-audit.env; set +a
 *   AUDIT_OUT_DIR=/home/jelly/Shared/site-audit/2026-08-15/baseline \
 *   npm run audit:animate
 */
import { test, expect, type Page } from '@playwright/test';

import {
  AUDIT_OUT_DIR,
  AUDIT_TIER,
  BASE_URL,
  assertNoHardFailures,
  attachCollectors,
  checkInternalLinks,
  gotoHashRoute,
  gotoSettled,
  hasHorizontalOverflow,
  installNetworkGuard,
  newCollector,
  safeClickSweep,
  shot,
  sweepViewports,
  writeReport,
  type AuditReport,
  type Collector,
  type RouteRecord,
} from './_harness';

const TRACK = 'animate';

/** Studio route ids driven through the URL hash (`/animate#r=<id>`). */
const STUDIO_ROUTES = [
  'dashboard',
  'direct',
  'script-review',
  'library',
  'queue',
  'recent',
  'voices',
  'feeds',
  'autopilot',
  'publishing',
  'niche-finder',
  'styles',
  'project-history',
  'video-editor',
  'course',
  'rules',
  'pricing',
  'discord',
] as const;

/**
 * The studio hydrates its chrome (sidebar, header) after `networkidle`, so
 * every geometry/DOM lookup below waits this long first. Verified: without it
 * the sidebar lookup returns nothing and the theme toggle is never found.
 */
const STUDIO_SETTLE_MS = 2_500;

const EMAIL = process.env.AUDIT_ANIMATE_EMAIL;
const PASSWORD = process.env.AUDIT_ANIMATE_PASSWORD;

/** Credentialed login through the real /login UI. Mirrors loginViaUI in vater-v2-3click.spec.ts. */
async function loginViaUI(page: Page, email: string, password: string, callback = '/animate') {
  await gotoSettled(page, `/login?callbackUrl=${encodeURIComponent(callback)}`);
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  const pw = page.locator('input[type="password"], input[name="password"]');
  await expect(pw.first(), '/login must expose a password field').toBeVisible({ timeout: 15_000 });
  await pw.first().fill(password);
  await page
    .locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Sign in")')
    .first()
    .click();
  await page
    .waitForURL((u) => !/\/login(\/|$|\?)/.test(u.pathname), { timeout: 60_000 })
    .catch(() => {});
}

/**
 * Header theme toggle. Today it is an unlabeled `<div onClick={toggle}>`
 * wrapping the sun/moon Icon (components/animate/Header.tsx:141) — no role, no
 * aria-label, so there is nothing accessible to target. We prefer Track B's
 * data-testid and otherwise fall back to the round pointer divs in the header:
 * [0] = bell (inert), [1] = theme toggle.
 */
async function toggleTheme(page: Page): Promise<boolean> {
  await page.waitForTimeout(STUDIO_SETTLE_MS);
  const byTestId = page.locator('[data-testid="theme-toggle"]');
  if (await byTestId.count()) {
    await byTestId.first().click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);
    return true;
  }
  const round = page.locator('div[style*="border-radius: 50%"][style*="cursor: pointer"]');
  const n = await round.count().catch(() => 0);
  if (n >= 2) {
    await round.nth(1).click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

/**
 * Read the current theme. The studio paints its own containers and leaves
 * `body` transparent, so body background is useless as a fingerprint. Instead
 * sample the first non-transparent background walking up from a point inside
 * the main content area, and include the dominant text color.
 *
 * `page.evaluate` is Playwright's in-page execution API with a statically
 * defined callback — not JavaScript `eval()`; no dynamic code is compiled.
 */
async function themeFingerprint(page: Page): Promise<string> {
  return page
    .evaluate(() => {
      const transparent = (c: string) => !c || c === 'transparent' || /rgba\(0, 0, 0, 0\)/.test(c);
      let el: Element | null = document.elementFromPoint(
        Math.floor(window.innerWidth * 0.65),
        Math.floor(window.innerHeight * 0.5),
      );
      let bg = '';
      while (el) {
        const c = getComputedStyle(el).backgroundColor;
        if (!transparent(c)) {
          bg = c;
          break;
        }
        el = el.parentElement;
      }
      if (!bg) bg = getComputedStyle(document.documentElement).backgroundColor;
      const fg = getComputedStyle(document.body).color;
      return `bg=${bg} fg=${fg}`;
    })
    .catch(() => 'unknown');
}

/**
 * The studio sidebar renders as a plain `<div>` (not `<aside>`) with inline
 * styles, no landmark role and no testid, so there is nothing semantic to
 * query. Both helpers below locate it by geometry instead: the first
 * full-height, left-anchored column between 56px and 320px wide.
 *
 * These run through `page.evaluate`, Playwright's in-page execution API with
 * statically defined callbacks — not JavaScript `eval()`. No dynamic code is
 * ever compiled, and nothing from the page is executed as source.
 */

/** Sidebar collapse toggle — Track B's testid first, then the chevron div. */
async function toggleSidebar(page: Page): Promise<boolean> {
  // The studio paints its chrome after networkidle; without this the geometry
  // lookup below runs against a pre-hydration DOM and finds nothing.
  await page.waitForTimeout(STUDIO_SETTLE_MS);
  const byTestId = page.locator('[data-testid="sidebar-toggle"]');
  if (await byTestId.count()) {
    await byTestId.first().click({ timeout: 5_000 }).catch(() => {});
    await page.waitForTimeout(400);
    return true;
  }
  // Fallback: inside the sidebar, the only pointer element that has an <svg>
  // and no text of its own is the collapse chevron.
  const clicked = await page
    .evaluate(() => {
      const findSidebar = (): HTMLElement | null => {
        for (const el of Array.from(document.querySelectorAll('div'))) {
          const r = el.getBoundingClientRect();
          if (r.left <= 2 && r.width >= 56 && r.width <= 320 && r.height > window.innerHeight * 0.6) {
            return el as HTMLElement;
          }
        }
        return null;
      };
      const sidebar = findSidebar();
      if (!sidebar) return false;
      for (const el of Array.from(sidebar.querySelectorAll('div'))) {
        const style = el.getAttribute('style') || '';
        if (!style.includes('cursor: pointer')) continue;
        if ((el.textContent || '').trim()) continue;
        if (!el.querySelector('svg')) continue;
        (el as HTMLElement).click();
        return true;
      }
      return false;
    })
    .catch(() => false);
  await page.waitForTimeout(400);
  return clicked;
}

/**
 * Enumerate sidebar nav entries. Prefers Track B's `data-testid="nav-<id>"`
 * and falls back to the labels of the current plain `<div onClick>` rows.
 */
async function enumerateSidebar(page: Page): Promise<string[]> {
  await page.waitForTimeout(STUDIO_SETTLE_MS);
  const byTestId = await page
    .$$eval('[data-testid^="nav-"]', (els) =>
      els.map((e) => (e.getAttribute('data-testid') || '').replace(/^nav-/, '')),
    )
    .catch(() => [] as string[]);
  if (byTestId.length) return byTestId;
  return page
    .evaluate(() => {
      const findSidebar = (): HTMLElement | null => {
        for (const el of Array.from(document.querySelectorAll('div'))) {
          const r = el.getBoundingClientRect();
          if (r.left <= 2 && r.width >= 56 && r.width <= 320 && r.height > window.innerHeight * 0.6) {
            return el as HTMLElement;
          }
        }
        return null;
      };
      const sidebar = findSidebar();
      if (!sidebar) return [] as string[];
      const out: string[] = [];
      for (const el of Array.from(sidebar.querySelectorAll('div'))) {
        const style = el.getAttribute('style') || '';
        if (!style.includes('cursor: pointer')) continue;
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length > 40) continue;
        if (!out.includes(text)) out.push(text);
      }
      return out;
    })
    .catch(() => [] as string[]);
}

/**
 * Phone sweep of the signed-out marketing landing.
 *
 * 390px is in the shared VIEWPORTS sweep already, but only as a recorded
 * boolean nobody reads until the report is opened. The landing is the one
 * page a stranger sees first, so its phone layout gets a real assertion —
 * and 360px (the narrowest phone still in meaningful use) is added, since
 * that is where a fixed two-column grid or an unwrapped table shows up as
 * a sideways scroll.
 *
 * Also checks the demo media is cheap to arrive at: <video> must carry a
 * poster and preload="none", or every visitor downloads tens of megabytes
 * of MP4 they never asked to play.
 */
async function auditLandingPhone(page: Page, c: Collector, routes: RouteRecord[]) {
  const id = 'signed-out:/animate@phone';
  c.route = id;
  await gotoSettled(page, '/animate');

  const notes: string[] = [];
  const screenshots: string[] = [];
  const overflow: Record<string, boolean> = {};

  for (const w of [360, 390]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(400);
    const over = await hasHorizontalOverflow(page).catch(() => false);
    overflow[`phone-${w}`] = over;
    screenshots.push(await shot(page, TRACK, `signed-out-landing@${w}`));
    notes.push(over ? `HORIZONTAL OVERFLOW at ${w}px` : `no horizontal overflow at ${w}px`);
    expect.soft(over, `/animate landing must not scroll sideways at ${w}px`).toBe(false);
  }

  // Demo media hygiene — read-only DOM inspection, nothing is played.
  const media = await page
    .$$eval('video', (els) =>
      els.map((v) => ({
        preload: v.getAttribute('preload'),
        poster: v.getAttribute('poster'),
        autoplay: v.hasAttribute('autoplay'),
        controls: v.hasAttribute('controls'),
        src: (v.getAttribute('src') || '').slice(0, 80),
      })),
    )
    .catch(() => [] as { preload: string | null; poster: string | null; autoplay: boolean; controls: boolean; src: string }[]);
  notes.push(`<video> elements: ${media.length}`);
  for (const m of media) {
    notes.push(
      `video src=${JSON.stringify(m.src)} preload=${m.preload} poster=${m.poster ? 'yes' : 'MISSING'} autoplay=${m.autoplay} controls=${m.controls}`,
    );
    expect.soft(m.preload, 'landing demo video must not preload').toBe('none');
    expect.soft(Boolean(m.poster), 'landing demo video must have a poster').toBe(true);
    expect.soft(m.autoplay, 'landing demo video must not autoplay').toBe(false);
  }

  // Copy sweep: nothing on the public page may still promise the retired
  // pricing model. Cheap to assert, and it is the exact thing that rotted.
  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
  for (const stale of ['$24.85', 'NO CARD REQUIRED', 'no card required', 'First video free', '~$25']) {
    const present = bodyText.toLowerCase().includes(stale.toLowerCase());
    if (present) notes.push(`STALE COPY on landing: ${JSON.stringify(stale)}`);
    expect.soft(present, `retired pricing copy ${JSON.stringify(stale)} must be gone`).toBe(false);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  routes.push({
    id,
    url: `${BASE_URL}/animate`,
    persona: 'signed-out',
    notes,
    overflow,
    screenshots,
  });
}

/**
 * The 7-step project editor (`#r=editor&s=<0..6>&p=<projectId>`).
 *
 * Shell.tsx falls back to the Dashboard when no `p=` is present, so a bare
 * `#r=editor` audits nothing. A project id is discovered READ-ONLY from
 * GET /api/vater/youtube — this never creates a project, and an account
 * with no projects yet is recorded as skipped rather than failed.
 */
async function auditEditorSteps(
  page: Page,
  c: Collector,
  routes: RouteRecord[],
  persona: string,
  flush: () => void,
) {
  c.route = `${persona}:editor-discovery`;
  let projectId: string | null = null;
  let discovery = '';
  try {
    const res = await page.request.get(`${BASE_URL}/api/vater/youtube`);
    if (res.ok()) {
      const body = (await res.json()) as { projects?: { id?: string }[] };
      projectId = body.projects?.[0]?.id ?? null;
      discovery = `GET /api/vater/youtube status=${res.status()} projects=${body.projects?.length ?? 0}`;
    } else {
      discovery = `GET /api/vater/youtube status=${res.status()}`;
    }
  } catch (err) {
    discovery = `GET /api/vater/youtube threw: ${String(err).slice(0, 120)}`;
  }

  if (!projectId) {
    routes.push({
      id: `${persona}:#r=editor:SKIPPED`,
      url: `${BASE_URL}/animate#r=editor`,
      persona,
      notes: [discovery, 'no existing project to open — editor steps skipped (this audit never creates one)'],
      overflow: {},
      screenshots: [],
    });
    flush();
    return;
  }

  for (let step = 0; step <= 6; step += 1) {
    const path = `/animate#r=editor&s=${step}&p=${projectId}`;
    const id = `${persona}:#r=editor&s=${step}`;
    c.route = id;
    await gotoHashRoute(page, path);
    await page.waitForTimeout(STUDIO_SETTLE_MS);

    const heading = await page
      .locator('h1, h2, [role=heading]')
      .first()
      .textContent()
      .catch(() => null);
    const sweep = await sweepViewports(page, TRACK, `${persona}-editor-s${step}`);
    routes.push({
      id,
      url: `${BASE_URL}${path}`,
      persona,
      notes: [
        step === 0 ? discovery : `step ${step}`,
        `first heading: ${JSON.stringify((heading || '(none)').trim().slice(0, 120))}`,
        sweep.overflow.mobile ? 'HORIZONTAL OVERFLOW at 390px' : 'no horizontal overflow at 390px',
      ],
      overflow: sweep.overflow,
      screenshots: sweep.screenshots,
    });
    flush();
    console.log(`[audit:animate] done ${id}`);
  }
}

async function auditStudioRoutes(
  page: Page,
  c: Collector,
  routes: RouteRecord[],
  persona: string,
  flush: () => void,
) {
  c.route = `${persona}:sidebar`;
  await gotoHashRoute(page, '/animate');
  const navIds = await enumerateSidebar(page);
  routes.push({
    id: `${persona}:sidebar`,
    url: `${BASE_URL}/animate`,
    persona,
    notes: [`sidebar entries (${navIds.length}): ${navIds.join(', ') || '(none found)'}`],
    overflow: {},
    screenshots: [],
  });

  for (const r of STUDIO_ROUTES) {
    const id = `${persona}:#r=${r}`;
    const path = r === 'dashboard' ? '/animate' : `/animate#r=${r}`;
    c.route = id;
    const nav = () => gotoHashRoute(page, path);
    const quickNav = () => gotoHashRoute(page, path, 15_000, true);
    await nav();

    const notes: string[] = [];

    // dark + light screenshots via the header theme toggle
    const themeA = await themeFingerprint(page);
    const sweep = await sweepViewports(page, TRACK, `${persona}-${r}-themeA`);
    await toggleTheme(page);
    const themeB = await themeFingerprint(page);
    const altShot = await shot(page, TRACK, `${persona}-${r}-themeB`);
    notes.push(
      themeA === themeB
        ? `THEME TOGGLE DID NOT CHANGE body bg (${themeA}) — toggle not reachable`
        : `theme A=${themeA} B=${themeB}`,
    );
    await toggleTheme(page); // restore

    // collapsed sidebar
    const collapsed = await toggleSidebar(page);
    const collapsedShot = collapsed
      ? await shot(page, TRACK, `${persona}-${r}-sidebar-collapsed`)
      : null;
    if (!collapsed) notes.push('no [data-testid="sidebar-toggle"] — collapse state not captured');
    if (collapsed) await toggleSidebar(page);

    // safe clicks + deep-link reload + back/forward
    await safeClickSweep(page, c, quickNav);
    await nav();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const afterReload = page.url();
    notes.push(`deep-link reload → ${afterReload.replace(BASE_URL, '')}`);
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.goForward({ waitUntil: 'domcontentloaded' }).catch(() => {});

    routes.push({
      id,
      url: `${BASE_URL}${path}`,
      persona,
      notes,
      overflow: sweep.overflow,
      screenshots: [...sweep.screenshots, altShot, ...(collapsedShot ? [collapsedShot] : [])],
    });
    flush();
    // eslint-disable-next-line no-console
    console.log(`[audit:animate] done ${id}`);
  }

  // Post-Stripe-return screen probe (GET only — never touches Stripe).
  c.route = `${persona}:card_added`;
  await gotoHashRoute(page, '/animate?card_added=1#r=pricing');
  const heading = await page
    .locator('h1, h2, [role=heading]')
    .first()
    .textContent()
    .catch(() => null);
  routes.push({
    id: `${persona}:?card_added=1#r=pricing`,
    url: `${BASE_URL}/animate?card_added=1#r=pricing`,
    persona,
    notes: [`first heading rendered: ${JSON.stringify((heading || '(none)').trim().slice(0, 120))}`],
    overflow: {},
    screenshots: [await shot(page, TRACK, `${persona}-card_added-pricing`)],
  });
}

test.describe.configure({ mode: 'serial' });

test('animate audit sweep', async ({ page }) => {
  test.setTimeout(4 * 60 * 60 * 1000);

  const c = newCollector();
  attachCollectors(page, c);
  await installNetworkGuard(page, c);

  const routes: RouteRecord[] = [];
  const startedAt = new Date().toISOString();

  // Flushed after every route so a timeout or kill still leaves a report.
  const flush = () =>
    writeReport(TRACK, {
      track: TRACK,
      tier: AUDIT_TIER,
      baseUrl: BASE_URL,
      startedAt,
      finishedAt: new Date().toISOString(),
      routes,
      collector: c,
    } satisfies AuditReport);

  try {
    /* ── persona (a): signed out ──────────────────────────────────────── */
    for (const path of ['/animate', '/login', '/signup']) {
      const id = `signed-out:${path}`;
      c.route = id;
      const nav = () => gotoSettled(page, path);
      const quickNav = () => gotoSettled(page, path, 15_000, true);
      await nav();
      const sweep = await sweepViewports(page, TRACK, `signed-out${path.replace(/\//g, '_')}`);
      await safeClickSweep(page, c, quickNav);
      await nav();
      await checkInternalLinks(page, c);
      const bodyLen = await page
        .evaluate(() => document.body.innerText.length)
        .catch(() => 0);
      routes.push({
        id,
        url: `${BASE_URL}${path}`,
        persona: 'signed-out',
        notes: [`rendered text length=${bodyLen}`],
        overflow: sweep.overflow,
        screenshots: sweep.screenshots,
      });
      flush();
      // eslint-disable-next-line no-console
      console.log(`[audit:animate] done ${id}`);
    }

    await auditLandingPhone(page, c, routes);
    flush();

    /* ── persona (b): public account ──────────────────────────────────── */
    if (!EMAIL || !PASSWORD) {
      routes.push({
        id: 'public:SKIPPED',
        url: `${BASE_URL}/animate`,
        persona: 'public',
        notes: ['AUDIT_ANIMATE_EMAIL / AUDIT_ANIMATE_PASSWORD not set — persona (b) skipped'],
        overflow: {},
        screenshots: [],
      });
    } else {
      c.route = 'public:login';
      await loginViaUI(page, EMAIL, PASSWORD, '/animate');
      const loggedIn = !/\/login/.test(new URL(page.url()).pathname);
      routes.push({
        id: 'public:login',
        url: page.url(),
        persona: 'public',
        notes: [loggedIn ? 'login OK' : 'LOGIN FAILED — still on /login'],
        overflow: {},
        screenshots: [await shot(page, TRACK, 'public-post-login')],
      });
      expect(loggedIn, 'public audit account must be able to sign in').toBe(true);

      // /api/vater/me may not exist until Track B ships — record, do not fail.
      c.route = 'public:/api/vater/me';
      const me = await page.request.get(`${BASE_URL}/api/vater/me`);
      let meBody = '';
      try {
        meBody = (await me.text()).slice(0, 400);
      } catch {
        meBody = '(unreadable)';
      }
      routes.push({
        id: 'public:GET /api/vater/me',
        url: `${BASE_URL}/api/vater/me`,
        persona: 'public',
        notes: [`status=${me.status()}`, `body=${JSON.stringify(meBody)}`],
        overflow: {},
        screenshots: [],
      });

      await auditStudioRoutes(page, c, routes, 'public', flush);
      await auditEditorSteps(page, c, routes, 'public', flush);
    }

    /* ── persona (c): studio tier (opt-in) ────────────────────────────── */
    const sEmail = process.env.AUDIT_STUDIO_EMAIL;
    const sPass = process.env.AUDIT_STUDIO_PASSWORD;
    if (sEmail && sPass) {
      c.route = 'studio:login';
      await page.context().clearCookies();
      await loginViaUI(page, sEmail, sPass, '/animate');
      await auditStudioRoutes(page, c, routes, 'studio', flush);
    } else {
      routes.push({
        id: 'studio:SKIPPED',
        url: `${BASE_URL}/animate`,
        persona: 'studio',
        notes: ['AUDIT_STUDIO_EMAIL not set — persona (c) skipped by design'],
        overflow: {},
        screenshots: [],
      });
    }
  } finally {
    flush();
    // eslint-disable-next-line no-console
    console.log(`[audit:animate] output → ${AUDIT_OUT_DIR}/${TRACK}`);
  }

  assertNoHardFailures(c);
});
