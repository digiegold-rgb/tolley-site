import {z} from "zod";
import {prisma} from "@/lib/prisma";
const schema=z.object({tool:z.literal("website-check"),checkedAt:z.iso.datetime(),zone:z.literal("America/Chicago"),days:z.array(z.object({day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),completed:z.number().int().nonnegative(),cached:z.number().int().nonnegative()})).max(30)});
export async function syncUtilityStats(){
 const old=await prisma.growthActivity.findUnique({where:{id:"cordport-tool-health"}});
 if(old && old.updatedAt.getTime()>Date.now()-3600000)return;
 try{
  const response=await fetch("https://cordport.io/api/tools/stats",{redirect:"error",signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error();const result=schema.parse(await response.json());
  await prisma.growthActivity.upsert({where:{id:"cordport-tool-health"},create:{id:"cordport-tool-health",kind:"utility",status:"collected",title:"Cordport website checker",detail:"Dated aggregate usage collected. No visitor details or checked domains are shared with HQ.",metadata:result,url:"https://cordport.io/tools/website-check"},update:{status:"collected",detail:"Dated aggregate usage collected. No visitor details or checked domains are shared with HQ.",metadata:result}});
 }catch{await prisma.growthActivity.upsert({where:{id:"cordport-tool-health"},create:{id:"cordport-tool-health",kind:"utility",status:"unavailable",title:"Cordport website checker",detail:"Usage collection unavailable; no zero result inferred."},update:{status:"unavailable",detail:"Usage collection unavailable; previous snapshot retained with its original date."}});}
}
