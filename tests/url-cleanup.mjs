// Route behavior with isolated auth/DB fixtures; no network, production data, or writes.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const navigation = require('next/navigation');
let session = null, neighborhoods = [], products = [], dbReads = 0, creditsTouched = 0;
const credit = { balance: 137, subscriptionTier: 'legacy' };
const prisma = {
  neighborhoodPage: { findMany: async () => { dbReads++; return neighborhoods; } },
  product: { findMany: async () => { dbReads++; return products; }, count: async () => products.length },
  estateSale: { findMany: async () => [] },
  videoCredit: { upsert: async () => { creditsTouched++; }, findUnique: async () => ({...credit}) },
  waterReading: { findFirst: async () => null, findMany: async () => [] },
  poolCost: { aggregate: async () => ({ _sum: { amount: 0 } }) },
  poolInventory: { findMany: async () => [] },
};
const componentStub = new Proxy({__esModule:true}, {get: (target,key) => key === '__esModule' ? true : function Component() { return null; }});
const stubs = {
  'next/navigation': { ...navigation, usePathname: () => '/shop' },
  '@/auth': { auth: async () => session },
  '@/lib/prisma': { prisma },
  '@/lib/prisma-url': { withPrismaTimeout: async p => p },
  '@/lib/shop-auth': { validateShopAdmin: async () => true },
  '@sentry/nextjs': { withSentryConfig: c => c },
  './studio-client': componentStub,
  './persona-editor': componentStub,
  './pin-gate': componentStub,
};
const cache = new Map();
function load(file) {
  file = resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const source = ts.transpileModule(readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  const localRequire = name => {
    if (name in stubs) return stubs[name];
    if (name.startsWith('@/components/')) return componentStub;
    if (name.startsWith('@/') || name.startsWith('.')) {
      let p = name.startsWith('@/') ? resolve(root,name.slice(2)) : resolve(dirname(file),name);
      for (const extension of ['', '.ts','.tsx','.js','/index.ts']) if (existsSync(p+extension) && statSync(p+extension).isFile()) return load(p+extension);
    }
    return require(name);
  };
  new Function('require','module','exports','__filename','__dirname',source)(localRequire,mod,mod.exports,file,dirname(file));
  return mod.exports;
}
const page = path => load(`app/${path}/page.tsx`).default;
const props = { searchParams: Promise.resolve({utm_campaign:'fall sale',ref:'partner',tag:['a','b']}) };
async function redirected(fn, path, status=307) {
  await assert.rejects(fn, e => {
    assert.equal(e.digest?.split(';')[2],path);
    assert.equal(Number(e.digest?.split(';')[3]),status);
    return true;
  });
}
const {routeDestination, UNPROMOTED_SUBSITES} = load('lib/public-route-policy.ts');
const tagged = p => routeDestination(p,{utm_campaign:'fall sale',ref:'partner',tag:['a','b']});
assert.equal(tagged('/agent#demo'),'/agent?utm_campaign=fall+sale&ref=partner&tag=a&tag=b#demo');
assert.equal(routeDestination('/start',{next:'https://evil.invalid',empty:undefined}).startsWith('/start?'),true);
for(const path of ['gpu','game']) assert.equal(UNPROMOTED_SUBSITES.has(path),false);
for(const [from,to,status] of [['circle','/start',308],['clean','/cleanouts',308],['leads/(workspace)/connects','/leads/dashboard',307],['leads/(workspace)/dossier/property/[address]','/agent#demo',308]]) {
  await redirected(()=>page(from)(props),tagged(to),status);
}
for(const [path,to] of [['real-estate-agent','/homes'],['shop/videos','/shop']]) await redirected(()=>page(path)(props),tagged(to));
neighborhoods = [{slug:'independence',name:'Independence',state:'MO'}];
products = [{id:'item',title:'Chair',listings:[],targetPrice:25,imageUrls:[],videoUrl:'https://example.invalid/clip.mp4',status:'listed'}];
assert.ok(await page('real-estate-agent')(props));
assert.ok(await page('shop/videos')(props));
const sitemap = load('app/sitemap.ts').default;
let urls = (await sitemap()).map(s=>s.url);
for(const path of ['/gpu','/game','/shop/videos','/real-estate-agent','/real-estate-agent/independence']) assert.ok(urls.includes('https://www.tolley.io'+path),path);
for(const path of ['/circle','/clean','/vater','/advertising']) assert.ok(!urls.includes('https://www.tolley.io'+path),path);
neighborhoods=[]; products=[];
urls=(await sitemap()).map(s=>s.url);
for(const path of ['/shop/videos','/real-estate-agent']) assert.ok(!urls.includes('https://www.tolley.io'+path));
process.env.ADMIN_ALLOWLIST_EMAILS='owner@example.invalid';
process.env.VATER_ADMIN_ALLOWLIST_EMAILS='';
for(const path of ['vater','vater/dropship','vater/merch','vater/govbids','persona','water']) {
  session=null; dbReads=0;
  await redirected(()=>page(path)(props),`/login?callbackUrl=${encodeURIComponent('/'+path)}`);
  assert.equal(dbReads,0,'no DB reads before sign-in');
  session={user:{id:'customer',email:'customer@example.invalid'}};
  await redirected(()=>page(path)(props),'/');
  session={user:{id:'owner',email:'owner@example.invalid'}};
  assert.ok(await page(path)(props),path+' owner access');
}
session=null;
for(const path of ['video','video/studio']) await redirected(()=>page(path)(props),tagged('/animate'));
assert.equal(creditsTouched,0,'anonymous redirects never create credit records');
session={user:{id:'customer',email:'customer@example.invalid'}};
assert.ok(await page('video')(props));
const studio=await page('video/studio')(props);
assert.equal(studio.props.userId,'customer');
assert.equal(studio.props.creditBalance,137);
assert.equal(studio.props.subscriptionTier,'legacy');
assert.deepEqual(credit,{balance:137,subscriptionTier:'legacy'});
session=null;
for(const path of ['vater/courses','vater/courses/pilot','vater/courses/newdad']) assert.ok(await page(path)(props),'public waitlist '+path);
const directory=load('lib/directory.ts').buildDirectory();
for(const name of ['water','vater','advertising','video','scan','agents']) assert.ok(!directory.some(e=>e.name===name));
for(const name of ['agent','animate','moupins','junkinjays','shop','cleanouts']) assert.ok(directory.some(e=>e.name===name));
assert.match(directory.find(e=>e.name==='kerplunk').tagline,/yard game/);
const config=load('next.config.ts').default;
const redirects=await config.redirects();
assert.equal(redirects.find(r=>r.source==='/m/wd').destination,'/wd?utm_source=messenger&utm_medium=auto_reply');
for(const path of ['/gpu','/game','/video','/video/studio']) assert.ok(!redirects.some(r=>r.source===path),'no unconditional redirect '+path);
console.log('URL cleanup: route redirects, query preservation, empty/populated indexes, sitemap, owner gates, public waitlists, legacy credits and preserved public products passed.');

const { renderToStaticMarkup } = require('react-dom/server');
const tabs = load('components/shop/ShopTabs.tsx').default;
assert.doesNotMatch(renderToStaticMarkup(tabs({position:'top',counts:{videos:0}})), /href="\/shop\/videos"/);
assert.match(renderToStaticMarkup(tabs({position:'top',counts:{videos:1}})), /href="\/shop\/videos"/);
const start = await page('start')();
const nodes = [];
function collect(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(collect);
  nodes.push(node); collect(node.props?.children);
}
collect(start);
assert.ok(nodes.some(n=>n.props?.id==='route'),'Start keeps the migrated intake anchor');
assert.ok(nodes.some(n=>n.props?.source==='circle'),'Start preserves the existing subscriber source');
assert.ok(nodes.some(n=>Array.isArray(n.props?.groups) && n.props.groups.some(g=>g.entries.some(e=>e.name==='agent'))),'Start includes the service router');
console.log('Shop navigation and migrated Start intake checks passed.');
