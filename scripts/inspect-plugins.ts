import { prisma } from "../lib/prisma";
(async () => {
  const j = await prisma.dossierJob.findUnique({
    where: { id: "cmoth6las000hl4pvzoa57fxw" },
    select: { stepDetails: true, result: { select: { pluginData: true } } },
  });
  const sd = j?.stepDetails as Record<string, any>;
  // What did county-assessor, narrpr-import, people-search, skip-trace produce?
  for (const k of ["county-assessor", "narrpr-import", "people-search", "skip-trace", "regrid", "snap-and-know", "court-records"]) {
    const s = sd?.[k];
    if (s) {
      console.log(`\n=== ${k} ===`);
      console.log(`status=${s.status} elapsed=${s.elapsed}ms`);
      if (s.error) console.log(`error=${s.error}`);
      if (s.data) console.log(`data=${JSON.stringify(s.data).slice(0, 500)}`);
      if (s.summary) console.log(`summary=${JSON.stringify(s.summary).slice(0, 300)}`);
    }
  }
  // Check pluginData for owner-name candidates
  const pd = j?.result?.pluginData as Record<string, any> | null;
  if (pd) {
    console.log("\n=== pluginData keys ===");
    console.log(Object.keys(pd));
    for (const k of Object.keys(pd)) {
      const data = pd[k]?.data || pd[k];
      const ownerHints = JSON.stringify(data).match(/"(name|ownerName|owner|rawEntityName)"\s*:\s*"[^"]+"/g);
      if (ownerHints) console.log(`  ${k}: ${ownerHints.slice(0, 5).join(" | ")}`);
    }
  }
  await prisma.$disconnect();
})();
