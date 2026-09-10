// Real route/auth/promotion modules with isolated fixtures. No network, paid
// scans, messages, or production data. PostgreSQL/browser acceptance is separate.
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createElement } from "react";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const { Prisma } = require("@prisma/client");
let session = null, cookie = null, calls = 0, failActivity = false, retryTransaction = false;
let state = { listing: [], probateSignal: [], distressSignal: [], lead: [], leadSubscriber: [{ id: "owner-sub", userId: "owner", status: "active" }, { id: "other-sub", userId: "other", status: "active" }], customerLeadState: [], crmTask: [], crmActivity: [] };
const matches = (row, where) => Object.entries(where ?? {}).every(([key, value]) => {
  if (key === "subscriberId_leadId") return matches(row, value);
  if (value && typeof value === "object" && "in" in value) return value.in.includes(row[key]);
  if (value === null) return row[key] == null;
  return row[key] === value;
});
const db = {};
for (const name of Object.keys(state)) {
  db[name] = {
    async findUnique({ where }) { calls++; return state[name].find(row => matches(row, where)) ?? null; },
    async findFirst(args) { return this.findUnique(args); },
    async findMany({ where } = {}) { calls++; return state[name].filter(row => matches(row, where)); },
    async groupBy() { calls++; return []; },
    async create({ data }) {
      calls++;
      if (name === "crmActivity" && failActivity) throw new Error("simulated activity failure");
      const row = { id: `${name}-${state[name].length}`, status: "pending", ownerSubscriberId: null, listingId: null, ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) };
      state[name].push(row);
      return row;
    },
    async update({ where, data }) { calls++; const row = state[name].find(row => matches(row, where)); assert.ok(row); Object.assign(row, data); return row; },
    async updateMany({ where, data }) { const rows = state[name].filter(row => matches(row, where)); for (const row of rows) Object.assign(row, data); return { count: rows.length }; },
    async upsert({ where, create, update }) { const row = await this.findUnique({ where }); return row ? this.update({ where, data: update }) : this.create({ data: create }); },
  };
}
let txQueue = Promise.resolve();
db.$transaction = (fn, options) => {
  assert.equal(options.isolationLevel, "Serializable");
  const task = txQueue.then(async () => {
    if (retryTransaction) { retryTransaction = false; throw new Prisma.PrismaClientKnownRequestError("retry", { code: "P2034", clientVersion: "test" }); }
    const before = structuredClone(state);
    try { return await fn(db); } catch (error) { state = before; throw error; }
  });
  txQueue = task.catch(() => {});
  return task;
};
const stubs = {
  "@/auth": { auth: async () => session },
  "@/lib/admin-auth": { isAdminEmail: email => email === "owner@example.invalid" },
  "@/lib/prisma": { prisma: db },
  "next/headers": { cookies: async () => ({ get: () => cookie }) },
  "next/navigation": {
    redirect: path => { throw new Error(`REDIRECT:${path}`); },
    permanentRedirect: path => { throw new Error(`PERMANENT:${path}`); },
    notFound: () => { throw new Error("NOT_FOUND"); },
    usePathname: () => "/leads/tools/probate",
  },
};
const cache = new Map();
function load(relative) {
  const file = resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", code)(name => {
    if (name in stubs) return stubs[name];
    if (name.endsWith(".css")) return {};
    if (name.startsWith("@/components/leads/tools/") && !name.endsWith("ToolNavigation")) return { __esModule: true, default: () => null };
    if (name.startsWith("@/")) {
      for (const ext of [".ts", ".tsx"]) if (existsSync(resolve(root, name.slice(2) + ext))) return load(name.slice(2) + ext);
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

const { OWNER_TOOLS } = load("lib/leads/owner-tools.ts");
const { validateOwnerTool } = load("lib/leads/owner-tool-auth.ts");
const Hub = load("app/leads/(workspace)/tools/page.tsx").default;
const Layout = load("app/leads/(workspace)/tools/layout.tsx").default;
const owner = { user: { id: "owner", email: "owner@example.invalid" }, mfaRequired: false };
const customer = { user: { id: "customer", email: "customer@example.invalid" } };
const query = Promise.resolve({ tag: ["one", "two"], product: "a & b" });
for (const tool of OWNER_TOOLS) {
  const Old = load(`app/shop/dashboard/${tool.legacy ? `${tool.legacy}/` : ""}page.tsx`).default;
  await assert.rejects(() => Old({ searchParams: query }), new RegExp(`PERMANENT:/leads/tools/${tool.slug}\\?tag=one&tag=two&product=a\\+%26\\+b`));
  const Page = load(`app/leads/(workspace)/tools/${tool.slug}/page.tsx`).default;
  for (const [who, denial] of [[null, /REDIRECT:\/login\?/], [customer, /NOT_FOUND/], [{ ...owner, mfaRequired: true }, /REDIRECT:\/login\/mfa-challenge/], [{ ...owner, impersonatedBy: "support" }, /NOT_FOUND/]]) {
    session = who; await assert.rejects(Page, denial);
  }
  session = owner; assert.ok(await Page());
}
session = null; await assert.rejects(() => Layout({ children: null }), /REDIRECT/);
session = customer; await assert.rejects(Hub, /NOT_FOUND/);
session = owner;
const html = renderToStaticMarkup(await Hub());
for (const tool of OWNER_TOOLS) assert.ok(html.includes(`href="/leads/tools/${tool.slug}"`));
const { buildCommands } = load("lib/command-registry.ts");
assert.equal(buildCommands({ navigate() {} }).filter(command => command.id.startsWith("owner.")).length, 0);
const commands = buildCommands({ owner: true, navigate() {} }).filter(command => command.id.startsWith("owner."));
assert.equal(commands.length, OWNER_TOOLS.length);
const Sidebar = load("components/leads/LeadsSidebar.tsx").default;
assert.ok(!renderToStaticMarkup(createElement(Sidebar, { owner: false })).includes('/leads/tools'));
assert.ok(renderToStaticMarkup(createElement(Sidebar, { owner: true })).includes('/leads/tools'));
assert.equal(calls, 0, "Page/auth checks cannot load business data for denied sessions");

const { validateShopAdmin, getExpectedToken } = load("lib/shop-auth.ts");
process.env.AUTH_SECRET = "fixture-only"; process.env.SHOP_ADMIN_PIN = "fixture-only";
assert.equal(await validateShopAdmin(), true, "Owner APIs work with the same session and no PIN cookie");
cookie = { value: getExpectedToken() };
session = { ...owner, mfaRequired: true }; assert.equal(await validateShopAdmin(), false);
session = { ...owner, impersonatedBy: "support" }; assert.equal(await validateShopAdmin(), false);
session = customer; cookie = null; assert.equal(await validateShopAdmin(), false);
session = null; assert.equal(await validateShopAdmin(), false);
assert.equal(await validateOwnerTool(), false);

const { persistSignalPromotion } = load("lib/leads/promote-signal.ts");
const signal = { id: "p1", status: "enriched", leadId: null, decedentName: "Deceased Person", matchedAddress: "10 Fixture Street", sourceUrl: "https://example.invalid/source" };
state.probateSignal.push(signal);
const data = { source: "probate-scan", notes: "Public evidence", ownerName: null };
retryTransaction = true;
state.listing.push({ id: "listing-p1", mlsId: "signal-probate-p1" });
const first = await persistSignalPromotion("probate", "p1", data, "owner-sub");
assert.equal(state.lead[0].listingId, "listing-p1", "Existing dossier listing is connected on adoption");
assert.equal(first.taskId, "signal:owner-sub:probate:p1");
assert.equal(state.lead.length, 1); assert.equal(state.crmTask.length, 1); assert.equal(state.crmActivity.length, 1);
assert.equal(state.customerLeadState[0].subscriberId, "owner-sub");
assert.equal(state.customerLeadState[0].notes, "Public evidence");
state.crmTask[0].status = "completed";
state.customerLeadState[0].notes = "Private annotation";
await Promise.all([persistSignalPromotion("probate", "p1", data, "owner-sub"), persistSignalPromotion("probate", "p1", data, "owner-sub")]);
assert.equal(state.lead.length, 1); assert.equal(state.crmTask.length, 1); assert.equal(state.crmActivity.length, 1);
assert.equal(state.crmTask[0].status, "completed", "Retry does not reopen finished work");
assert.equal(state.customerLeadState[0].notes, "Private annotation");
await persistSignalPromotion("probate", "p1", data, "other-sub");
assert.equal(state.lead.length, 1); assert.equal(state.crmTask.length, 2);
assert.notEqual(state.crmTask[0].subscriberId, state.crmTask[1].subscriberId);
const saved = structuredClone(state);
state.probateSignal.push({ ...signal, id: "rollback", leadId: null });
failActivity = true;
await assert.rejects(() => persistSignalPromotion("probate", "rollback", data, "owner-sub"), /simulated activity failure/);
failActivity = false;
assert.equal(state.lead.length, saved.lead.length); assert.equal(state.crmTask.length, saved.crmTask.length);
assert.equal(state.probateSignal.find(row => row.id === "rollback").leadId, null);
state.probateSignal.push({ ...signal, id: "dismissed", status: "dismissed" });
await assert.rejects(() => persistSignalPromotion("probate", "dismissed", data, "owner-sub"), /Restore/);
await assert.rejects(() => persistSignalPromotion("probate", "p1", data, "missing"), /Activate/);
state.lead[0].ownerSubscriberId = "other-sub";
await assert.rejects(() => persistSignalPromotion("probate", "p1", data, "owner-sub"), /another workspace/);
state.lead[0].ownerSubscriberId = null;
state.distressSignal.push({ id: "d1", status: "new", leadId: null, title: "Tax sale candidate", addressGuess: null, sourceUrl: null });
await persistSignalPromotion("distress", "d1", { source: "distress-tax-sale" }, "owner-sub");
assert.ok(state.crmTask.some(task => task.title.includes("Tax sale candidate")));

const { linkPromotedSignal } = load("lib/leads/signal-dossier-bridge.ts");
const distressLead = state.lead.find(lead => lead.id === state.distressSignal[0].leadId);
await linkPromotedSignal("distress", "d1", "later-listing");
assert.equal(distressLead.listingId, "later-listing");
await linkPromotedSignal("distress", "d1", "replacement");
assert.equal(distressLead.listingId, "later-listing", "Later scans preserve an existing listing selection");

const { NextRequest } = require("next/server");
const { PATCH } = load("app/api/serpapi/probate/[id]/route.ts");
const list = load("app/api/serpapi/probate/route.ts").GET;
const request = (body, origin = "https://example.invalid") => new NextRequest("https://example.invalid/api/serpapi/probate/p1", { method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
const params = { params: Promise.resolve({ id: "p1" }) };
const beforeDenied = calls;
for (session of [null, customer, { ...owner, mfaRequired: true }, { ...owner, impersonatedBy: "support" }]) {
  assert.equal((await PATCH(request({ status: "promoted" }), params)).status, 401);
  assert.equal((await list(new NextRequest("https://example.invalid/api/serpapi/probate"))).status, 401);
}
assert.equal(calls, beforeDenied);
session = owner;
assert.equal(await validateOwnerTool(new Request("https://example.invalid/api", { method: "POST", headers: { origin: "https://foreign.invalid" } })), false);
assert.equal(await validateOwnerTool(new Request("https://example.invalid/api", { method: "POST", headers: { origin: "https://example.invalid" } })), true);
assert.equal((await PATCH(request(null), params)).status, 400);
assert.equal((await PATCH(request({ status: "promoted" }, "https://foreign.invalid"), params)).status, 403);
assert.equal((await PATCH(request({ status: "made-up" }), params)).status, 400);
const adopted = await PATCH(request({ status: "promoted", subscriberId: "other-sub" }), params);
assert.equal(adopted.status, 200);
assert.equal((await adopted.json()).taskId, "signal:owner-sub:probate:p1", "Body cannot choose another workspace");
const listed = await list(new NextRequest("https://example.invalid/api/serpapi/probate"));
assert.equal((await listed.json()).signals.find(row => row.id === "p1").taskId, first.taskId);
// Every legacy dashboard page must be represented, including the previously
// unlinked distress tool. This prevents silently dropping a route during moves.
const pages = [];
function walk(dir) { for (const entry of readdirSync(dir, { withFileTypes: true })) { const path = resolve(dir, entry.name); if (entry.isDirectory()) walk(path); else if (entry.name === "page.tsx") pages.push(path); } }
walk(resolve(root, "app/shop/dashboard"));
assert.equal(pages.length, OWNER_TOOLS.length);
console.log("T-Agent tools passed: all dashboard redirects, owner/MFA/impersonation guards, navigation, shared sign-in, source adoption, private tasks, rollback, transaction retries, completed-task preservation, and request ownership.");
