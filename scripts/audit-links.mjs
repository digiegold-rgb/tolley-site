#!/usr/bin/env node
/**
 * audit-links — build-time guardrail against "missing links" (CTO audit
 * 2026-07-06). Fails the build when the site graph drifts:
 *
 *   1. BROKEN LINK   — a static internal href points at a route that has no
 *                      matching app/ page, route handler, or public/ asset.
 *   2. ORPHAN PAGE   — a top-level page route has no inbound link anywhere,
 *                      is not a registered subsite, and is not allowlisted.
 *   3. REGISTRY 404  — an app/<x>/agent.ts manifest advertises a url with no
 *                      matching page.
 *
 * Non-fatal warnings: prisma models that are written but never read, and
 * checkout metadata products/sources with no webhook branch.
 *
 * Run: node scripts/audit-links.mjs   (wired into `npm run build`)
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const APP = join(ROOT, "app");

// ── intentional exceptions ──────────────────────────────────────────────────
// Pages that are deliberately reachable only by URL (paid ads, direct sends,
// owner dashboards linked from /admin). Add here CONSCIOUSLY, with a reason.
const ORPHAN_ALLOWLIST = new Set([
  "/clean", // SEO/ads variant of /cleanouts — same quote API, different brand
  "/lastmile", // registered subsite, B2B direct-send landing
  "/junkinjays", // registered subsite; traffic via ads + phone tracking
  "/moupins", // registered subsite; direct-send client page
  "/e-and-t", // registered subsite; wedding client page, direct link
  "/demo", // /demo/[slug] operator previews are sent 1:1
  "/v", // /v/[slug] video-offer pages are sent 1:1
  "/results", // share-link landing (redirects to /start)
  "/login", // auth entry; linked via redirects/headers, not always static href
  "/signup",
  "/settings",
  // Owner dashboards — linked from the /admin quick-links strip, which is
  // data-driven (href={...}) and therefore invisible to this static scan.
  "/action",
  "/chat",
  "/content",
  "/manus",
  "/media",
  "/tv",
  "/research", // PIN-gated deep-research search, owner tool like /tv
  "/signature", // owner tool — animated email signature preview/installer
]);
// Hrefs that resolve outside the app/ page tree but are real.
const VIRTUAL_PATHS = [
  "/sitemap.xml",
  "/robots.txt",
  "/api/", // API namespace — existence checked against route.ts set
  "/go/", // link-shortener route handlers
  "/s/", // share-token route handler
  "/.well-known/",
];

// ── collect app routes ──────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const appFiles = walk(APP);
const pageRoutes = []; // e.g. "/shop/dashboard", "/pools/[sku]"
const apiRoutes = []; // e.g. "/api/pools/checkout"
for (const f of appFiles) {
  const rel = "/" + relative(APP, f).replace(/\\/g, "/");
  if (/\/page\.(tsx|jsx|ts|js)$/.test(rel)) {
    let route = rel.replace(/\/page\.(tsx|jsx|ts|js)$/, "") || "/";
    route = route.replace(/\/\([^)]+\)/g, ""); // strip route groups
    if (route.split("/").some((seg) => seg.startsWith("_"))) continue; // private
    pageRoutes.push(route === "" ? "/" : route);
  }
  if (/\/route\.(ts|js)$/.test(rel)) {
    apiRoutes.push(rel.replace(/\/route\.(ts|js)$/, ""));
  }
}

function routeToRegex(route) {
  const pattern = route
    .split("/")
    .map((seg) => {
      if (/^\[\.\.\..*\]$/.test(seg)) return ".+";
      if (/^\[.*\]$/.test(seg)) return "[^/]+";
      return seg.replace(/[.*+?^${}()|\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${pattern}/?$`);
}
const pageMatchers = pageRoutes.map((r) => ({ route: r, re: routeToRegex(r) }));
const handlerMatchers = apiRoutes.map((r) => ({ route: r, re: routeToRegex(r) }));

function resolves(href) {
  const path = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  if (pageMatchers.some((m) => m.re.test(path))) return true;
  if (handlerMatchers.some((m) => m.re.test(path))) return true;
  if (VIRTUAL_PATHS.some((v) => path === v.replace(/\/$/, "") || path.startsWith(v)))
    return true;
  // public/ asset (images, pdfs) referenced by href
  if (existsSync(join(ROOT, "public", path))) return true;
  return false;
}

// ── collect internal hrefs from source ──────────────────────────────────────
const SRC_DIRS = ["app", "components", "lib"].map((d) => join(ROOT, d));
const hrefStatic = new Map(); // href -> first source file
const hrefPrefixes = new Set(); // template-literal prefixes, e.g. "/pools/"

const HREF_RE =
  /(?:href=|href:\s*|redirect\(|router\.push\(|navigate\()\s*["'](\/[^"'\s]*)["']/g;
const HREF_TPL_RE = /(?:href=|href:\s*|redirect\(|router\.push\()\s*\{?`(\/[^`$]*)\$\{/g;

for (const dir of SRC_DIRS) {
  if (!existsSync(dir)) continue;
  for (const f of walk(dir)) {
    if (!/\.(tsx|ts|jsx|js|mjs)$/.test(f)) continue;
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(HREF_RE)) {
      const href = m[1];
      if (href.startsWith("//")) continue;
      if (!hrefStatic.has(href)) hrefStatic.set(href, relative(ROOT, f));
    }
    for (const m of text.matchAll(HREF_TPL_RE)) hrefPrefixes.add(m[1]);
  }
}

// ── registry parsing (regex — keeps this script dependency-free) ────────────
const registeredUrls = new Map(); // url -> agent file
for (const f of appFiles.filter((f) => /\/agent\.(ts|js)$/.test(f))) {
  const m = readFileSync(f, "utf8").match(/\burl:\s*["'](\/[^"']*)["']/);
  if (m) registeredUrls.set(m[1], relative(ROOT, f));
}

// ── check 1: broken links ───────────────────────────────────────────────────
const broken = [];
for (const [href, src] of hrefStatic) {
  if (!resolves(href)) broken.push({ href, src });
}

// ── check 2: orphan top-level pages ─────────────────────────────────────────
const topLevel = pageRoutes.filter(
  (r) => r !== "/" && r.split("/").length === 2 && !r.includes("[")
);
function isLinked(route) {
  for (const href of hrefStatic.keys()) {
    const path = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
    if (path === route || path.startsWith(route + "/")) return true;
  }
  for (const p of hrefPrefixes) {
    if (p === route + "/" || p.startsWith(route + "/") || p === route) return true;
  }
  return false;
}
const orphans = topLevel.filter(
  (r) => !isLinked(r) && !registeredUrls.has(r) && !ORPHAN_ALLOWLIST.has(r)
);

// ── check 3: registered urls must have a page ───────────────────────────────
// A manifest may advertise a namespace (e.g. /go, /pay) whose only routes are
// nested handlers/dynamic pages — accept those too.
const registry404 = [];
for (const [url, src] of registeredUrls) {
  const path = url.replace(/\/$/, "") || "/";
  const hasPage = pageMatchers.some((m) => m.re.test(path));
  const hasNested =
    pageRoutes.some((r) => r.startsWith(path + "/")) ||
    apiRoutes.some((r) => r.startsWith(path + "/"));
  if (!hasPage && !hasNested) registry404.push({ url, src });
}

// ── warnings: write-only prisma models ──────────────────────────────────────
const allSrc = SRC_DIRS.flatMap((d) => (existsSync(d) ? walk(d) : []))
  .filter((f) => /\.(tsx|ts)$/.test(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");
const models = [...schema.matchAll(/^model\s+(\w+)\s+\{/gm)].map((m) => m[1]);
const writeOnly = [];
for (const model of models) {
  const client = model[0].toLowerCase() + model.slice(1);
  const writes = new RegExp(`\\.${client}\\s*\\.\\s*(create|upsert)`, "s").test(allSrc);
  const reads = new RegExp(
    `\\.${client}\\s*\\.\\s*(findMany|findFirst|findUnique|count|groupBy|aggregate)`,
    "s"
  ).test(allSrc);
  if (writes && !reads) writeOnly.push(model);
}

// ── report ──────────────────────────────────────────────────────────────────
let failed = false;
if (broken.length) {
  failed = true;
  console.error(`\n✖ BROKEN LINKS (${broken.length}) — href resolves to nothing:`);
  for (const b of broken) console.error(`   ${b.href}   ← ${b.src}`);
}
if (orphans.length) {
  failed = true;
  console.error(
    `\n✖ ORPHAN PAGES (${orphans.length}) — no inbound link, not registered, not allowlisted:`
  );
  for (const o of orphans)
    console.error(`   ${o}   (link it, register it in lib/subsites.ts, or allowlist it here)`);
}
if (registry404.length) {
  failed = true;
  console.error(`\n✖ REGISTRY 404s (${registry404.length}) — manifest url has no page:`);
  for (const r of registry404) console.error(`   ${r.url}   ← ${r.src}`);
}
if (writeOnly.length) {
  console.warn(
    `\n⚠ write-only prisma models (written, never read — leads may be vanishing): ${writeOnly.join(", ")}`
  );
}
console.log(
  `\naudit-links: ${pageRoutes.length} pages, ${apiRoutes.length} handlers, ${hrefStatic.size} static hrefs, ${registeredUrls.size} registered subsites — ${failed ? "FAIL" : "OK"}`
);
process.exit(failed ? 1 : 0);
