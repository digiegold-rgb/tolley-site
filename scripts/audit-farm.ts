import { prisma } from "../lib/prisma";

(async () => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const farmZips = ["64052", "64055", "64056", "64057", "64014"];
  const jobs = await prisma.dossierJob.findMany({
    where: {
      status: "done",
      createdAt: { gte: since },
      result: { isNot: null },
      listing: { zip: { in: farmZips } },
    },
    select: {
      id: true,
      createdAt: true,
      result: {
        select: { motivationScore: true, motivationFlags: true, owners: true },
      },
      listing: {
        select: { address: true, city: true, zip: true, listPrice: true },
      },
    },
    orderBy: [
      { result: { motivationScore: "desc" } },
      { createdAt: "desc" },
    ],
  });
  console.log(
    `Found ${jobs.length} farm-zip dossiers (status=done, last 7d):\n`,
  );
  jobs.forEach((j, i) => {
    const o = j.result?.owners as
      | { name?: string; phone?: string; primary?: { name?: string; phone?: string } }
      | Array<{ name?: string; phone?: string }>
      | null
      | undefined;
    let name = "-", phone = "-";
    if (o) {
      const c = Array.isArray(o)
        ? (o[0] as { name?: string; phone?: string } | undefined)
        : (o as { name?: string; phone?: string }).name
        ? (o as { name?: string; phone?: string })
        : (o as { primary?: { name?: string; phone?: string } }).primary;
      if (c) {
        name = c.name || "-";
        phone = c.phone || "-";
      }
    }
    console.log(`${i + 1}. [${j.listing?.zip}] ${j.listing?.address}`);
    console.log(
      `   score=${j.result?.motivationScore} | owner=${name} | phone=${phone}`,
    );
    console.log(
      `   flags=${(j.result?.motivationFlags || []).join(", ") || "none"}`,
    );
  });
  await prisma.$disconnect();
})();
