/** Connect an unposted cloud acceptance fixture to the isolated HQ for playback checks. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { readSavedResult, readVideo } from "../lib/shop-video/cloud";
if(new URL(process.env.DATABASE_URL||"http://missing").port!=="55449")throw new Error("Artifact acceptance requires the isolated test database");
async function main(){
  const id=process.argv[2];assert.match(id,/^acceptance-modal-[a-f0-9-]{36}$/);
  const result=await readSavedResult(id);assert.equal(result?.status,"ready");assert.ok(result?.size);
  const bytes=await readVideo(id,0,result.size-1);assert.equal(bytes.length,result.size);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),result.sha256);
  await writeFile("/tmp/tolley-shop-video-validation/modal-acceptance.mp4",bytes,{mode:0o600});
  const account=await prisma.shopVideoAccount.findFirstOrThrow();
  const product=await prisma.shopVideoProduct.findFirstOrThrow();
  const batch=await prisma.shopVideoBatch.create({data:{requestKey:randomUUID(),accountId:account.id,username:account.username,provider:"modal",format:"boomerang",scene:"original",overlay:"Cloud render acceptance",maxSpendCents:150,reservedCents:150}});
  await prisma.shopVideoJob.create({data:{id,batchId:batch.id,productSnapshot:JSON.parse(JSON.stringify({...product,title:"Unposted cloud acceptance fixture"})),status:"ready",allowanceCents:150,providerEstimateCents:result.providerEstimateCents,outputSize:result.size,outputSha256:result.sha256,outputDuration:result.duration,outputWidth:result.width,outputHeight:result.height}});
  console.log(JSON.stringify({cloudArtifact:"downloaded and SHA-256 verified",isolatedHqJob:id,productionRowsWritten:0,publicPosts:0}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
