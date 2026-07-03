import { prisma } from "../lib/prisma";
(async () => {
  const FARM_ZIPS = ["64052", "64055", "64056", "64057", "64014"];
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const jobs = await prisma.dossierJob.findMany({
    where: { createdAt: { gte: since }, listing: { zip: { in: FARM_ZIPS } } },
    select: {
      id: true, status: true,
      stepsCompleted: true, stepsFailed: true, stepDetails: true,
      listing: { select: { address: true, zip: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  for (const j of jobs) {
    console.log(`\n[${j.listing?.zip}] ${j.listing?.address}`);
    console.log(`  status=${j.status}`);
    console.log(`  stepsCompleted=${JSON.stringify(j.stepsCompleted)}`);
    console.log(`  stepsFailed=${JSON.stringify(j.stepsFailed)}`);
    const sd = j.stepDetails as Record<string, unknown>;
    const cbc = sd?.["cyberbackgroundchecks"] || sd?.["dgx-research-worker"];
    console.log(`  cbc/worker step=${JSON.stringify(cbc)?.slice(0, 250)}`);
  }
  await prisma.$disconnect();
})();
