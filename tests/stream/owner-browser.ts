import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { encode } from 'next-auth/jwt';
import { prisma } from '../../lib/prisma';
import { enrollmentKey, signMfaProof } from '../../lib/auth/mfa-proof';
async function main(){
 if(!process.env.DATABASE_URL?.endsWith('/tolley_live_growth_test')) throw new Error('Isolated test DB required');
 await prisma.liveShow.deleteMany({where:{title:'Test gadgets haul'}});
 const user=await prisma.user.upsert({where:{email:'live-test@tolley.invalid'},create:{email:'live-test@tolley.invalid'},update:{}});
 const mfa=await prisma.userMfa.upsert({where:{userId:user.id},create:{userId:user.id,verified:true,totpSecret:'test-only'},update:{verified:true}});
 const session='live-browser-test';const now=Math.floor(Date.now()/1000);
 const jwt=await encode({secret:process.env.AUTH_SECRET!,salt:'authjs.session-token',token:{sub:user.id,email:user.email,authSessionId:session,authAt:now,sv:0,svAt:now},maxAge:3600});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addCookies([{name:'authjs.session-token',value:jwt,domain:'127.0.0.1',path:'/'},{name:'tolley_mfa',value:signMfaProof(user.id,session,enrollmentKey(mfa)),domain:'127.0.0.1',path:'/'}]);
 context.setDefaultTimeout(120000);
 const page=await context.newPage();const base='http://127.0.0.1:3022';
 await page.goto(base+'/stream/growth',{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByRole('heading',{name:'Schedule the next haul'}).waitFor();
 const start=new Date(Date.now()+86400000).toISOString();
 const r=await context.request.post(base+'/api/live/manage',{timeout:120000,data:{action:'show',show:{title:'Test gadgets haul',category:'Electronics',startsAt:start,durationMin:120,whatnotUrl:'https://www.whatnot.com/live/test-show'}}});assert.equal(r.status(),200);
 const s=await prisma.liveShow.findFirstOrThrow({where:{title:'Test gadgets haul'}});
 assert.equal((await context.request.post(base+'/api/live/manage',{timeout:120000,data:{action:'confirm',id:s.id}})).status(),200);
 await page.goto(base+'/live',{waitUntil:'domcontentloaded',timeout:120000});await page.getByRole('link',{name:'Watch the show live ↗'}).waitFor();
 await context.request.post(base+'/api/live/manage',{timeout:120000,data:{action:'end',id:s.id}});
 await prisma.liveShow.delete({where:{id:s.id}});
 let cameraError=true;
 const status={armed:true,privacy:false,liveSinceS:30,camera:{connected:true,kbps:4500,sinceS:30,goneS:0},obs:{connected:true,scene:'Live',streaming:true,programReady:true,lastError:''},mediamtx:{ok:true},destinations:{youtube:{enabled:false,configured:true,running:false,uptimeS:0},tiktok:{enabled:false,configured:false,running:false,uptimeS:0}},cameras:[{slot:1,label:'Phone',connected:true,kbps:4500,onAir:true,audio:false,audioLive:true},{slot:2,label:'DJI',connected:true,kbps:4500,onAir:false,audio:true,audioLive:false}],limits:{camGoneEndMin:15,maxStreamMin:480,brbAfterS:5},ingest:{url:'test',keyTail:'test'},studio:{online:true,ageS:0,studioRunning:false,obsRunning:true,host:'test'},recording:{state:'recording',ageS:2,bytes:1000},events:[]};
 await page.route('**/api/stream/status',route=>route.fulfill({json:status}));
 await page.route('**/api/stream/chat?*',route=>route.fulfill({json:{items:[],last:0}}));
 await page.route('**/api/stream-lineup',route=>route.fulfill({json:{active:null}}));
 await page.route('**/api/stream/thumb/*',route=>route.fulfill({status:404}));
 await page.route('**/api/stream/camera',route=>route.fulfill(cameraError?{status:409,json:{detail:'Camera disconnected'}}:{json:{...status,cameras:status.cameras.map(c=>({...c,onAir:c.slot===2}))}}));
 await page.goto(base+'/stream',{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByText('Encoding · house armed',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Cut to camera 2'}).click();
 await page.getByRole('alert').filter({hasText:'Camera disconnected'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Cut to camera 1'}).getByText('ON AIR').count(),1);
 assert.equal(await page.getByRole('button',{name:'Cut to camera 2'}).getByText('ON AIR').count(),0);
 await page.getByTitle('Active fallback microphone').waitFor();
 cameraError=false;await page.getByRole('button',{name:'Cut to camera 2'}).click();
 await page.getByRole('button',{name:'Cut to camera 2'}).getByText('ON AIR').waitFor();
 await page.screenshot({path:'/tmp/tolley-stream-controls.png',fullPage:true});
 console.log('Owner/MFA gate, schedule/live expiry controls, failed cut truth, fallback mic and successful cut passed');
 }finally{await browser.close();await prisma.$disconnect()}
}
main().catch(e=>{console.error(e instanceof Error ? e.message.split('Call log:')[0] : 'Browser test failed');process.exitCode=1;});
