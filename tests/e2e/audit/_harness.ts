/**
 * tests/e2e/audit/_harness.ts
 *
 * Shared, READ-ONLY audit harness for the /hq + /animate overhaul.
 *
 * Safety model — three independent layers, any one of which is enough to keep
 * a run from mutating production:
 *
 *   1. HARD NETWORK GUARANTEE (`installNetworkGuard`) — a page-level route
 *      handler INTERCEPTS every non-GET request to `/api/**` except a tiny
 *      auth allowlist and answers it locally with a 204. Even if a dangerous
 *      button slips past layer 2, the write never leaves the browser. Every
 *      block is recorded and logged.
 *   2. SAFE-CLICK POLICY (`safeClickSweep`) — clickable elements whose
 *      accessible name / href / data-testid matches DANGER_RE are never
 *      clicked, nor are form submits, nor `target=_blank` / external links.
 *   3. No spec ever issues a non-GET request itself except the two documented
 *      auth calls (`/api/hq/auth`, NextAuth credentials callback).
 *
 * Outputs `${AUDIT_OUT_DIR}/${track}/report.json` and `report.md` plus
 * full-page screenshots under `${AUDIT_OUT_DIR}/${track}/shots/`.
 *
 * Env:
 *   PLAYWRIGHT_BASE_URL   default https://www.tolley.io
 *   AUDIT_OUT_DIR         default /home/jelly/Shared/site-audit/<YYYY-MM-DD>
 *   AUDIT_TIER            free-form label recorded in the report
 *   AUDIT_HQ_PIN          falls back to WD_ADMIN_PIN_TOLLEY in .env.local
 *   AUDIT_ANIMATE_EMAIL / AUDIT_ANIMATE_PASSWORD
 *   AUDIT_STUDIO_EMAIL / AUDIT_STUDIO_PASSWORD   (optional persona c)
 *   AUDIT_MAX_CLICKS      per-route safe-click cap, default 12
 */
import { expect, type Page, type Request, type Response } from '@playwright/test';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/* ── config ──────────────────────────────────────────────────────────── */

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://www.tolley.io';
export const AUDIT_TIER = process.env.AUDIT_TIER || 'baseline';
export const MAX_CLICKS = Number.parseInt(process.env.AUDIT_MAX_CLICKS || '12', 10);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export const AUDIT_OUT_DIR =
  process.env.AUDIT_OUT_DIR || `/home/jelly/Shared/site-audit/${today()}`;

export const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

/**
 * Never click anything whose accessible name / href / testid matches this.
 *
 * Hardened after the 2026-08-15 baseline: the original list keyed on exact
 * phrases ("create video", "create style", "add card") and so missed
 * "+ Create New Style", "Create course + 25 lessons" and "Add a card", each of
 * which fired a real POST that only the network guard stopped
 * (`/api/vater/youtube/styles`, `/api/vater/course`, `/api/vater/billing/setup`).
 * `create`, `card`, `lesson` and `new style` are now blanket-skipped.
 */
export const DANGER_RE =
  /approve|animate|render|compose|generate|publish|upload|pay|buy|checkout|card|purchase|delete|remove|logout|sign out|disconnect|reset|clear|send|reply|save|create|new style|lesson|start|run|kick|retry|regenerate|clone|record|stripe|portal|invoice|zelle|bulk|mark|complete|assign|import|seed|reject|cancel|export|download|submit|confirm/i;

/** Non-GET requests allowed through the network guard (auth only). */
const WRITE_ALLOWLIST: RegExp[] = [
  /\/api\/auth\/callback\/credentials/,
  /\/api\/auth\/csrf/,
  /\/api\/auth\/session/,
  /\/api\/auth\/signin/,
  /\/api\/hq\/auth/,
];

/* ── env helpers ─────────────────────────────────────────────────────── */

const ENV_LOCAL = resolve(__dirname, '../../../.env.local');

/** Read a single key out of ~/tolley-site/.env.local (no dotenv dependency). */
export function readEnvLocal(key: string): string | undefined {
  if (!existsSync(ENV_LOCAL)) return undefined;
  for (const line of readFileSync(ENV_LOCAL, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!m || m[1] !== key) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v;
  }
  return undefined;
}

export function hqPin(): string | undefined {
  return process.env.AUDIT_HQ_PIN || readEnvLocal('WD_ADMIN_PIN_TOLLEY');
}

/* ── collectors ──────────────────────────────────────────────────────── */

export interface ConsoleError {
  route: string;
  kind: 'console' | 'pageerror';
  text: string;
}
export interface BadResponse {
  route: string;
  url: string;
  status: number;
  method: string;
}
export interface FailedRequest {
  route: string;
  url: string;
  method: string;
  failure: string;
}
export interface BlockedWrite {
  route: string;
  url: string;
  method: string;
}
export interface SkippedClick {
  route: string;
  label: string;
  reason: string;
}
export interface ClickResult {
  route: string;
  label: string;
  outcome: 'ok' | 'error';
  detail?: string;
}
export interface ExternalLink {
  route: string;
  href: string;
  label: string;
  target: string | null;
}

export interface Collector {
  /** Mutable — set this before each navigation so records are attributed. */
  route: string;
  consoleErrors: ConsoleError[];
  badResponses: BadResponse[];
  failedRequests: FailedRequest[];
  blockedWrites: BlockedWrite[];
  skippedClicks: SkippedClick[];
  clicks: ClickResult[];
  externalLinks: ExternalLink[];
  deadLinks: BadResponse[];
  /** Count of third-party requests the sandbox could not reach (runner noise). */
  thirdPartyBlocked: number;
}

export function newCollector(): Collector {
  return {
    route: '(setup)',
    consoleErrors: [],
    badResponses: [],
    failedRequests: [],
    blockedWrites: [],
    skippedClicks: [],
    clicks: [],
    externalLinks: [],
    deadLinks: [],
    thirdPartyBlocked: 0,
  };
}

/**
 * Noise we do not want cluttering the report. The bare "Failed to load
 * resource: net::ERR_FAILED" line carries no URL and, in this sandbox, is
 * emitted for every third-party beacon (Google Analytics et al.) that has no
 * egress — it says nothing about the site. Real resource failures still show
 * up in `failedRequests` and `badResponses`, which do carry URLs.
 */
const CONSOLE_NOISE =
  /Download the React DevTools|\[HMR\]|Failed to load resource: net::(ERR_BLOCKED_BY_CLIENT|ERR_FAILED|ERR_ABORTED)/i;

export function attachCollectors(page: Page, c: Collector): Collector {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (CONSOLE_NOISE.test(text)) return;
    c.consoleErrors.push({ route: c.route, kind: 'console', text: text.slice(0, 2000) });
  });

  page.on('pageerror', (err: Error) => {
    c.consoleErrors.push({
      route: c.route,
      kind: 'pageerror',
      text: `${err.name}: ${err.message}`.slice(0, 2000),
    });
  });

  page.on('response', (res: Response) => {
    if (res.status() < 400) return;
    c.badResponses.push({
      route: c.route,
      url: res.url(),
      status: res.status(),
      method: res.request().method(),
    });
  });

  const siteOrigin = new URL(BASE_URL).origin;
  page.on('requestfailed', (req: Request) => {
    const failure = req.failure()?.errorText || 'unknown';
    const url = req.url();
    // Third-party requests (analytics/beacons/fonts) fail because this sandbox
    // has no egress to them. Count them, but keep them out of the findings —
    // they are a property of the runner, not of tolley.io.
    let origin = '';
    try {
      origin = new URL(url).origin;
    } catch {
      origin = '';
    }
    if (origin && origin !== siteOrigin) {
      c.thirdPartyBlocked += 1;
      return;
    }
    // Requests we fulfilled ourselves are recorded as blockedWrites already.
    if (req.method() !== 'GET' && /\/api\//.test(url)) return;
    c.failedRequests.push({ route: c.route, url, method: req.method(), failure });
  });

  return c;
}

/**
 * HARD NETWORK GUARANTEE — abort every non-GET `/api/**` request that is not
 * on the auth allowlist. Installed once per page, before any navigation.
 */
export async function installNetworkGuard(page: Page, c: Collector): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const method = req.method().toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      await route.continue();
      return;
    }
    const url = req.url();
    if (WRITE_ALLOWLIST.some((re) => re.test(url))) {
      await route.continue();
      return;
    }
    c.blockedWrites.push({ route: c.route, url, method });
    // eslint-disable-next-line no-console
    console.log(`[audit-guard] BLOCKED ${method} ${url} (route=${c.route})`);
    // Fulfill with a benign 204 rather than abort(): the request still never
    // reaches the server, but the page does not emit a bogus "Failed to load
    // resource" console error that would pollute the findings.
    await route.fulfill({ status: 204, body: '' });
  });
}

/* ── viewport / overflow / screenshots ───────────────────────────────── */

export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth > d.clientWidth + 1;
  });
}

export function shotPath(track: string, name: string): string {
  const p = join(AUDIT_OUT_DIR, track, 'shots', `${name.replace(/[^\w.@-]+/g, '_')}.png`);
  mkdirSync(dirname(p), { recursive: true });
  return p;
}

export async function shot(page: Page, track: string, name: string): Promise<string> {
  const path = shotPath(track, name);
  await page.screenshot({ path, fullPage: true }).catch(() => {});
  return path;
}

export interface ViewportSweep {
  overflow: Record<string, boolean>;
  screenshots: string[];
}

/**
 * Screenshot + horizontal-overflow check at 1440x900, 1024x768, 390x844.
 * Restores the desktop viewport on exit so later interaction is stable.
 */
export async function sweepViewports(
  page: Page,
  track: string,
  name: string,
): Promise<ViewportSweep> {
  const out: ViewportSweep = { overflow: {}, screenshots: [] };
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(400);
    out.overflow[vp.name] = await hasHorizontalOverflow(page).catch(() => false);
    out.screenshots.push(await shot(page, track, `${name}@${vp.name}`));
  }
  await page.setViewportSize({ width: VIEWPORTS[0].width, height: VIEWPORTS[0].height });
  await page.waitForTimeout(200);
  return out;
}

/* ── navigation ──────────────────────────────────────────────────────── */

/**
 * goto + best-effort networkidle, never throws on the idle timeout.
 *
 * `quick` skips the networkidle wait entirely — used for the re-navigation
 * between safe clicks, where we only need the DOM back in its baseline shape,
 * not every lazy fetch settled. Waiting for networkidle there costs up to 15s
 * per click and pushes a full sweep past any sane test timeout.
 */
export async function gotoSettled(
  page: Page,
  url: string,
  timeout = 15_000,
  quick = false,
): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (quick) {
    await page.waitForTimeout(700);
    return;
  }
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
}

/**
 * Navigate to a hash route. `page.goto` on a same-document hash change does
 * NOT re-run the app's mount-time hash parser (components/animate/Shell.tsx
 * listens for `popstate`, not `hashchange`), so we force a reload whenever the
 * pathname is unchanged. Also useful as the "re-goto" after each safe click.
 */
export async function gotoHashRoute(
  page: Page,
  url: string,
  timeout = 15_000,
  quick = false,
): Promise<void> {
  const target = new URL(url, BASE_URL);
  let current: URL | null = null;
  try {
    current = new URL(page.url());
  } catch {
    current = null;
  }
  const sameDoc =
    current !== null && current.pathname === target.pathname && current.search === target.search;
  await page.goto(target.toString(), { waitUntil: 'domcontentloaded' });
  if (sameDoc) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  if (quick) {
    await page.waitForTimeout(900);
    return;
  }
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
}

/* ── safe-click sweep ────────────────────────────────────────────────── */

const CLICK_SELECTOR = 'button, [role=button], a[href^="#"], a[href^="/"]';

interface Candidate {
  index: number;
  label: string;
  href: string | null;
  target: string | null;
  testid: string | null;
  tag: string;
  inForm: boolean;
  visible: boolean;
}

// NOTE: `page.$$eval` is Playwright's locator-scoped DOM query API. It is not
// JavaScript `eval()` — the callback is a statically-defined function that
// Playwright serializes; no dynamic/untrusted code is ever compiled.
async function enumerate(page: Page): Promise<Candidate[]> {
  return page.$$eval(CLICK_SELECTOR, (els) =>
    els.map((el, index) => {
      const e = el as HTMLElement;
      const anchor = e as HTMLAnchorElement;
      const name =
        e.getAttribute('aria-label') ||
        e.getAttribute('title') ||
        (e.textContent || '').replace(/\s+/g, ' ').trim();
      const rect = e.getBoundingClientRect();
      return {
        index,
        label: name.slice(0, 120) || '(unnamed)',
        href: anchor.getAttribute ? anchor.getAttribute('href') : null,
        target: e.getAttribute('target'),
        testid: e.getAttribute('data-testid'),
        tag: e.tagName.toLowerCase(),
        inForm: !!e.closest('form') && (e.getAttribute('type') || '') !== 'button',
        visible: rect.width > 0 && rect.height > 0,
      };
    }),
  );
}

function screen(cand: Candidate): string | null {
  const probe = [cand.label, cand.href || '', cand.testid || ''].join(' ');
  if (!cand.visible) return 'not visible';
  if (DANGER_RE.test(probe)) return 'danger-name';
  if (cand.target === '_blank') return 'target=_blank';
  if (cand.inForm && (cand.tag === 'button' || cand.tag === 'input')) return 'form control';
  if (cand.href && /^https?:\/\//i.test(cand.href) && !cand.href.startsWith(BASE_URL)) {
    return 'external href';
  }
  return null;
}

/**
 * Click every safe clickable on the current page, one at a time, pressing
 * Escape and re-navigating between each so state never compounds.
 */
export async function safeClickSweep(
  page: Page,
  c: Collector,
  navigate: () => Promise<void>,
): Promise<void> {
  const initial = await enumerate(page).catch(() => [] as Candidate[]);

  for (const cand of initial) {
    if (cand.target === '_blank' || (cand.href && /^https?:\/\//i.test(cand.href))) {
      c.externalLinks.push({
        route: c.route,
        href: cand.href || '',
        label: cand.label,
        target: cand.target,
      });
    }
    const reason = screen(cand);
    if (reason) c.skippedClicks.push({ route: c.route, label: cand.label, reason });
  }

  const clickable = initial.filter((cd) => screen(cd) === null).slice(0, MAX_CLICKS);
  if (clickable.length < initial.filter((cd) => screen(cd) === null).length) {
    c.skippedClicks.push({
      route: c.route,
      label: `(+${initial.filter((cd) => screen(cd) === null).length - clickable.length} more)`,
      reason: `AUDIT_MAX_CLICKS=${MAX_CLICKS} cap`,
    });
  }

  for (const cand of clickable) {
    try {
      const fresh = await enumerate(page);
      const match = fresh[cand.index];
      // The DOM may have shifted; only click if the element still looks the
      // same AND still passes the screen.
      if (!match || match.label !== cand.label || screen(match) !== null) {
        c.skippedClicks.push({ route: c.route, label: cand.label, reason: 'DOM shifted' });
        await navigate();
        continue;
      }
      const el = page.locator(CLICK_SELECTOR).nth(cand.index);
      await el.click({ timeout: 5_000, trial: false });
      await page.waitForTimeout(600);
      c.clicks.push({ route: c.route, label: cand.label, outcome: 'ok' });
    } catch (err) {
      c.clicks.push({
        route: c.route,
        label: cand.label,
        outcome: 'error',
        detail: err instanceof Error ? err.message.split('\n')[0].slice(0, 300) : String(err),
      });
    }
    await page.keyboard.press('Escape').catch(() => {});
    await navigate();
  }
}

/* ── internal link crawl ─────────────────────────────────────────────── */

/** Every internal URL already probed this run — keeps the crawl O(unique). */
const linkCache = new Map<string, number>();

/**
 * GET every internal <a href> on the current page via the page's own request
 * context (cookies included). Records anything >= 400 as a dead link. Each
 * distinct URL is fetched at most once per run.
 */
export async function checkInternalLinks(page: Page, c: Collector): Promise<void> {
  const hrefs = await page
    .$$eval('a[href]', (els) =>
      Array.from(new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute('href') || ''))),
    )
    .catch(() => [] as string[]);

  for (const href of hrefs) {
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue;
    }
    let abs: URL;
    try {
      abs = new URL(href, BASE_URL);
    } catch {
      continue;
    }
    if (abs.origin !== new URL(BASE_URL).origin) continue;
    const key = abs.pathname + abs.search;
    const cached = linkCache.get(key);
    if (cached !== undefined) {
      if (cached >= 400 || cached === 0) {
        c.deadLinks.push({ route: c.route, url: key, status: cached, method: 'GET (cached)' });
      }
      continue;
    }
    try {
      const res = await page.request.get(abs.toString(), { maxRedirects: 5, timeout: 20_000 });
      linkCache.set(key, res.status());
      if (res.status() >= 400) {
        c.deadLinks.push({
          route: c.route,
          url: key,
          status: res.status(),
          method: 'GET',
        });
      }
    } catch (err) {
      linkCache.set(key, 0);
      c.deadLinks.push({
        route: c.route,
        url: abs.pathname + abs.search,
        status: 0,
        method: `GET (${err instanceof Error ? err.message.slice(0, 80) : 'error'})`,
      });
    }
  }
}

/* ── per-route record + report writer ────────────────────────────────── */

export interface RouteRecord {
  id: string;
  url: string;
  persona?: string;
  notes: string[];
  overflow: Record<string, boolean>;
  screenshots: string[];
}

export interface AuditReport {
  track: string;
  tier: string;
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  routes: RouteRecord[];
  collector: Collector;
}

export function writeReport(track: string, report: AuditReport): { json: string; md: string } {
  const dir = join(AUDIT_OUT_DIR, track);
  mkdirSync(dir, { recursive: true });
  const jsonPath = join(dir, 'report.json');
  const mdPath = join(dir, 'report.md');

  writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const c = report.collector;
  const L: string[] = [];
  L.push(`# Audit report — ${track}`);
  L.push('');
  L.push(`- Base URL: \`${report.baseUrl}\``);
  L.push(`- Tier: \`${report.tier}\``);
  L.push(`- Started: ${report.startedAt}  →  Finished: ${report.finishedAt}`);
  L.push(`- Routes visited: **${report.routes.length}**`);
  L.push('');
  L.push('## Totals');
  L.push('');
  L.push('| metric | count |');
  L.push('| --- | ---: |');
  L.push(`| console errors | ${c.consoleErrors.filter((e) => e.kind === 'console').length} |`);
  L.push(`| pageerrors (uncaught) | ${c.consoleErrors.filter((e) => e.kind === 'pageerror').length} |`);
  L.push(`| responses >= 500 | ${c.badResponses.filter((r) => r.status >= 500).length} |`);
  L.push(`| responses 400-499 | ${c.badResponses.filter((r) => r.status < 500).length} |`);
  L.push(`| dead internal links | ${c.deadLinks.length} |`);
  L.push(`| failed requests | ${c.failedRequests.length} |`);
  L.push(`| blocked writes (guard) | ${c.blockedWrites.length} |`);
  L.push(`| third-party requests unreachable (runner noise) | ${c.thirdPartyBlocked} |`);
  L.push(`| safe clicks performed | ${c.clicks.filter((x) => x.outcome === 'ok').length} |`);
  L.push(`| clicks that errored | ${c.clicks.filter((x) => x.outcome === 'error').length} |`);
  L.push(`| clicks skipped by policy | ${c.skippedClicks.length} |`);
  L.push(
    `| routes w/ horizontal overflow | ${report.routes.filter((r) => Object.values(r.overflow).some(Boolean)).length} |`,
  );
  L.push('');

  L.push('## Per-route');
  L.push('');
  for (const r of report.routes) {
    const ce = c.consoleErrors.filter((e) => e.route === r.id);
    const br = c.badResponses.filter((e) => e.route === r.id);
    const dl = c.deadLinks.filter((e) => e.route === r.id);
    const bw = c.blockedWrites.filter((e) => e.route === r.id);
    const ck = c.clicks.filter((e) => e.route === r.id);
    const sk = c.skippedClicks.filter((e) => e.route === r.id);
    L.push(`### \`${r.id}\`${r.persona ? ` — persona: ${r.persona}` : ''}`);
    L.push('');
    L.push(`- URL: \`${r.url}\``);
    L.push(
      `- Overflow: ${Object.entries(r.overflow)
        .map(([k, v]) => `${k}=${v ? '**YES**' : 'no'}`)
        .join(', ') || 'n/a'}`,
    );
    if (r.notes.length) L.push(`- Notes: ${r.notes.map((n) => `\`${n}\``).join(' · ')}`);
    L.push(
      `- Console errors: ${ce.length} · >=400 responses: ${br.length} · dead links: ${dl.length} · blocked writes: ${bw.length} · clicks: ${ck.length} (skipped ${sk.length})`,
    );
    for (const e of ce) L.push(`  - \`${e.kind}\` ${e.text.slice(0, 300)}`);
    for (const e of br) L.push(`  - HTTP **${e.status}** ${e.method} ${e.url.slice(0, 200)}`);
    for (const e of dl) L.push(`  - DEAD LINK **${e.status}** ${e.url}`);
    for (const e of bw) L.push(`  - guard blocked ${e.method} ${e.url.slice(0, 200)}`);
    for (const e of ck.filter((x) => x.outcome === 'error')) {
      L.push(`  - click ERROR "${e.label}" — ${e.detail}`);
    }
    L.push(`- Screenshots: ${r.screenshots.length}`);
    for (const s of r.screenshots) L.push(`  - \`${s}\``);
    L.push('');
  }

  if (c.externalLinks.length) {
    L.push('## External / new-tab links (recorded, never followed)');
    L.push('');
    L.push('| route | label | href |');
    L.push('| --- | --- | --- |');
    const seen = new Set<string>();
    for (const e of c.externalLinks) {
      const k = `${e.route}|${e.href}`;
      if (seen.has(k)) continue;
      seen.add(k);
      L.push(`| \`${e.route}\` | ${e.label.slice(0, 60)} | \`${e.href.slice(0, 140)}\` |`);
    }
    L.push('');
  }

  writeFileSync(mdPath, L.join('\n'));
  // eslint-disable-next-line no-console
  console.log(`[audit] wrote ${jsonPath}\n[audit] wrote ${mdPath}`);
  return { json: jsonPath, md: mdPath };
}

/**
 * Fail the test ONLY on 5xx responses or uncaught pageerrors. 401/403/404 are
 * recorded as findings, not failures.
 */
export function assertNoHardFailures(c: Collector): void {
  const fivex = c.badResponses.filter((r) => r.status >= 500);
  const pageErrors = c.consoleErrors.filter((e) => e.kind === 'pageerror');
  expect(
    { fivex, pageErrors },
    `hard failures — ${fivex.length} 5xx, ${pageErrors.length} pageerror(s)`,
  ).toEqual({ fivex: [], pageErrors: [] });
}
