import { prisma } from "@/lib/prisma";
async function main() {
  const id = "cmsoxr9od0001l4ng7geu9hqo";
  const p = await prisma.youTubeProject.findUnique({ where: { id }, select: { costJson: true } });
  const c = (p?.costJson ?? {}) as any;
  if (c.byStage?.reconciliation?.repair21r2) { console.log("already"); return; }
  c.byStage = { ...(c.byStage ?? {}), reconciliation: { ...(c.byStage?.reconciliation ?? {}), repair21r2: 3.6 } };
  c.modalUsd = Math.round(((c.modalUsd ?? 0) + 3.41) * 100) / 100;
  c.geminiUsd = Math.round(((c.geminiUsd ?? 0) + 0.19) * 100) / 100;
  c.totalUsd = Math.round(((c.totalUsd ?? 0) + 3.6) * 100) / 100;
  await prisma.youTubeProject.update({ where: { id }, data: { costJson: c } });
  console.log("card total:", c.totalUsd);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
