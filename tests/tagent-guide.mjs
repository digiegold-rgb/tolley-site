// Exercise real pages and download handler with isolated auth. No database or
// production mutations; this is not an authenticated deployment/browser test.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const original = readFileSync(resolve(root, 'docs/product/tagent-personal-use-20260909.md'), 'utf8');
let session = null, reads = 0, failRead = false;
const stubs = {
  'server-only': {},
  '@/auth': { auth: async () => session },
  '@/lib/admin-auth': { isAdminEmail: email => email === 'owner@example.invalid' },
  'next/navigation': {
    redirect: path => { throw new Error(`REDIRECT:${path}`); },
    notFound: () => { throw new Error('NOT_FOUND'); },
  },
  'node:fs/promises': { readFile: async (...args) => {
    reads++;
    if (failRead) throw new Error('private filesystem diagnostic');
    return readFile(...args);
  } },
  'react-markdown': { __esModule: true, default: ReactMarkdown },
  'remark-gfm': { __esModule: true, default: remarkGfm },
};
const cache = new Map();
function load(relative) {
  const file = resolve(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} };
  cache.set(file, mod);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', code)(name => {
    if (name in stubs) return stubs[name];
    if (name.startsWith('@/')) {
      for (const ext of ['.ts', '.tsx']) {
        const target = name.slice(2) + ext;
        if (existsSync(resolve(root, target))) return load(target);
      }
    }
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
}

const { GET } = load('app/api/leads/guide/plan/route.ts');
const Guide = load('app/leads/(workspace)/guide/page.tsx').default;
const OwnerPlan = load('app/leads/(workspace)/guide/owner/page.tsx').default;
assert.equal((await GET()).status, 401);
await assert.rejects(Guide, /REDIRECT:\/login\?callbackUrl=%2Fleads%2Fguide$/);
await assert.rejects(OwnerPlan, /REDIRECT:\/login\?/);

session = { user: { id: 'customer', email: 'customer@example.invalid' } };
assert.equal((await GET()).status, 403);
await assert.rejects(OwnerPlan, /NOT_FOUND/);
const customerHtml = renderToStaticMarkup(await Guide());
assert.ok(!customerHtml.includes('/hq'));
assert.ok(!customerHtml.includes('/guide/owner'));
assert.ok(!customerHtml.includes('business-os'));
assert.ok(!customerHtml.includes('/api/leads/guide/plan'));
for (const href of ['/leads#capture', '/leads#week-review', '/leads/clients', '/leads/deals', '/leads/overview']) {
  assert.ok(customerHtml.includes(`href="${href}"`), `Working guide links to ${href}`);
}

session = { user: { id: 'owner', email: 'owner@example.invalid' }, mfaRequired: true };
assert.equal((await GET()).status, 403);
await assert.rejects(Guide, /REDIRECT:\/login\/mfa-challenge/);
await assert.rejects(OwnerPlan, /REDIRECT:\/login\/mfa-challenge/);
assert.equal(reads, 0, 'Denied sessions cannot read the owner document');

session.mfaRequired = false;
const download = await GET();
assert.equal(download.status, 200);
assert.equal(await download.text(), original, 'Download is the exact original Markdown');
assert.equal(download.headers.get('cache-control'), 'private, no-store');
assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
assert.match(download.headers.get('content-type'), /^text\/markdown/);
assert.match(download.headers.get('content-disposition'), /attachment; filename="tagent-personal-use-20260909.md"/);
const ownerHtml = renderToStaticMarkup(await Guide());
assert.ok(ownerHtml.includes('href="/leads/guide/owner"'));
assert.ok(ownerHtml.includes('href="/api/leads/guide/plan"'));
assert.ok(ownerHtml.includes('href="/hq?tab=inbound"'));
const planHtml = renderToStaticMarkup(await OwnerPlan());
assert.ok(planHtml.includes('<h1>Make T-Agent useful to its owner first</h1>'));
assert.ok(planHtml.includes('<h2>Seven-day usefulness test</h2>'));
assert.ok(planHtml.includes('href="https://help.followupboss.com/'));
assert.ok(!planHtml.includes('## Seven-day'));

failRead = true;
const unavailable = await GET();
assert.equal(unavailable.status, 503);
assert.equal(unavailable.headers.get('cache-control'), 'private, no-store');
assert.ok(!(await unavailable.text()).includes('private filesystem'));
const today = readFileSync(resolve(root, 'components/leads/daily/DailyDesk.tsx'), 'utf8');
for (const anchor of ['capture', 'week-review']) assert.ok(today.includes(`id="${anchor}"`));
console.log('T-Agent guide passed: auth/MFA, owner isolation, exact Markdown download, error privacy, rendered document, and workflow links.');
