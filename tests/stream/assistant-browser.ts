import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import { prisma } from "../../lib/prisma";
import { enrollmentKey, signMfaProof } from "../../lib/auth/mfa-proof";
async function main() {
  assert.equal(process.env.DATABASE_URL, "postgresql://postgres@127.0.0.1:55438/tolley_live_growth_test");
  const base="http://127.0.0.1:3039",email="stream-handoff@tolley.invalid";
  const user=await prisma.user.upsert({where:{email},create:{email},update:{}});
  const mfa=await prisma.userMfa.upsert({where:{userId:user.id},create:{userId:user.id,verified:true,totpSecret:"test-only"},update:{verified:true}});
  const session="unified-assistant-test",now=Math.floor(Date.now()/1000);
  const jwt=await encode({secret:process.env.AUTH_SECRET!,salt:"authjs.session-token",token:{sub:user.id,email,authSessionId:session,authAt:now,sv:user.sessionVersion,svAt:now},maxAge:3600});
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();page.setDefaultTimeout(60000);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
    assert.equal((await context.request.get(base+"/api/stream/whatnot-bot/snapshot")).status(),401);
    await page.goto(base+"/stream/assistant",{waitUntil:"domcontentloaded",timeout:240000});assert.match(page.url(),/\/login/);
    await context.addCookies([{name:"authjs.session-token",value:jwt,domain:"127.0.0.1",path:"/"}]);
    await page.goto(base+"/stream/assistant",{waitUntil:"domcontentloaded",timeout:240000});assert.match(page.url(),/\/login|\/mfa/);
    await context.addCookies([{name:"tolley_mfa",value:signMfaProof(user.id,session,enrollmentKey(mfa)),domain:"127.0.0.1",path:"/"}]);
    const redirect=await context.request.get(base+"/stream/assistant",{maxRedirects:0});assert.equal(redirect.status(),307);assert.equal(redirect.headers().location,"/api/stream/whatnot-bot/admin");
    let mutations=0;
    const status={armed:false,privacy:false,obs:{connected:true,streaming:false,programReady:false},camera:{connected:false,kbps:0},cameras:[],destinations:{},events:[],limits:{},studio:{}};
    const snapshot={paused:true,phase:"disconnected",inventory:{ready:true,generatedAt:Date.now(),counts:{listed:54,draft:624,unavailable:1228},lineups:[]},settings:{repliesEnabled:true,dmEnabled:true,announcementsEnabled:true,announcements:[],faqs:[],testUsers:[],excludedUsers:[]},messages:[],decisions:[],csrf:"fixture"};
    await page.route("**/api/stream/**",async route=>{
      const url=new URL(route.request().url());if(route.request().method()!=="GET")mutations++;
      if(url.pathname.startsWith("/api/stream/whatnot-bot/")){
        const file=url.pathname.split("/").at(-1)!;
        if(file==="snapshot")return route.fulfill({json:snapshot});
        if(["admin","admin.js","admin.css"].includes(file))return route.fulfill({contentType:file==="admin"?"text/html":file.endsWith("js")?"text/javascript":"text/css",body:await readFile("ops/stream/assistant-v2/web/"+(file==="admin"?"admin.html":file),"utf8")});
      }
      await route.fulfill({json:url.pathname.endsWith("chat")?{items:[],last:0}:status});
    });
    await page.route("**/api/stream-lineup",route=>route.fulfill({json:{active:null}}));
    await page.goto(base+"/stream",{waitUntil:"domcontentloaded",timeout:240000});
    assert.equal(await page.getByRole("link",{name:"Show Assistant",exact:true}).count(),1);
    assert.equal(await page.getByRole("link",{name:/Classic|Inventory Assistant.*V2/}).count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.getByRole("link",{name:"Show Assistant",exact:true}).click();
    await page.getByRole("heading",{name:"Welcome viewers. Answer product questions.",exact:true}).waitFor();
    assert.match(page.url(),/\/api\/stream\/whatnot-bot\/admin$/);
    assert.equal(await page.getByRole("button",{name:"Start assistant",exact:true}).isDisabled(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:"/tmp/tolley-unified-assistant-mobile.png",fullPage:true});
    await page.setViewportSize({width:1440,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(mutations,0);assert.deepEqual(errors,[]);console.log("Owner/MFA gate, one entry button, canonical redirect, unified dashboard, mobile/desktop layout and zero sends: passed");
  }finally{await browser.close();await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
