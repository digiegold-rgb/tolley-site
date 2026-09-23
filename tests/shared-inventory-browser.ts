import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import { prisma } from "../lib/prisma";
import { signMfaProof, enrollmentKey } from "../lib/auth/mfa-proof";

if (!process.env.DATABASE_URL?.includes("127.0.0.1:55449/tolley_inventory_test")) throw new Error("Isolated test database required");
const base = "http://127.0.0.1:3027", secret = "inventory-test-secret-only";
process.env.AUTH_SECRET = secret;
async function main() {
  const user = await prisma.user.upsert({ where: { email: "inventory-test@example.test" }, update: {}, create: { email: "inventory-test@example.test" } });
  const mfa = await prisma.userMfa.upsert({ where: { userId: user.id }, update: { verified: true }, create: { userId: user.id, verified: true, totpSecret: "local-test-enrollment-only" } });
  const session = randomUUID(), now = Math.floor(Date.now()/1000);
  const jwt = await encode({ secret, salt: "authjs.session-token", token: { sub: user.id, email: user.email, authSessionId: session, authAt: now, sv: 0, svAt: now }, maxAge: 3600 });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    context.setDefaultTimeout(120000);
    const unauth = await context.request.get(`${base}/api/shop/inventory`, {timeout: 180000});
    assert.equal(unauth.status(),401);
    assert.equal((await context.request.post(`${base}/api/webhooks/shopify-inventory`,{data:{inventory_item_id:1,location_id:1}})).status(),401);
    await context.addCookies([
      { name: "authjs.session-token", value: jwt, url: base },
      { name: "tolley_mfa", value: signMfaProof(user.id,session,enrollmentKey(mfa)), url: base },
    ]);
    const p = await prisma.product.create({ data: { title: `Browser test kettle ${randomUUID()}`, status: "listed", imageUrls: [], targetPrice: 20, listings: { create: { platform: "shop", status: "active", price: 20 } } } });
    const page = await context.newPage();
    const errors:string[]=[]; page.on("pageerror",e=>errors.push(e.message));
    await page.goto(`${base}/stream/inventory`);
    await page.getByRole("heading",{name:"Inventory desk",exact:true}).waitFor();
    await page.getByLabel("Find a product").fill(p.title);
    await page.getByRole("button",{name:"Search",exact:true}).click();
    const card=page.locator(".inventory-product").filter({hasText:p.title});
    await card.waitFor();
    // A poll/refresh must not attach a newer revision to an older count draft.
    await card.getByText("Correct physical stock count",{exact:true}).click();
    await card.getByLabel("Reason").fill("Shelf count started before sale");
    const {runInventory:changeStock}=await import("../lib/shop/inventory");
    const intervening=await changeStock({productId:p.id,key:randomUUID(),action:"reserve",channel:"facebook",quantity:1});
    await page.getByLabel("Find a product").fill(p.title.slice(0,-1));
    await page.getByRole("button",{name:"Search",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".inventory-counts span b")[1]?.textContent==="1");
    await card.getByRole("button",{name:"Save count",exact:true}).click();
    await page.getByRole("alert").filter({hasText:"Stock changed"}).waitFor();
    assert.equal((await prisma.inventoryStock.findUniqueOrThrow({where:{productId:p.id}})).reserved,1);
    await changeStock({productId:p.id,key:randomUUID(),action:"release",channel:"facebook",reservationId:intervening.movement.reservationId!});
    await card.getByRole("button",{name:"Reset to latest count",exact:true}).click();
    // Changing search refreshes the product after the out-of-band release.
    await page.getByLabel("Find a product").fill(p.title);
    await page.getByRole("button",{name:"Search",exact:true}).click();
    await card.getByRole("button",{name:"Hold for buyer",exact:true}).click();
    await card.locator(".inventory-hold").waitFor();
    await card.getByRole("button",{name:"Complete sale",exact:true}).click();
    await page.waitForFunction(()=>document.querySelectorAll(".inventory-counts span b")[2]?.textContent==="0");
    const stock=await prisma.inventoryStock.findUniqueOrThrow({where:{productId:p.id}});
    assert.equal(stock.onHand,0);assert.equal(stock.reserved,0);
    const checkout=await context.request.post(`${base}/api/shop/checkout`,{data:{itemId:p.id}});
    assert.equal(checkout.status(),409);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
    await page.screenshot({path:"/tmp/tolley-inventory-mobile.png",fullPage:true});
    await page.setViewportSize({width:1440,height:1000});
    await page.screenshot({path:"/tmp/tolley-inventory-desktop.png",fullPage:true});

    // Signed Stripe completion replay through the real HTTP webhook.
    const paid=await prisma.product.create({data:{title:"Stripe paid inventory test",status:"listed",imageUrls:[],targetPrice:10}});
    const {runInventory}=await import("../lib/shop/inventory");
    const hold=await runInventory({productId:paid.id,key:randomUUID(),action:"reserve",channel:"shop",quantity:1,reference:"checkout:cs_inventory_paid"});
    const paidSession = `cs_inventory_paid_${randomUUID()}`;
    const event={id:`evt_${randomUUID()}`,object:"event",type:"checkout.session.completed",data:{object:{id:paidSession,object:"checkout.session",mode:"payment",payment_status:"paid",status:"complete",amount_total:1000,metadata:{productId:paid.id,shopItemId:paid.id,inventoryReservationId:hold.movement.reservationId}}}};
    const raw=JSON.stringify(event), t=Math.floor(Date.now()/1000),sig=createHmac("sha256","whsec_inventory").update(`${t}.${raw}`).digest("hex");
    for(let n=0;n<2;n++){
      const r=await context.request.post(`${base}/api/stripe/webhook`,{data:raw,headers:{"content-type":"application/json","stripe-signature":`t=${t},v1=${sig}`}});
      assert.equal(r.status(),200,await r.text());
    }
    assert.equal(await prisma.shopSale.count({where:{productId:paid.id,externalId:paidSession}}),1);
    assert.equal((await prisma.inventoryStock.findUniqueOrThrow({where:{productId:paid.id}})).onHand,0);

    const expired=await prisma.product.create({data:{title:"Expired checkout test",status:"listed",imageUrls:[]}});
    const expHold=await runInventory({productId:expired.id,key:randomUUID(),action:"reserve",channel:"shop",quantity:1,reference:"checkout:cs_inventory_expired"});
    const expiredSession = `cs_inventory_expired_${randomUUID()}`;
    const expiration={id:`evt_${randomUUID()}`,object:"event",type:"checkout.session.expired",data:{object:{id:expiredSession,status:"expired",payment_status:"unpaid",metadata:{inventoryReservationId:expHold.movement.reservationId}}}};
    const eraw=JSON.stringify(expiration),esig=createHmac("sha256","whsec_inventory").update(`${t}.${eraw}`).digest("hex");
    const er=await context.request.post(`${base}/api/stripe/webhook`,{data:eraw,headers:{"content-type":"application/json","stripe-signature":`t=${t},v1=${esig}`}});assert.equal(er.status(),200,await er.text());
    assert.equal((await prisma.inventoryStock.findUniqueOrThrow({where:{productId:expired.id}})).available,1);
    assert.deepEqual(errors,[]);
    console.log("PASS owner login + MFA, unauthorized access, mobile sale/hold flow, stale count protection, checkout refusal, signed paid replay, verified expiry, responsive layouts");
  } finally { await browser.close(); await prisma.$disconnect(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
