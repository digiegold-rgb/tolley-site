import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { encode } from "next-auth/jwt";
import { chromium } from "playwright";
import { prisma } from "../lib/prisma";
import { enrollmentKey, MFA_COOKIE, signMfaProof } from "../lib/auth/mfa-proof";

const base="http://127.0.0.1:3029";
if(new URL(process.env.DATABASE_URL||"http://missing").port!=="55449")throw new Error("Browser validation requires the isolated test database");
async function main(){
  assert.equal(process.env.AUTH_SECRET,"shop-video-local-validation-only");
  const owner=await prisma.user.upsert({where:{email:"owner-shop-video@example.test"},create:{email:"owner-shop-video@example.test",name:"Shop Video Test Owner"},update:{}});
  const mfa=await prisma.userMfa.upsert({where:{userId:owner.id},create:{userId:owner.id,totpSecret:"isolated-fixture-no-real-secret",verified:true},update:{verified:true}});
  const sessionId=randomUUID();
  const token=await encode({secret:process.env.AUTH_SECRET,salt:"authjs.session-token",token:{sub:owner.id,email:owner.email,name:owner.name,authSessionId:sessionId,authAt:Math.floor(Date.now()/1000),sv:0,svAt:Math.floor(Date.now()/1000)}});
  const proof=signMfaProof(owner.id,sessionId,enrollmentKey(mfa));
  const ownerCookies=[{name:"authjs.session-token",value:token,url:base,httpOnly:true,sameSite:"Lax" as const},{name:MFA_COOKIE,value:proof,url:base,httpOnly:true,sameSite:"Lax" as const}];
  const anon=await fetch(base+"/api/hq/shop-videos");assert.equal(anon.status,401);
  const old=await fetch(base+"/api/hq/shop-videos",{headers:{cookie:"wd_admin=obsolete; shop_admin=obsolete","x-sync-secret":"test-sync-secret"}});assert.equal(old.status,401);
  const cookie=ownerCookies.map(c=>`${c.name}=${c.value}`).join("; ");
  assert.equal((await fetch(base+"/api/hq/shop-videos",{headers:{cookie:`authjs.session-token=${token}`}})).status,401,"owner must complete MFA");
  assert.equal((await fetch(base+"/api/hq/shop-videos",{method:"POST",headers:{cookie,origin:"https://untrusted.test","Content-Type":"application/json"},body:JSON.stringify({kind:"refresh"})})).status,403);
  assert.equal((await fetch(base+"/api/hq/shop-videos",{method:"POST",headers:{cookie,origin:base,"Content-Type":"application/json"},body:"invalid-json"})).status,400);
  const payload=await fetch(base+"/api/hq/shop-videos",{headers:{cookie}});assert.equal(payload.status,200);const dashboard=await payload.json();assert.equal(dashboard.worker.ready,true);assert.equal(dashboard.worker.fal,true);assert.ok(dashboard.connections.accounts.length>=3);
  const ready=dashboard.batches.flatMap((b:{jobs:{id:string;status:string}[]})=>b.jobs).find((j:{status:string})=>j.status==="ready");assert.ok(ready);
  assert.equal((await fetch(base+`/api/hq/shop-videos/media/${ready.id}`,{headers:{cookie,range:"bytes=99999999-"}})).status,416);
  assert.equal((await fetch(base+`/api/hq/shop-videos/media/${ready.id}`)).status,401);
  const artifact=dashboard.batches.flatMap((b:{jobs:{id:string;status:string;outputSha256:string}[]})=>b.jobs).find((j:{id:string})=>j.id.startsWith("acceptance-modal-"));
  if(artifact){
    const range=await fetch(base+`/api/hq/shop-videos/media/${artifact.id}`,{headers:{cookie,range:"bytes=0-31"}});assert.equal(range.status,206);const head=Buffer.from(await range.arrayBuffer());assert.equal(head.length,32);assert.equal(head.subarray(4,8).toString(),"ftyp");
    const download=await fetch(base+`/api/hq/shop-videos/media/${artifact.id}?download=1`,{headers:{cookie}});assert.equal(download.status,200);assert.match(download.headers.get("content-disposition")||"",/^attachment;/);assert.equal(createHash("sha256").update(Buffer.from(await download.arrayBuffer())).digest("hex"),artifact.outputSha256);
  }
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies(ownerCookies);
  const page=await context.newPage();const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto(base+"/hq/shop-videos",{waitUntil:"networkidle",timeout:120000});
  await page.getByRole("heading",{name:"Shop Video Batch",exact:true}).waitFor();
  await page.getByText("Cloud worker ready",{exact:true}).waitFor();
  assert.equal(await page.locator(".hq-admin").evaluate(el=>getComputedStyle(el).backgroundColor),"rgb(11, 18, 27)");
  assert.equal(await page.getByLabel("Generation provider").inputValue(),"fal");
  assert.equal(await page.getByLabel("Video format").inputValue(),"hybrid");
  await page.getByLabel("Video format").selectOption("boomerang");
  await page.getByText("Pure loops need a passed TikTok video pre-check",{exact:false}).waitFor();
  if(artifact){
    const video=page.locator(`video[src="/api/hq/shop-videos/media/${artifact.id}"]`);
    await video.evaluate(async(el:HTMLVideoElement)=>{el.muted=true;await el.play();});
    await page.waitForFunction((id)=>{const v=document.querySelector(`video[src="/api/hq/shop-videos/media/${id}"]`) as HTMLVideoElement;return v?.videoWidth===1080 && v.duration===8 && v.currentTime>0;},artifact.id,{timeout:60000});
    await video.evaluate((el:HTMLVideoElement)=>el.pause());
  }
  await mkdir("/tmp/tolley-shop-video-validation",{recursive:true});
  await page.screenshot({path:"/tmp/tolley-shop-video-validation/desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,"mobile layout must not overflow");
  await page.screenshot({path:"/tmp/tolley-shop-video-validation/mobile.png",fullPage:true});
  assert.deepEqual(errors,[]);
  if(artifact){
    const rejected=await fetch(base+"/api/hq/shop-videos",{method:"POST",headers:{cookie,origin:base,"Content-Type":"application/json"},body:JSON.stringify({kind:"job",id:artifact.id,data:{action:"reject",reason:"Visual review: generated text was absent from the source fixture"}})});assert.equal(rejected.status,200);assert.equal((await rejected.json()).result.status,"rejected");
  }
  await browser.close();console.log(JSON.stringify({ownerMfa:"passed",anonymousAndLegacyBypasses:"denied",foreignOrigin:"denied",malformedJson:400,range:416,liveConnections:dashboard.connections.accounts.length,desktopAndMobile:"passed",realCloudPlaybackAndDownload:artifact?"passed":"not seeded",browserErrors:0}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
