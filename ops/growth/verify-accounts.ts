import { prisma } from "../../lib/prisma";
import { verifyCampaignAccount, type Binding } from "../../lib/live/campaign-publish";
async function main() {
 const settings=await prisma.liveSettings.findUniqueOrThrow({where:{id:"treasure-hauls"}});
 for(const [key,binding] of Object.entries(settings.bindings as Record<string,Binding>)) {
  const platform=key.startsWith("crossover:")?key.split(":")[1]:key;
  if(!["facebook","instagram"].includes(platform))continue;
  let status="verified",detail="Connected account identity verified through the platform API. Posting still requires a live show and enabled controls.";
  try {await verifyCampaignAccount(platform,binding.accountId);}catch{status="needs_reconnect";detail="Account identity could not be verified. Reconnect in Social before relying on announcements.";}
  const id=`account-check-${platform}-${binding.accountId}`;
  await prisma.growthActivity.upsert({where:{id},create:{id,kind:"account",title:binding.label,status,detail},update:{status,detail}});
  console.log(binding.label,status);
 }
}
main().catch(()=>{console.error("Account verification could not complete");process.exitCode=1;}).finally(()=>prisma.$disconnect());
