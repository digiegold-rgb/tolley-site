import { prisma } from "../lib/prisma";
import { enable, drainQueue, syncMetrics, report } from "../lib/content-income/store";
async function main() {
  const command = process.argv[2] || "report";
  if(command === "enable") console.log(JSON.stringify(await enable()));
  else if(command === "publish-due") console.log(JSON.stringify(await drainQueue()));
  else if(command === "sync") console.log(JSON.stringify(await syncMetrics()));
  else if(command !== "report") throw new Error("Use report, enable, publish-due or sync");
  const r=await report();
  console.log(JSON.stringify({account:r.account,counts:r.counts,estimatedCents:r.estimatedCents,earningsDays:r.earningDays.length,receipts:r.totals,posts:r.posts.filter(p=>["posted","uncertain","sending","failed"].includes(p.status)).map(p=>({id:p.id,status:p.status,url:p.url,error:p.error,views:p.views})),queued:r.posts.filter(p=>p.status==="queued").length}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Operator command failed");process.exitCode=1;}).finally(()=>prisma.$disconnect());
