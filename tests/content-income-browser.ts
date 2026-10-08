import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { encode } from "next-auth/jwt";
import { chromium } from "playwright";
import { prisma } from "../lib/prisma";
import { enrollmentKey, MFA_COOKIE, signMfaProof } from "../lib/auth/mfa-proof";
const base="http://127.0.0.1:3040";
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
if(new URL(process.env.DATABASE_URL||"http://missing").port!=="55458")throw new Error("Use the isolated test database");
async function main(){
  assert.equal(process.env.AUTH_SECRET,"content-income-local-validation-only");
  const owner=await prisma.user.upsert({where:{email:"owner-content-income@example.test"},create:{email:"owner-content-income@example.test",name:"Income Test Owner"},update:{}});
  const mfa=await prisma.userMfa.upsert({where:{userId:owner.id},create:{userId:owner.id,totpSecret:"isolated-fixture-no-real-secret",verified:true},update:{verified:true}});
  const sessionId=randomUUID();
  const token=await encode({secret:process.env.AUTH_SECRET,salt:"authjs.session-token",token:{sub:owner.id,email:owner.email,name:owner.name,authSessionId:sessionId,authAt:Math.floor(Date.now()/1000),sv:0,svAt:Math.floor(Date.now()/1000)}});
  const proof=signMfaProof(owner.id,sessionId,enrollmentKey(mfa));
  const cookies=[{name:"authjs.session-token",value:token,url:base,httpOnly:true,sameSite:"Lax" as const},{name:MFA_COOKIE,value:proof,url:base,httpOnly:true,sameSite:"Lax" as const}];
  const cookie=cookies.map(c=>`${c.name}=${c.value}`).join("; ");
  assert.equal((await fetch(base+"/api/hq/content-income")).status,401);
  assert.equal((await fetch(base+"/api/hq/content-income",{headers:{cookie:`authjs.session-token=${token}`}})).status,401);
  assert.equal((await fetch(base+"/api/hq/content-income",{headers:{cookie:"wd_admin=obsolete","x-sync-secret":"invalid"}})).status,401);
  assert.equal((await fetch(base+"/api/cron/content-income")).status,401);
  for(const origin of [undefined,"https://foreign.test"]){
    assert.equal((await fetch(base+"/api/hq/content-income",{method:"POST",headers:{cookie,"Content-Type":"application/json",...(origin?{origin}:{})},body:JSON.stringify({action:"pause",paused:true})})).status,403);
  }
  assert.equal((await fetch(base+"/api/hq/content-income",{method:"POST",headers:{cookie,origin:base,"Content-Type":"application/json"},body:"invalid-json"})).status,400);
  const r=await fetch(base+"/api/hq/content-income",{headers:{cookie}});assert.equal(r.status,200);assert.equal((await r.json()).estimatedCents,0);
  const p=await prisma.contentIncomePost.findFirstOrThrow({where:{format:"image"}});
  const art=await fetch(base+`/api/content-income/art/${p.id}`);assert.equal(art.status,200);assert.equal(art.headers.get("content-type"),"image/jpeg");
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies(cookies);
  const page=await context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/hq/content-income",{waitUntil:"networkidle",timeout:120000});
  await page.getByRole("heading",{name:"Make the posts count."}).waitFor();
  await page.getByLabel("Filter experiments").selectOption("queued");
  assert.equal(await page.locator(".income-post").count(),30);
  await page.screenshot({path:"/tmp/tolley-content-income-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  await page.screenshot({path:"/tmp/tolley-content-income-mobile.png",fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ownerMfa:"passed",unauthorized:"denied",cronUnauthorized:"denied",foreignAndAbsentOrigins:"denied",publicArtwork:"passed",desktopAndMobile:"passed",browserErrors:0}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();await prisma.$disconnect();});
