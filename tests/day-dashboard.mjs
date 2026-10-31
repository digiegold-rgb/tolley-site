// Synthetic fixtures only. No network, real secrets, customer data or database.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
let pin = false, reads = 0, pulls = 0, allowed = true;
let data = { snapshot: null, storage: 'ready' };
let subscriptions = [], transactions = [], invoices = [];
let receiptQuery;
const rows = list => ({ async *[Symbol.asyncIterator]() { yield* list; } });
const stubs = {
  'server-only': {},
  '@/lib/shop-auth': { hasValidShopAdminCookie: async () => pin },
  '@/lib/day/store': { readSnapshot: async () => { reads++; return data; }, refreshSnapshot: async () => { pulls++; return data; }, snapshotKey: () => 'test:day' },
  '@/lib/rate-limit': { consumeRateLimit: async () => ({ allowed, retryAfterSeconds: 30 }) },
  '@/lib/prisma': { prisma: {} },
  stripe: class { subscriptions = { list: () => rows(subscriptions) }; balanceTransactions = { list: q => { receiptQuery = q; return rows(transactions); } }; invoices = { list: () => rows(invoices) }; },
};
const cache = new Map();
function load(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name in stubs) return stubs[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const path = name.startsWith('@/') ? resolve(root, name.slice(2)) : resolve(dirname(file), name);
      for (const ext of ['.ts', '.tsx']) if (existsSync(path + ext)) return load(path + ext);
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}
const core = load('lib/day/core.ts');
const auth = load('lib/day/auth.ts');
assert.equal(auth.hasBearer(new Request('https://test/day', { headers: { authorization: 'Bearer undefined' } }), undefined), false);
assert.equal(auth.hasBearer(new Request('https://test/day?token=secret'), 'secret'), false);
assert.equal(auth.hasBearer(new Request('https://test/day', { headers: { authorization: 'Bearer fixture' } }), 'fixture'), true);
for (const [date, hour, length] of [['2026-03-08T18:00:00Z', 11, 23], ['2026-11-01T18:00:00Z', 12, 25]]) {
  const d = new Date(date); const { start, end } = core.dailyBounds(d);
  assert.equal((end - start) / 3600000, length);
  const run = new Date(d); run.setUTCHours(hour, 0, 0, 0);
  assert.equal(core.isSixCentral(run), true);
  run.setUTCHours(hour === 11 ? 12 : 11);
  assert.equal(core.isSixCentral(run), false);
}
const api = load('app/api/day/route.ts');
const summary = load('app/day/summary.txt/route.ts');
const cron = load('app/api/cron/day-snapshot/route.ts');
process.env.DAY_SUMMARY_TOKEN = 'summary-fixture'; delete process.env.CRON_SECRET;
assert.equal((await api.GET()).status, 401);
assert.equal((await api.POST(new Request('https://test/api/day', { method: 'POST' }))).status, 401);
assert.equal((await summary.GET(new Request('https://test/day/summary.txt'))).status, 401);
assert.equal((await summary.GET(new Request('https://test/day/summary.txt?token=summary-fixture'))).status, 401);
assert.equal((await cron.GET(new Request('https://test/api/cron/day-snapshot', { headers: { authorization: 'Bearer undefined' } }))).status, 401);
assert.equal(reads + pulls, 0, 'authorization must run before any data access');
pin = true;
assert.equal((await api.GET()).status, 200);
assert.equal((await api.POST(new Request('https://test/api/day', { method: 'POST', headers: { origin: 'https://evil', 'content-type': 'application/json' } }))).status, 403);
assert.equal(pulls, 0, 'cross-origin refresh must not fetch');
const request = () => new Request('https://test/api/day', { method: 'POST', headers: { origin: 'https://test', 'content-type': 'application/json' }, body: '{}' });
assert.equal((await api.POST(request())).status, 200); assert.equal(pulls, 1);
allowed = false; assert.equal((await api.POST(request())).status, 429); assert.equal(pulls, 1);
pin = false;
const bearer = () => new Request('https://test/day/summary.txt', { headers: { authorization: 'Bearer summary-fixture' } });
assert.equal((await summary.GET(bearer())).status, 503, 'no snapshot must not claim current data');
const sections = Object.fromEntries(core.SECTION_IDS.map(id => [id, core.stub(id, 'Unavailable')]));
data = { storage: 'ready', snapshot: { version: 1, generatedAt: '2026-10-31T11:00:00.000Z', day: '2026-10-31', sections } };
const text = core.summaryText(data.snapshot, new Date('2026-11-01T12:00:00Z'));
assert.equal(text.trim().split('\n').length, 3); assert.match(text, /STALE/); assert.match(text, /stub/); assert.doesNotMatch(text, /\$0/);
const response = await summary.GET(bearer());
assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private.*no-store/); assert.match(response.headers.get('content-type'), /text\/plain/);
assert.equal((await api.GET()).status, 401, 'summary token is not a shop credential');
const { stripeSection } = load('lib/day/sources.ts');
process.env.STRIPE_SECRET_KEY = 'fixture';
const price = { id: 'price_1Rxey029zOZYc3GpfoFkUbmv', unit_amount: 5800, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } };
const sub = (id, status, quantity = 1, p = price) => ({ id, status, items: { has_more: false, data: [{ quantity, price: p }] } });
subscriptions = [sub('active', 'active', 2), sub('late', 'past_due'), sub('trial', 'trialing'), sub('cancel', 'canceled'), sub('other', 'active', 1, { ...price, id: 'other' })];
transactions = [{ type: 'charge', amount: 20000, currency: 'usd' }, { type: 'payment', amount: 5000, currency: 'usd' }, { type: 'refund', amount: -3000, currency: 'usd' }, { type: 'payout', amount: -50000, currency: 'usd' }];
invoices = [{ parent: { subscription_details: { subscription: 'late' } }, due_date: 1, amount_remaining: 5800, currency: 'usd' }, { parent: { subscription_details: { subscription: 'active' } }, due_date: 9999999999, amount_remaining: 5800, currency: 'usd' }];
const result = await stripeSection(new Date('2026-11-01T15:00:00Z'));
assert.deepEqual(result.metrics.map(m => m.value), ['$174.00', '$250.00', '$58.00']);
assert.equal(receiptQuery.created.gte, Date.parse('2026-11-01T05:00:00Z') / 1000);
assert.equal(receiptQuery.created.lt, Date.parse('2026-11-02T06:00:00Z') / 1000);
subscriptions = [sub('year', 'active', 2, { ...price, unit_amount: 120000, recurring: { interval: 'year', interval_count: 1 } })];
assert.equal((await stripeSection(new Date())).metrics[0].value, '$200.00');
subscriptions[0].items.has_more = true;
await assert.rejects(stripeSection(new Date()), /Incomplete/);
subscriptions = [sub('foreign', 'active', 1, { ...price, currency: 'eur' })];
await assert.rejects(stripeSection(new Date()), /currency/);
delete process.env.STRIPE_SECRET_KEY;
assert.equal((await stripeSection(new Date())).status, 'stub');
console.log('Day dashboard: authorization, CSRF, rate limit, DST, summary, Stripe accounting fixtures passed.');
// Cache isolation and newer-write protection using a synthetic existing table.
let row = null, writes = 0, failStorage = false;
const table = { findUnique: async () => { if (failStorage) throw new Error('fixture storage down'); return row; }, upsert: async args => { writes++; row = { meta: args.create.meta }; } };
stubs['@/lib/prisma'].prisma = { siteEvent: table, $transaction: async fn => fn({ siteEvent: table, $executeRaw: async () => 1 }) };
stubs['./sources'] = { pullSnapshot: async () => data.snapshot };
const store = load('lib/day/store.ts');
process.env.VERCEL_ENV = 'production'; const productionKey = store.snapshotKey();
process.env.VERCEL_ENV = 'preview'; process.env.VERCEL_GIT_COMMIT_REF = 'branch-a'; const keyA = store.snapshotKey();
process.env.VERCEL_GIT_COMMIT_REF = 'branch-b'; assert.notEqual(store.snapshotKey(), keyA); assert.notEqual(keyA, productionKey);
assert.deepEqual(await store.readSnapshot(), { snapshot: null, storage: 'ready' });
assert.equal((await store.refreshSnapshot()).storage, 'ready'); assert.equal(writes, 1);
const newer = { ...data.snapshot, generatedAt: '2026-11-01T12:00:00.000Z', day: '2026-11-01' }; row = { meta: newer };
assert.equal((await store.refreshSnapshot()).snapshot.generatedAt, newer.generatedAt); assert.equal(writes, 1, 'older concurrent pull must not overwrite new data');
failStorage = true;
assert.equal((await store.readSnapshot()).storage, 'unavailable');
const unsaved = await store.refreshSnapshot(); assert.equal(unsaved.storage, 'unavailable'); assert.ok(unsaved.snapshot, 'live results can be shown with explicit failed-save status');
console.log('Day cache: environment isolation, persistence, older-write protection and unavailable storage passed.');
