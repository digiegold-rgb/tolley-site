import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { accountSchema, accountIsVerified, allowanceCents, batchSchema, commissionSchema, commissionTotals, handoffSchema, isInputUrl, productSchema, publicationId, RECIPE_VERSION, reviewSchema } from "./core";
import { cloudConfigured, connectedTikTokAccounts, pollRender, readSavedResult, spawnRender, workerHealth, type WorkerResult } from "./cloud";

export class ShopVideoError extends Error {
  constructor(message:string, public status=400) { super(message); }
}
export async function dashboard() {
  const [products,accounts,batches,commissions,connections,worker,catalog] = await Promise.all([
    prisma.shopVideoProduct.findMany({orderBy:{updatedAt:"desc"},take:200}),
    prisma.shopVideoAccount.findMany({orderBy:{updatedAt:"desc"}}),
    prisma.shopVideoBatch.findMany({orderBy:{createdAt:"desc"},take:40,include:{jobs:{orderBy:{createdAt:"asc"}}}}),
    prisma.shopVideoCommission.findMany({orderBy:{updatedAt:"desc"},take:100}),
    connectedTikTokAccounts().then(accounts=>({accounts,error:null})).catch(()=>({accounts:[],error:"Connected accounts could not be checked"})),
    cloudConfigured() ? workerHealth().catch(()=>null) : null,
    prisma.product.findMany({where:{tiktokShopId:{not:null}},select:{id:true,title:true,tiktokShopId:true,imageUrls:true,targetPrice:true},take:200,orderBy:{updatedAt:"desc"}}),
  ]);
  const aggregates = await prisma.shopVideoCommission.groupBy({by:["status"],_sum:{amountCents:true}});
  const costs = await prisma.shopVideoJob.aggregate({_sum:{allowanceCents:true,providerEstimateCents:true,actualCostCents:true}});
  const unconfirmedCharges = await prisma.shopVideoJob.count({where:{status:{not:"queued"},actualCostCents:null}});
  return {
    products,accounts:accounts.map(a=>({...a,verified:accountIsVerified(a)})),connections,
    catalog:catalog.filter(p=>/^\d{10,25}$/.test(p.tiktokShopId||"")).map(p=>({id:p.id,title:p.title,productId:p.tiktokShopId,productUrl:`https://www.tiktok.com/view/product/${p.tiktokShopId}`,imageUrl:p.imageUrls.find(isInputUrl)||"",priceCents:p.targetPrice==null?null:Math.round(p.targetPrice*100)})),
    batches:batches.map(b=>({...b,jobs:b.jobs.map(j=>({...j,callId:undefined,videoUrl:j.outputSize?`/api/hq/shop-videos/media/${j.id}`:null}))})),
    commissions,
    totals:{...commissionTotals(aggregates.map(r=>({status:r.status,amountCents:r._sum.amountCents||0}))),
      allowanceCents:costs._sum.allowanceCents||0,providerEstimateCents:costs._sum.providerEstimateCents||0,
      confirmedCostCents:costs._sum.actualCostCents||0,unconfirmedCharges},
    worker:{configured:cloudConfigured(),ready:worker?.ready===true,fal:worker?.fal===true,version:worker?.version||null},
  };
}
export async function saveProduct(input:unknown) {
  const v=productSchema.parse(input);
  const data={...v,realVideoUrl:v.realVideoUrl||null};
  return prisma.shopVideoProduct.upsert({where:{productId:v.productId},create:data,update:data});
}
export async function verifyAccount(input:unknown, loadAccounts=connectedTikTokAccounts) {
  const v=accountSchema.parse(input);
  const accounts=await loadAccounts();
  const found=accounts.find((a:{externalAccountId:string})=>a.externalAccountId===v.externalAccountId);
  if (!found) throw new ShopVideoError("Choose an active connected TikTok account",409);
  const data={...found,dailyQuota:v.dailyQuota,weeklyQuota:v.weeklyQuota,verifiedAt:new Date()};
  return prisma.shopVideoAccount.upsert({where:{externalAccountId:v.externalAccountId},create:data,update:data});
}
export async function createBatch(input:unknown, cloud={workerHealth,connectedTikTokAccounts}) {
  const v=batchSchema.parse(input);
  async function previous() {
    const existing=await prisma.shopVideoBatch.findUnique({where:{requestKey:v.requestKey},include:{jobs:{select:{productSnapshot:true}}}});
    if (!existing) return null;
    const ids=existing.jobs.map(j=>(j.productSnapshot as {id:string}).id).sort();
    if (existing.accountId!==v.accountId || existing.provider!==v.provider || existing.format!==v.format || existing.scene!==v.scene || existing.overlay!==v.overlay || existing.maxSpendCents!==v.maxSpendCents || JSON.stringify(ids)!==JSON.stringify([...v.productIds].sort())) throw new ShopVideoError("This batch request was already used with different settings. Refresh before starting another batch.",409);
    return existing;
  }
  const existing=await previous();
  if (existing) return existing;
  const health=await cloud.workerHealth().catch(()=>null);
  if (!health?.ready || ((v.provider==="fal" || v.scene!=="original") && !health.fal)) throw new ShopVideoError("The cloud video worker is not ready. Check its setup before generating.",503);
  const account=await prisma.shopVideoAccount.findUnique({where:{id:v.accountId}});
  if (!account || !accountIsVerified(account)) throw new ShopVideoError("Confirm this account's affiliate access and posting quota first",409);
  const connected=await cloud.connectedTikTokAccounts();
  if (!connected.some((a:{externalAccountId:string;username:string})=>a.externalAccountId===account.externalAccountId && a.username===account.username)) throw new ShopVideoError("This account connection changed. Verify it again.",409);
  const products=await prisma.shopVideoProduct.findMany({where:{id:{in:v.productIds}}});
  if (products.length!==v.productIds.length) throw new ShopVideoError("A selected product no longer exists",409);
  for (const p of products) {
    productSchema.parse(p);
    if (v.format==="hybrid" && (!p.realVideoUrl || !p.realFootageConfirmed)) throw new ShopVideoError(`Add and confirm real demonstration footage for ${p.title}`,409);
  }
  const cents=allowanceCents(v.provider,v.scene);
  if (cents*products.length>v.maxSpendCents) throw new ShopVideoError("The batch allowance exceeds your spending limit",409);
  try {
    return await prisma.shopVideoBatch.create({data:{requestKey:v.requestKey,accountId:account.id,username:account.username,
      provider:v.provider,format:v.format,scene:v.scene,overlay:v.overlay,maxSpendCents:v.maxSpendCents,reservedCents:cents*products.length,
      jobs:{create:products.map(p=>({productSnapshot:JSON.parse(JSON.stringify(p)) as Prisma.InputJsonValue,allowanceCents:cents}))}}});
  } catch(e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2002") {
      const found=await previous(); if (found) return found;
    }
    throw e;
  }
}
export async function dispatchQueued(batchId?:string, submit=spawnRender) {
  const queued=await prisma.shopVideoJob.findMany({where:{status:"queued",...(batchId?{batchId}:{})},orderBy:{createdAt:"asc"},take:20,include:{batch:true}});
  for (const job of queued) {
    const claimed=await prisma.shopVideoJob.updateMany({where:{id:job.id,status:"queued"},data:{status:"dispatching"}});
    if (!claimed.count) continue;
    try {
      const callId=await submit({job_id:job.id,recipe_version:RECIPE_VERSION,provider:job.batch.provider,format:job.batch.format,
        scene:job.batch.scene,overlay:job.batch.overlay,allowance_cents:job.allowanceCents,product:job.productSnapshot});
      await prisma.shopVideoJob.update({where:{id:job.id},data:{status:"rendering",callId}});
    } catch {
      // A lost response can still be a paid spawn. Hold; never auto-submit again.
      await prisma.shopVideoJob.update({where:{id:job.id},data:{status:"held",error:"Cloud submission could not be confirmed. Reconcile this job in Modal before submitting another batch."}});
    }
  }
}
async function applyResult(id:string, result:WorkerResult, statuses=["rendering"]) {
  const valid=result.status==="ready" && Number.isSafeInteger(result.size) && result.size!>0 && result.size!<=4*1024*1024 &&
    /^[a-f0-9]{64}$/.test(result.sha256||"") && result.width===1080 && result.height===1920 && Math.abs((result.duration||0)-8)<0.15;
  if (result.status==="ready" && !valid) {
    await prisma.shopVideoJob.updateMany({where:{id,status:{in:statuses}},data:{status:"held",error:"Cloud output did not pass the video format checks"}}); return;
  }
  await prisma.shopVideoJob.updateMany({where:{id,status:{in:statuses}},data:{status:valid?"ready":result.status==="failed"?"failed":"held",
    error:valid?null:(result.error||"Cloud result needs reconciliation").slice(0,500),
    outputSize:valid?result.size:null,outputSha256:valid?result.sha256:null,outputDuration:valid?result.duration:null,
    outputWidth:valid?result.width:null,outputHeight:valid?result.height:null,
    providerEstimateCents:Number.isSafeInteger(result.providerEstimateCents) && result.providerEstimateCents!>=0?result.providerEstimateCents:null,
    receipts:result.receipts?JSON.parse(JSON.stringify(result.receipts)):undefined,
  }});
}
export async function recoverJob(id:string, read=readSavedResult) {
  const job=await prisma.shopVideoJob.findUnique({where:{id}});
  if (!job || !["held","rendering","dispatching"].includes(job.status)) throw new ShopVideoError("Only interrupted cloud jobs can be recovered",409);
  const result=await read(id);
  if (!result) throw new ShopVideoError("No completed result is saved yet. Check this job in Modal; recovery never submits a new generation.",409);
  await applyResult(id,result,["held","rendering","dispatching"]);
  return prisma.shopVideoJob.findUniqueOrThrow({where:{id}});
}
export async function refreshJobs(poll=pollRender, submit=spawnRender) {
  await prisma.shopVideoJob.updateMany({where:{status:"dispatching",updatedAt:{lt:new Date(Date.now()-180000)}},data:{status:"held",error:"Submission interrupted. Reconcile this job in Modal; it will not be submitted twice."}});
  await dispatchQueued(undefined,submit);
  const rows=await prisma.shopVideoJob.findMany({where:{status:"rendering",callId:{not:null}},take:20,orderBy:{createdAt:"asc"}});
  // Bound RPC fan-out to avoid a slow single call delaying the entire dashboard.
  for (let i=0;i<rows.length;i+=4) await Promise.all(rows.slice(i,i+4).map(async job=>{
    let result;
    try { result=await poll(job.callId!); } catch { return; }
    if (!result) return;
    await applyResult(job.id,result);
  }));
}
export async function jobAction(id:string,input:unknown, loadAccounts=connectedTikTokAccounts) {
  const action=z.object({action:z.string()}).parse(input).action;
  const job=await prisma.shopVideoJob.findUnique({where:{id},include:{batch:true}});
  if (!job) throw new ShopVideoError("Video not found",404);
  if (action==="approve") {
    const review=reviewSchema.parse(input);
    if (!job.outputSize || !["ready","approved"].includes(job.status)) throw new ShopVideoError("Review a completed video first",409);
    if (job.batch.format==="boomerang" && !review.precheckPassed) throw new ShopVideoError("A pure display loop needs a passed TikTok video pre-check before Shop handoff",409);
    const updated=await prisma.shopVideoJob.updateMany({where:{id,status:{in:["ready","approved"]}},data:{status:"approved",review,reviewedAt:new Date()}});
    if (!updated.count) throw new ShopVideoError("Video state changed; refresh before reviewing",409);
    return prisma.shopVideoJob.findUniqueOrThrow({where:{id}});
  }
  if (action==="reject") {
    const v=z.object({reason:z.string().trim().min(1).max(500)}).parse(input);
    if (!["ready","approved"].includes(job.status)) throw new ShopVideoError("Only unposted completed videos can be rejected",409);
    const updated=await prisma.shopVideoJob.updateMany({where:{id,status:{in:["ready","approved"]}},data:{status:"rejected",error:v.reason}});
    if (!updated.count) throw new ShopVideoError("Video state changed; refresh before rejecting",409);
    return prisma.shopVideoJob.findUniqueOrThrow({where:{id}});
  }
  if (action==="cost") {
    const v=z.object({amountCents:z.number().int().min(0).max(100000),evidence:z.string().trim().min(3).max(500)}).parse(input);
    return prisma.shopVideoJob.update({where:{id},data:{actualCostCents:v.amountCents,costEvidence:v.evidence}});
  }
  if (action==="handoff" || action==="published") {
    const active=await loadAccounts();
    return prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"shop-video-account:"+job.batch.accountId}))`;
      const fresh=await tx.shopVideoJob.findUniqueOrThrow({where:{id},include:{batch:true}});
      const account=await tx.shopVideoAccount.findUnique({where:{id:fresh.batch.accountId}});
      if (!account || !accountIsVerified(account) || !active.some((a:{externalAccountId:string;username:string})=>a.externalAccountId===account.externalAccountId && a.username===fresh.batch.username)) throw new ShopVideoError("Verify this account's affiliate access and current quota again",409);
      if (action==="published") {
        const v=z.object({url:z.string().url()}).parse(input);
        const publishedId=publicationId(v.url,fresh.batch.username);
        if (fresh.status==="published" && fresh.publishedId===publishedId) return fresh;
        if (fresh.status!=="handoff") throw new ShopVideoError("Complete the reviewed TikTok handoff first",409);
        return tx.shopVideoJob.update({where:{id},data:{status:"published",publishedAt:new Date(),publishedUrl:v.url,publishedId}});
      }
      const handoff=handoffSchema.parse(input);
      if (fresh.status==="handoff" || fresh.status==="published") return fresh;
      if (fresh.status!=="approved") throw new ShopVideoError("Approve this video before preparing a Shop post",409);
      const weekAgo=new Date(Date.now()-7*86400000),dayAgo=new Date(Date.now()-86400000);
      const used=await tx.shopVideoJob.findMany({where:{batch:{accountId:account.id},status:{in:["handoff","published"]},OR:[{handoffAt:{gte:weekAgo}},{publishedAt:{gte:weekAgo}}]},select:{handoffAt:true,publishedAt:true}});
      const daily=used.filter(r=>(r.publishedAt||r.handoffAt)!>=dayAgo).length;
      if (daily>=account.dailyQuota || used.length>=account.weeklyQuota) throw new ShopVideoError("Your confirmed Shop posting quota is used. Include posts made outside this tool when checking availability.",409);
      return tx.shopVideoJob.update({where:{id},data:{status:"handoff",handoff,handoffAt:new Date()}});
    },{timeout:15000});
  }
  throw new ShopVideoError("Unknown video action");
}
export async function saveCommission(input:unknown) {
  const v=commissionSchema.parse(input);
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"shop-video-commission:"+v.externalId}))`;
    const job=await tx.shopVideoJob.findUnique({where:{id:v.jobId}});
    if (job?.status!=="published") throw new ShopVideoError("Attribute commissions to a recorded published video",409);
    const existing=await tx.shopVideoCommission.findUnique({where:{externalId:v.externalId}});
    if (existing && existing.jobId!==v.jobId) throw new ShopVideoError("This order line is already attributed to another video",409);
    if (existing && ((existing.status==="settled" && v.status==="pending") || (existing.status==="reversed" && v.status!=="reversed"))) throw new ShopVideoError("An older order status cannot overwrite a settlement or reversal",409);
    return tx.shopVideoCommission.upsert({where:{externalId:v.externalId},create:v,update:v});
  });
}
