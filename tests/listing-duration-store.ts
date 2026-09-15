import assert from 'node:assert/strict';
const url=new URL(process.env.DATABASE_URL || 'postgresql://invalid');
if(url.hostname!=='127.0.0.1'||url.port!=='55438'||url.pathname!=='/tolley_revenue_test')throw Error('Isolated test DB required');
async function main(){
 const {prisma}=await import('../lib/prisma');
 // This script runs outside Next; bypass only its package-boundary marker.
 const Module = (await import('node:module')).default as unknown as { _load: (...args: unknown[]) => unknown };
 const load = Module._load;
 Module._load = function(request, ...args) { return request === 'server-only' ? {} : load.call(this, request, ...args); };
 const {validateDraft,toDto,jobPriceCents,jobEstCostCents}=await import('../lib/vater/listing/store');
 Module._load = load;
 const id='duration-regression-'+Date.now();
 try{
  for(const durationS of [3,31,-1,5.5,'10',true])assert.equal(validateDraft({durationS}).ok,false);
  const draft=validateDraft({sku:'beauty_shot',durationS:15});assert(draft.ok);
  await prisma.vaterListingJob.create({data:{id,userId:'duration-regression',sku:'beauty_shot',sourceImageUrls:['https://example.invalid/room.jpg']}});
  const old=await prisma.vaterListingJob.findUniqueOrThrow({where:{id}});
  assert.equal(toDto(old).durationS,5);assert.equal(jobPriceCents(old),500);
  await prisma.vaterListingJob.update({where:{id},data:draft.data});
  const saved=await prisma.vaterListingJob.findUniqueOrThrow({where:{id}});
  assert.equal(toDto(saved).durationS,15);assert.equal(jobPriceCents(saved),1500);assert.equal(jobEstCostCents(saved),750);
  const vertical=await prisma.vaterListingJob.update({where:{id},data:{reel:true}});
  assert.equal(jobPriceCents(vertical),3000);
  console.log('PASS: strict draft validation, nullable migration/legacy default, saved duration round trip and server pricing with reel. No billing or renders.');
 }finally{await prisma.vaterListingJob.deleteMany({where:{id}});await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
