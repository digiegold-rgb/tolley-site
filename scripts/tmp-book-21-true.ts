import { prisma } from "@/lib/prisma";
async function main() {
  const id = "cmsoxr9od0001l4ng7geu9hqo";
  const p = await prisma.youTubeProject.findUnique({ where: { id }, select: { costJson: true } });
  const c = (p?.costJson ?? {}) as any;
  c.byStage = { ...(c.byStage ?? {}), reconciliation: {
    originalRenderTrueUp: 5.53, repair21: 11.40, repair21r2: 3.60,
    note: "modal billing truth 8/11-8/13; totalUsd = 22.90 all-in, three renders",
  }};
  c.modalUsd = 21.9; c.geminiUsd = 1.0; c.totalUsd = 22.9;
  await prisma.youTubeProject.update({ where: { id }, data: { costJson: c } });
  console.log("card:", c.totalUsd);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
