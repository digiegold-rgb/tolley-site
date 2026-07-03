/**
 * Re-run the farm-zip dossiers through the full pipeline so DossierResult.owners
 * gets populated with real CBC data instead of "[demo — see full dossier]".
 *
 * Sets undici global timeouts to 20 minutes — pipeline.ts uses fetch() to hit
 * the research worker, and Node's default 5-min headersTimeout was killing
 * runs at 301s mid-extraction.
 */
import { Agent, setGlobalDispatcher } from "undici";
setGlobalDispatcher(
  new Agent({
    headersTimeout: 20 * 60 * 1000,
    bodyTimeout: 20 * 60 * 1000,
    connectTimeout: 60_000,
  }),
);

import { prisma } from "../lib/prisma";
import { runDossierPipeline } from "../lib/dossier/pipeline";

const FARM_ZIPS = ["64052", "64055", "64056", "64057", "64014"];

async function main() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const candidates = await prisma.dossierJob.findMany({
    where: {
      createdAt: { gte: since },
      listing: { zip: { in: FARM_ZIPS } },
    },
    select: {
      id: true,
      status: true,
      listing: { select: { address: true, zip: true } },
      result: { select: { owners: true, motivationScore: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Skip listings whose owners look real (have a name + phone, not "[demo")
  const needsRerun = candidates.filter((c) => {
    const o = c.result?.owners as { name?: string; phone?: string } | null;
    if (!o) return true;
    const name = typeof o.name === "string" ? o.name : "";
    const phone = typeof o.phone === "string" ? o.phone : "";
    if (name.startsWith("[demo")) return true;
    if (!phone) return true;
    return false;
  });

  console.log(`Total farm-zip jobs (7d): ${candidates.length}`);
  console.log(`Need rerun (placeholder/no phone): ${needsRerun.length}\n`);

  for (let i = 0; i < needsRerun.length; i++) {
    const j = needsRerun[i];
    const tag = `[${i + 1}/${needsRerun.length}] ${j.listing?.zip} ${j.listing?.address}`;
    console.log(`\n▶ ${tag} (jobId=${j.id})`);
    const t0 = Date.now();
    try {
      // Reset to queued so pipeline takes ownership cleanly
      await prisma.dossierJob.update({
        where: { id: j.id },
        data: {
          status: "queued",
          errorMessage: null,
          stepsCompleted: [],
          stepsFailed: [],
          stepDetails: {},
        },
      });
      await runDossierPipeline(j.id);
      const after = await prisma.dossierJob.findUnique({
        where: { id: j.id },
        select: {
          status: true,
          result: {
            select: { motivationScore: true, owners: true, motivationFlags: true },
          },
        },
      });
      const o = after?.result?.owners as
        | { name?: string; phone?: string; email?: string; age?: string }
        | null;
      const name = (o?.name as string) || "—";
      const phone = (o?.phone as string) || "—";
      const elapsed = Math.round((Date.now() - t0) / 1000);
      console.log(
        `  ✔ ${elapsed}s status=${after?.status} score=${after?.result?.motivationScore} owner=${name} phone=${phone}`,
      );
    } catch (err) {
      const elapsed = Math.round((Date.now() - t0) / 1000);
      console.log(
        `  ✘ ${elapsed}s ERROR ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  await prisma.$disconnect();
  console.log("\nDONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
