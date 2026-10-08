import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "../lib/prisma";
import { ACCOUNT_ID, TREASURE_PAGE, actionSchema, allowedFeedSlots, receiptTotals, performanceScore, morningFormat } from "../lib/content-income/core";
import { ensureAccount, seedQueue, drainQueue, reservePost, act, report } from "../lib/content-income/store";
import { MetaRejected } from "../lib/content-income/meta";
import { renderTip } from "../lib/content-income/art";
import { TOPICS, topicCopy } from "../lib/content-income/catalog";
import { centralInstant, centralDate } from "../lib/live/campaign";
import { reserveCampaign } from "../lib/live/campaign-publish";

if (new URL(process.env.DATABASE_URL || "http://missing").port !== "55458") throw new Error("Requires isolated Content Income test database");
async function reset() {
  await prisma.liveCampaignPost.deleteMany({where:{accountId:TREASURE_PAGE}});
  await prisma.postLogEntry.deleteMany({ where: { job: "content-income" } });
  await prisma.contentIncomePost.deleteMany(); await prisma.contentIncomeReceipt.deleteMany(); await prisma.contentIncomeEarningDay.deleteMany(); await prisma.contentIncomeAccount.deleteMany();
  await ensureAccount();
  await prisma.contentIncomeAccount.update({where:{id:ACCOUNT_ID},data:{paused:false,startedAt:new Date("2026-10-08T12:00:00Z")}});
}
async function main() {
  assert.equal(allowedFeedSlots({used:1,reservedPreview:true,hasUncertain:false}),0);
  assert.equal(morningFormat(0),"image");assert.equal(morningFormat(1),"text");assert.equal(morningFormat(30),"text");
  assert.equal(allowedFeedSlots({used:0,reservedPreview:false,hasUncertain:true}),0);
  assert.deepEqual(receiptTotals([{amountCents:100,status:"paid"},{amountCents:200,status:"pending"},{amountCents:300,status:"reversed"}]),{paidCents:100,pendingCents:200,reversedCents:300});
  assert.equal(performanceScore({views:null,shares:10,follows:0,comments:0}),null);
  assert.equal(actionSchema.safeParse({action:"receipt",externalId:"payout",amountCents:1.5,status:"paid",period:"2026-10",evidence:"receipt"}).success,false);
  const now = centralInstant("2026-10-08","17:00");
  await reset(); assert.equal(await seedQueue(now),60); assert.equal(await seedQueue(now),0);
  let sends=0;
  const sender=async(p:{id:string})=>{sends++;await new Promise(r=>setTimeout(r,50));return {externalId:`${TREASURE_PAGE}_${p.id}`,url:"https://www.facebook.com/test"};};
  await Promise.all([drainQueue(sender,now),drainQueue(sender,now),drainQueue(sender,now)]);
  assert.equal(sends,2,"Concurrent workers publish each reserved slot once");
  assert.equal(await prisma.contentIncomePost.count({where:{status:"posted"}}),2);
  assert.equal((await report()).estimatedCents,null,"No measured earnings means unknown");
  await reset(); await seedQueue(now); sends=0;
  const uncertain=async()=>{sends++;throw new Error("Response lost after submission");};
  await drainQueue(uncertain,now); await drainQueue(uncertain,now);
  assert.equal(sends,1,"Uncertain submissions block further posting and are never retried");
  assert.equal(await prisma.contentIncomePost.count({where:{status:"uncertain"}}),1);
  await reset(); await seedQueue(now); sends=0;
  await drainQueue(async()=>{sends++;throw new MetaRejected("Explicit provider rejection");},now);
  await drainQueue(sender,now); assert.equal(sends,2,"Confirmed rejects are not automatically replayed");
  await reset();await seedQueue(now);
  await prisma.liveSettings.upsert({where:{id:"treasure-hauls"},create:{campaignPaused:false,bindings:{facebook:{accountId:TREASURE_PAGE,label:"Isolated test"}}},update:{campaignPaused:false,bindings:{facebook:{accountId:TREASURE_PAGE,label:"Isolated test"}}}});
  const show=await prisma.liveShow.create({data:{title:"Isolated cap test",category:"Resale",status:"confirmed",startsAt:new Date(now.getTime()+3600000),whatnotUrl:"https://www.whatnot.com/live/isolated-cap-test"}});
  const preview=await prisma.liveCampaignPost.create({data:{showId:show.id,kind:"preview",platform:"facebook",accountId:TREASURE_PAGE,format:"feed",status:"queued",caption:"Upcoming resale show",dueAt:now,expiresAt:new Date(now.getTime()+3600000)}});
  sends=0;await drainQueue(sender,now);assert.equal(sends,1,"A confirmed preview retains its feed slot");
  assert.equal((await prisma.contentIncomePost.findFirstOrThrow({where:{status:"posted"}})).format,"image","Show previews cannot starve the image experiment every day");
  assert.ok(await reserveCampaign(preview.id,now),"Preview can use the second slot after an original");
  const remaining=await prisma.contentIncomePost.findFirstOrThrow({where:{status:"queued",scheduledAt:{lte:now}}});
  assert.equal(await reservePost(remaining.id,now),null,"Campaign and original reservations share one cap");
  await prisma.liveCampaignPost.deleteMany({where:{showId:show.id}});await prisma.liveShow.delete({where:{id:show.id}});
  await reset();await seedQueue(now);
  const due=await prisma.contentIncomePost.findFirstOrThrow({where:{scheduledAt:{lte:now}}});
  await prisma.contentIncomeAccount.update({where:{id:ACCOUNT_ID},data:{paused:true}});
  assert.equal(await reservePost(due.id,now),null,"Pause prevents a reservation");
  const receipt={action:"receipt",externalId:"fixture-receipt",amountCents:900,status:"pending",period:"2026-10",evidence:"isolated payment evidence"};
  await Promise.all([act(receipt),act(receipt)]);
  assert.equal(await prisma.contentIncomeReceipt.count(),1);
  await act({...receipt,status:"paid"});
  await assert.rejects(act(receipt),/backwards/);
  await assert.rejects(act({...receipt,amountCents:901}),/conflicts/);
  await act({...receipt,status:"reversed"});
  assert.equal((await report()).totals.paidCents,0);
  await prisma.contentIncomeEarningDay.create({data:{accountId:ACCOUNT_ID,endTime:now,amountMicros:BigInt(0),currency:"USD"}});
  assert.equal((await report()).estimatedCents,0,"Measured zero differs from unknown earnings");
  const copy=topicCopy(7,"image");
  const jpeg=await renderTip(copy.headline,[...copy.points]);
  assert.equal((await sharp(jpeg).metadata()).width,1080);
  await writeFile("/tmp/tolley-content-income-art.jpg",jpeg);
  for(let i=0;i<TOPICS.length;i++) {
    const c=topicCopy(i,"image");const points=c.points;
    assert.equal(points.length,3);assert.ok(c.headline.length<90);
  }
  console.log(JSON.stringify({queueIdempotence:"passed",concurrentPublishing:"passed",uncertainNoRetry:"passed",pause:"passed",receipts:"passed",missingVsZero:"passed",artwork:"1080x1350",date:centralDate(now)}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
