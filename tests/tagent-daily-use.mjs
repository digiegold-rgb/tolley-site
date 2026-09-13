// Isolated route/service tests. In-memory transactions do not substitute for the
// required PostgreSQL and browser release checks; no real contacts are written.
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import ts from 'typescript';
const require=createRequire(import.meta.url), root=resolve(import.meta.dirname,'..');
const {Prisma}=require('@prisma/client');
const {NextRequest,NextResponse}=require('next/server');
let db={crmTask:[],crmActivity:[],client:[],leadAction:[],lead:[],deal:[],leadSubscriber:[]};
let session=null, failActivity=false, inquiryReads=0, sequence=0, tail=Promise.resolve();
const match=(row,where={})=>Object.entries(where).every(([k,v])=>{
  if(k==='OR') return v.some(w=>match(row,w));
  if(k==='AND') return v.every(w=>match(row,w));
  if(k==='CrmTask') return !db.crmTask.some(t=>t.clientId===row.id&&match(t,v.none));
  if(k==='CrmActivity') return !db.crmActivity.some(t=>t.clientId===row.id&&match(t,v.none));
  if(v instanceof Date) return +row[k]===+v;
  if(v&&typeof v==='object') return Object.entries(v).every(([op,value])=>op==='not'?row[k]!==value:op==='in'?value.includes(row[k]):op==='notIn'?!value.includes(row[k]):op==='gte'?row[k]>=value:op==='lt'?row[k]<value:op==='startsWith'?row[k]?.startsWith(value):false);
  return row[k]===v;
});
const unique=()=>new Prisma.PrismaClientKnownRequestError('duplicate',{code:'P2002',clientVersion:Prisma.prismaVersion.client});
const prisma={};
for(const name of Object.keys(db)) {
  prisma[name]={
    async findMany({where={},take,orderBy}={}) {
      if(name==='leadAction') inquiryReads++;
      let rows=db[name].filter(r=>match(r,where));
      if(orderBy) for(const order of [...(Array.isArray(orderBy)?orderBy:[orderBy])].reverse()) {const [key,direction]=Object.entries(order)[0]; rows.sort((a,b)=>((a[key]??Infinity)>(b[key]??Infinity)?1:(a[key]??Infinity)<(b[key]??Infinity)?-1:0)*(direction==='desc'?-1:1));}
      return structuredClone(take?rows.slice(0,take):rows);
    },
    async findFirst(args){return (await this.findMany(args))[0]??null;},
    async findUnique(args){return this.findFirst(args);},
    async count(args){return (await this.findMany(args)).length;},
    async create({data}) {
      if(name==='crmActivity'&&failActivity) throw new Error('simulated storage failure');
      const now=new Date();const row={id:`fixture-${++sequence}`,status:name==='client'?'active':'pending',createdAt:now,updatedAt:now,dueDate:null,leadId:null,clientId:null,dealId:null,description:null,...data};
      if(db[name].some(r=>r.id===row.id)) throw unique();
      db[name].push(row); return structuredClone(row);
    },
    async updateMany({where,data}) {let count=0;for(const r of db[name]) if(match(r,where)){Object.assign(r,data,{updatedAt:new Date()});count++;}return{count};},
    async upsert({where,create,update}){const existing=db[name].find(r=>match(r,where));if(existing){Object.assign(existing,update);return structuredClone(existing);}return this.create({data:create});},
  };
}
prisma.$transaction=async fn=>{const prior=tail;let release;tail=new Promise(r=>release=r);await prior;const before=structuredClone(db);try{return await fn(prisma);}catch(e){db=before;throw e;}finally{release();}};
const cache=new Map();
const stubs={
  '@/auth':{auth:async()=>session},
  '@/lib/prisma':{prisma},
  '@/lib/customer-crm-references':{customerCrmReferences:async(sub,refs)=>Object.entries(refs).every(([key,id])=>!id||(key==='leadId'?db.lead.some(x=>x.id===id&&(!x.ownerSubscriberId||x.ownerSubscriberId===sub)):db[key==='clientId'?'client':'deal'].some(x=>x.id===id&&x.subscriberId===sub)))},
  '@/lib/customer-leads':{customerLeads:sub=>({findMany:async({where})=>db.lead.filter(x=>(!x.ownerSubscriberId||x.ownerSubscriberId===sub)&&match(x,where))})},
  '@/lib/admin-auth':{isAdminEmail:email=>email==='owner@example.invalid',requireAdminApiSession:async()=>session?.user?.email==='owner@example.invalid'&&!session.mfaRequired?{ok:true,session:{userId:session.user.id}}:{ok:false,response:NextResponse.json({error:'Forbidden'},{status:403})}},
};
function load(path){path=resolve(root,path);if(cache.has(path))return cache.get(path).exports;const mod={exports:{}};cache.set(path,mod);const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',source)(name=>{if(name in stubs)return stubs[name];if(name.startsWith('@/')||name.startsWith('.')){const base=name.startsWith('@/')?resolve(root,name.slice(2)):resolve(dirname(path),name);for(const ext of ['', '.ts','.tsx'])if(existsSync(base+ext)&&statSync(base+ext).isFile())return load(base+ext);}return require(name);},mod,mod.exports);return mod.exports;}
const {dailyBounds,orderDailyTasks,phoneHref}=load('lib/leads/daily-plan.ts');
for(const [date,hours] of [['2026-03-08T18:00:00Z',23],['2026-11-01T18:00:00Z',25],['2026-09-09T18:00:00Z',24]]){const{start,end}=dailyBounds(new Date(date));assert.equal((end-start)/3600000,hours);}
assert.equal(dailyBounds(new Date('2026-09-10T03:00:00Z')).start.toISOString(),'2026-09-09T05:00:00.000Z');
assert.equal(phoneHref('javascript:alert(1)'),null);assert.equal(phoneHref('(816) 555-1234'),'tel:8165551234');
const now=new Date(), future=new Date(now.getTime()+2*86400000).toISOString();
const {applyDailyAction,dailyActionSchema}=load('lib/leads/daily-actions.ts');
const capture={action:'capture',requestId:randomUUID(),name:'Test Person',phone:'8165551234',email:'',title:'Confirm the walkthrough'};
await Promise.all([applyDailyAction('a',false,capture),applyDailyAction('a',false,capture)]);
assert.equal(db.client.length,1,'capture retries do not duplicate contacts');assert.equal(db.crmTask.length,1);
const task=db.crmTask[0];
const outcome={action:'outcome',requestId:randomUUID(),taskId:task.id,outcome:'conversation',note:'Wednesday works',nextAt:future,nextTitle:'Confirm Wednesday'};
assert.equal(dailyActionSchema.safeParse({...outcome,nextAt:undefined}).success,false,'conversation requires a next step');
assert.equal(dailyActionSchema.safeParse({...outcome,nextAt:'bad'}).success,false);
await assert.rejects(()=>applyDailyAction('b',false,outcome),e=>e.status===404);
failActivity=true;
await assert.rejects(()=>applyDailyAction('a',false,outcome),/simulated/);
assert.equal(db.crmTask[0].status,'pending','transaction rolls back completion if activity fails');assert.equal(db.crmTask.length,1);
failActivity=false;
await Promise.all([applyDailyAction('a',false,outcome),applyDailyAction('a',false,outcome)]);
assert.equal(db.crmActivity.filter(a=>a.type==='daily_conversation').length,1);
assert.equal(db.crmTask.filter(t=>t.status==='pending').length,1,'one next follow-up');
const next=db.crmTask.find(t=>t.status==='pending');
const snooze={...outcome,requestId:randomUUID(),taskId:next.id,outcome:'snooze',nextAt:new Date(now.getTime()+3*86400000).toISOString()};
await applyDailyAction('a',false,snooze);await applyDailyAction('a',false,snooze);
assert.equal(db.crmActivity.filter(a=>a.type==='daily_snooze').length,1,'snooze retries are idempotent');
assert.equal(db.crmTask.find(t=>t.id===next.id).status,'pending');
assert.equal(db.crmTask.find(t=>t.id===next.id).description,'Wednesday works','snoozed follow-ups retain the updated note');
db.leadAction.push({id:'inquiry-1',status:'new',name:'Asked for help',subsite:'estate',action:'quote',phone:'8165554321',createdAt:now});
await assert.rejects(()=>applyDailyAction('a',false,{action:'adopt-inquiry',inquiryId:'inquiry-1'}),e=>e.status===403);
await Promise.all([applyDailyAction('a',true,{action:'adopt-inquiry',inquiryId:'inquiry-1'}),applyDailyAction('a',true,{action:'adopt-inquiry',inquiryId:'inquiry-1'})]);
assert.equal(db.crmTask.filter(t=>t.id==='inquiry:a:inquiry-1').length,1);
assert.equal(db.leadAction[0].status,'new','HQ source request stays intact');
const foreign=await prisma.client.create({data:{subscriberId:'b',firstName:'Private',lastName:'Customer',phone:'private'}});
await assert.rejects(()=>applyDailyAction('a',false,{action:'add-client',clientId:foreign.id}),e=>e.status===404);
const {loadDailyDesk}=load('lib/leads/daily-desk.ts');
inquiryReads=0;
let desk=await loadDailyDesk('a',false,now);
assert.equal(inquiryReads,0,'non-owner never queries HQ inquiries');assert.equal(desk.inquiries.length,0);
assert.ok(desk.tasks.every(t=>t.phone!=='private'));
assert.ok(!desk.tasks.some(t=>t.id===next.id),'future promise stays out of today');
assert.ok(desk.upcoming.some(t=>t.id===next.id));
assert.equal(desk.progress.conversations,1,'attempts/completions do not masquerade as conversations');
assert.ok(desk.suggestions.every(c=>c.id!==foreign.id));
desk=await loadDailyDesk('a',true,now);assert.equal(desk.inquiries.length,0,'adopted requests do not reappear');
const ordered=orderDailyTasks([{id:'future',dueDate:future,priority:'high'},{id:'undated',dueDate:null,priority:'high'},{id:'due',dueDate:new Date(now-86400000).toISOString(),priority:'low'}],now);
assert.deepEqual(ordered.map(t=>t.id),['due','undated']);
// Real route dispatch validates authorization, inputs and origins before service writes.
const api=load('app/api/leads/daily/route.ts');
const request=(body,origin='https://test.invalid')=>new NextRequest('https://test.invalid/api/leads/daily',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
assert.equal((await api.POST(request(capture))).status,401);
session={user:{id:'user-a',email:'customer@example.invalid'}};
assert.equal((await api.POST(request(capture))).status,403,'inactive workspace denied');
db.leadSubscriber.push({id:'a',userId:'user-a',status:'active'});
assert.equal((await api.POST(request(capture,'https://attacker.invalid'))).status,403);
assert.equal((await api.POST(request({action:'capture',name:''}))).status,400);
assert.equal((await api.POST(request({action:'adopt-inquiry',inquiryId:'inquiry-1'}))).status,403);
assert.equal((await api.POST(request(capture))).status,200);
session.mfaRequired=true;assert.equal((await api.POST(request(capture))).status,403);delete session.mfaRequired;
const setup=load('app/api/leads/daily/setup/route.ts');
assert.equal((await setup.POST(request({}))).status,403,'customer cannot activate owner entitlement');
session={user:{id:'owner',email:'owner@example.invalid'}};
assert.equal((await setup.POST(request({}))).status,200);assert.equal((await setup.POST(request({}))).status,200);
const ownerSub=db.leadSubscriber.filter(s=>s.userId==='owner');assert.equal(ownerSub.length,1);assert.equal(ownerSub[0].smsLimit,0);
assert.equal(ownerSub[0].stripeSubscriptionId,undefined,'owner setup does not purchase a subscription');
console.log('T-Agent daily use: calendar/DST, prioritization, private contacts, atomic outcomes, duplicate retries, future follow-ups, owner-only inquiries/setup, activity counts, input validation and origin checks passed.');

// Render the real client component with the navigation hook isolated.
stubs['next/navigation']={useRouter:()=>({refresh(){}})};
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const DailyDesk=load('components/leads/daily/DailyDesk.tsx').default;
const html=renderToStaticMarkup(React.createElement(DailyDesk,{data:await loadDailyDesk('a',false,now),owner:false}));
assert.match(html,/Three follow-ups/);assert.match(html,/Save person &amp; follow-up/);
assert.doesNotMatch(html,/Requests from your sites/);
assert.match(html,/Record what happened/);
assert.match(html,/href="tel:8165554321"/);
console.log('Daily screen renders real follow-ups and contact actions without exposing owner-only intake.');

const draft = {version:1,score:90,dossierId:'dossier-fixture',researchedAt:now.toISOString(),address:'Test property',reasons:['Review timing'],body:'A personal draft.'};
const ownerData = {...await loadDailyDesk('a',true,now),weekdayDrop:{day:'2026-09-14',count:5,shortfall:0},sellerDrafts:Array.from({length:5},(_,i)=>({id:`draft-${i}`,title:`Target ${i}`,draft,description:null,dueDate:now.toISOString(),priority:'high',person:null,phone:null,email:null,href:null}))};
const ownerHtml=renderToStaticMarkup(React.createElement(DailyDesk,{data:ownerData,owner:true}));
assert.equal((ownerHtml.match(/Personal outreach draft/g)||[]).length,5,'all five drafts appear independently of three-follow-up limit');
assert.match(ownerHtml,/Review dossier &amp; sources/);assert.match(ownerHtml,/Copy draft/);
assert.doesNotMatch(html,/Five scored targets/,'customer UI does not show owner drafts');
stubs['@/lib/leads/weekday-drop']={createWeekdayDrop:async()=>({report:{count:5}})};
const cron=load('app/api/cron/leads-weekday-drop/route.ts');
const cronRequest=token=>new NextRequest('https://test.invalid/api/cron/leads-weekday-drop',{headers:{authorization:`Bearer ${token}`}});
delete process.env.CRON_SECRET;
assert.equal((await cron.GET(cronRequest('undefined'))).status,401,'missing secret fails closed');
process.env.CRON_SECRET='weekday-test-only';delete process.env.LEADS_DESK_SUBSCRIBER_ID;
assert.equal((await cron.GET(cronRequest('wrong'))).status,401);
assert.equal((await cron.GET(cronRequest(process.env.CRON_SECRET))).status,503,'unconfigured owner is visible as failure');
process.env.LEADS_DESK_SUBSCRIBER_ID='a';db.leadSubscriber.find(s=>s.id==='a').user={email:'customer@example.invalid'};
assert.equal((await cron.GET(cronRequest(process.env.CRON_SECRET))).status,403,'cron cannot target a customer workspace');
db.leadSubscriber.find(s=>s.id==='a').user.email='owner@example.invalid';
assert.equal((await cron.GET(cronRequest(process.env.CRON_SECRET))).status,200);
console.log('Weekday draft rendering and cron authentication/configuration/owner gates passed.');

let ingested = null;
stubs['@/lib/leads/mls-ingest']={ingestMlsSweep:async(sub,input)=>{ingested={sub,input};return {saved:0};}};
const mlsApi=load('app/api/leads/mls-ingest/route.ts');
const mlsRequest=(secret,body)=>new NextRequest('https://test.invalid/api/leads/mls-ingest',{method:'POST',headers:{'content-type':'application/json','x-sync-secret':secret},body:JSON.stringify(body)});
const emptySweep={runId:randomUUID(),observedAt:now.toISOString(),status:'empty',message:'No matches',captures:[]};
delete process.env.SYNC_SECRET;
assert.equal((await mlsApi.POST(mlsRequest('undefined',emptySweep))).status,401);
process.env.SYNC_SECRET='mls-test-only';
assert.equal((await mlsApi.POST(mlsRequest('wrong',emptySweep))).status,401);
delete process.env.LEADS_DESK_SUBSCRIBER_ID;
assert.equal((await mlsApi.POST(mlsRequest(process.env.SYNC_SECRET,emptySweep))).status,503);
process.env.LEADS_DESK_SUBSCRIBER_ID='a';
const mlsSub=db.leadSubscriber.find(s=>s.id==='a');
mlsSub.user.email='customer@example.invalid';
assert.equal((await mlsApi.POST(mlsRequest(process.env.SYNC_SECRET,emptySweep))).status,403);
mlsSub.user.email='owner@example.invalid';mlsSub.status='inactive';
assert.equal((await mlsApi.POST(mlsRequest(process.env.SYNC_SECRET,emptySweep))).status,403);
mlsSub.status='active';
assert.equal((await mlsApi.POST(mlsRequest(process.env.SYNC_SECRET,{...emptySweep,status:'ready'}))).status,400);
assert.equal((await mlsApi.POST(mlsRequest(process.env.SYNC_SECRET,{...emptySweep,subscriberId:'foreign'}))).status,200);
assert.equal(ingested.sub,'a');assert.equal(ingested.input.subscriberId,undefined);
const mlsHtml=renderToStaticMarkup(React.createElement(DailyDesk,{data:{...ownerData,mlsHealth:{status:'reauth_required',message:'Sign in on Spark',observedAt:now.toISOString()},sellerDrafts:[{...ownerData.sellerDrafts[0],draft:{...draft,researchKind:'mls',dossierId:'mls-capture:test'}}]},owner:true}));
assert.match(mlsHtml,/\/leads\/mls\/mls-capture/);assert.match(mlsHtml,/Sign in on Spark/);
console.log('Private MLS ingest secret/configuration/owner/schema gates and research rendering passed.');
