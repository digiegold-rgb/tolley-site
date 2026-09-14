import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
import {NextRequest} from 'next/server.js';
const root=resolve(import.meta.dirname,'..'), require=createRequire(import.meta.url);
let session=null, pathname='/leads', requirement=null, target=null, options;
let reads=0, stripeCalls=0, customerCalls=0, tabReads=0;
const stubs={
  'server-only':{},
  '@/auth':{auth:async()=>session},
  'next-auth': config=>{options=config;return {};},
  'next-auth/providers/email': config=>config,
  'next-auth/providers/credentials': config=>config,
  '@auth/prisma-adapter':{PrismaAdapter:()=>({})},
  'next/headers':{headers:async()=>new Headers({'x-tolley-pathname':pathname})},
  'next/navigation':{redirect:path=>{throw new Error('REDIRECT:'+path);}},
  'next-auth/jwt':{getToken:async()=>null},
  '@/lib/agent-detection':{isAgentRequest:()=>({isAgent:false})},
  '@/lib/admin-auth':{isAdminEmail:email=>email==='owner@example.invalid'},
  '@/lib/rate-limit':{consumeRateLimit:async()=>({allowed:true})},
  '@/lib/password':{verifyPassword:async()=>true},
  '@/lib/auth/session-version':{readSessionVersion:async()=>0},
  '@/lib/auth/mfa-session':{mfaRequirement:async()=>requirement},
  '@/lib/vater/acting-as':{readViewAsUserId:async()=>target},
  '@/lib/vater/workspaces':{readWsUserId:async()=>{tabReads++;return 'studio-tab';},isLiveWorkspace:async()=>true},
  '@/lib/prisma':{prisma:{leadSubscriber:{findUnique:async()=>{reads++;return {tier:'team',status:'active'};}},user:{findUnique:async()=>({id:'customer',email:'customer@example.invalid'})}}},
  '@/lib/billing':{ensureStripeCustomer:async()=>{customerCalls++;return 'cus_test';},getAppUrl:()=> 'https://example.invalid'},
  '@/lib/stripe':{getStripeClient:()=>({checkout:{sessions:{create:async()=>{stripeCalls++;return {id:'checkout',url:'https://checkout.stripe.com/test'};}}}})},
  '@/lib/leads-pricing-server':{getAnnualLeadsPrices:async()=>({})},
  '@/components/leads/LeadsPricingClient':()=>null,
  '@/components/seo/structured-data':{StructuredData:()=>null,tAgentSoftwareSchema:{}},
};
const modules=new Map();
function load(relative){
 const file=resolve(root,relative);if(modules.has(file))return modules.get(file).exports;
 const mod={exports:{}};modules.set(file,mod);
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',code)(name=>{
  if(name in stubs)return stubs[name];
  if(name.startsWith('@/'))for(const ext of ['.ts','.tsx'])if(existsSync(resolve(root,name.slice(2)+ext)))return load(name.slice(2)+ext);
  return require(name);
 },mod,mod.exports);return mod.exports;
}
load('auth.ts');
const token={sub:'owner',email:'owner@example.invalid',authSessionId:'sid'};
const makeSession=()=>({user:{id:'owner',email:token.email},expires:'2099-01-01'});
for(const route of ['/leads','/leads/pricing','/leads/dashboard','/api/leads','/api/leads/daily/setup']){
 pathname=route;const s=await options.callbacks.session({session:makeSession(),token});
 assert.equal(s.user.id,'owner',route);assert.equal(s.workspace,undefined,route);
}
assert.equal(tabReads,0,'T-Agent does not read Studio workspace cookies');
for(const route of ['/animate','/api/vater/projects','/leads-other']){
 pathname=route;const s=await options.callbacks.session({session:makeSession(),token});
 assert.equal(s.user.id,'studio-tab',route);assert.equal(s.workspace.rootUserId,'owner');
}
pathname='/leads';target='customer';
let result=await options.callbacks.session({session:makeSession(),token});
assert.equal(result.user.id,'customer');assert.equal(result.impersonatedBy,token.email);assert.equal(result.workspace,undefined);
target=null;requirement='verify';
result=await options.callbacks.session({session:makeSession(),token});
assert.equal(result.user,undefined);assert.equal(result.mfaRequired,'verify');requirement=null;
const {proxy}=load('proxy.ts');
for(const [route,spoof] of [['/leads/pricing','/animate'],['/api/vater/projects','/leads']]){
 const response=await proxy(new NextRequest('https://example.invalid'+route,{headers:{'x-tolley-pathname':spoof}}));
 assert.equal(response.headers.get('x-middleware-request-x-tolley-pathname'),route,'Proxy overwrites caller scope');
}
const Pricing=load('app/leads/pricing/page.tsx').default;
const Layout=load('app/leads/pricing/layout.tsx').default;
const {POST}=load('app/api/leads/subscribe/route.ts');
const request=()=>new Request('https://example.invalid/api/leads/subscribe',{method:'POST',body:JSON.stringify({tier:'starter'})});
let html=renderToStaticMarkup(await Layout({children:null}));
assert.match(html,/href="\/login\?callbackUrl=%2Fleads"/);await Pricing();
assert.equal((await POST(request())).status,401);
session=makeSession();await assert.rejects(Pricing,/REDIRECT:\/leads$/);
assert.equal(reads,0,'Owner never queries plans to enter their workspace');
assert.deepEqual(await (await POST(request())).json(),{url:'/leads'});
assert.equal(stripeCalls,0);assert.equal(customerCalls,0);
html=renderToStaticMarkup(await Layout({children:null}));assert.match(html,/Open T-Agent/);assert.doesNotMatch(html,/>Sign in</);
session={mfaRequired:'verify'};await assert.rejects(Pricing,/REDIRECT:\/login\/mfa-challenge\?callbackUrl=%2Fleads$/);
assert.equal((await POST(request())).status,401);
html=renderToStaticMarkup(await Layout({children:null}));assert.match(html,/Complete sign in/);
session={...makeSession(),impersonatedBy:'support@example.invalid'};
await Pricing();assert.equal((await POST(request())).status,403);
session={user:{id:'customer',email:'customer@example.invalid'}};
await Pricing();assert.ok(reads>0);
process.env.STRIPE_PRICE_STARTER='price_starter';process.env.STRIPE_PRICE_PRO_LEADS='price_pro';process.env.STRIPE_PRICE_TEAM='price_team';
assert.equal((await POST(request())).status,200);assert.equal(stripeCalls,1);assert.equal(customerCalls,1);
console.log('PASS: owner/pricing/MFA routing, checkout protection, customer checkout, Studio isolation, support view-as, and forged route-header rejection');
