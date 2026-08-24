import { prisma } from "@/lib/prisma";
async function main() {
  const id = "cmsoxr9od0001l4ng7geu9hqo";
  const p = await prisma.youTubeProject.findUnique({ where: { id }, select: { costJson: true } });
  const c = (p?.costJson ?? {}) as any;
  const byStage = c.byStage ?? {};
  if (byStage.reconciliation?.repair21) { console.log("already booked"); return; }
  byStage.reconciliation = { ...(byStage.reconciliation ?? {}), repair21: 11.40 };
  const updated = {
    ...c,
    byStage,
    modalUsd: Math.round(((c.modalUsd ?? 0) + 11.07) * 100) / 100,
    geminiUsd: Math.round(((c.geminiUsd ?? 0) + 0.33) * 100) / 100,
    totalUsd: Math.round(((c.totalUsd ?? 0) + 11.40) * 100) / 100,
  };
  await prisma.youTubeProject.update({ where: { id }, data: { costJson: updated } });
  console.log("costJson booked:", updated.totalUsd);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
