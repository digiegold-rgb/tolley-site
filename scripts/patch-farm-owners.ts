/**
 * Patch the 4 farm-zip listings with the real owners we just got from
 * MLS SSO (RPR + Realist). Updates BOTH:
 *   - Listing.rawData.ownerName  (so any future dossier rerun seeds CBC properly)
 *   - DossierResult.owners       (so the Monday digest cards show real names today)
 */
import { prisma } from "../lib/prisma";

const OWNERS: Record<
  string,
  Array<{ name: string; role: "owner" | "co-owner"; confidence: number; mailingAddress?: string }>
> = {
  // address keys MUST exactly match Listing.address
  "14601 33RD Terrace, Independence, MO 64055": [
    { name: "Charlene Fristoe", role: "owner", confidence: 0.95 },
  ],
  "7944 6th Terrace, Blue Springs, MO 64014": [
    {
      name: "Zachary Dillman",
      role: "owner",
      confidence: 0.95,
      mailingAddress: "7944 SE 6th Ter, Blue Springs, MO 64014-7701",
    },
    { name: "Taylor Dillman", role: "co-owner", confidence: 0.9 },
  ],
  "18717 Hanthorn Drive, Independence, MO 64057": [
    {
      name: "Armm Assets 3 LLC",
      role: "owner",
      confidence: 0.95,
      mailingAddress: "401 Congress Ave, Austin, TX 78701",
    },
  ],
  "3525 Woodland Court, Independence, MO 64052": [
    {
      name: "Jorge L Lopez-Flores",
      role: "owner",
      confidence: 0.95,
      mailingAddress: "3525 S Woodland Ct, Independence, MO 64052",
    },
    { name: "Reyna F Beltran", role: "co-owner", confidence: 0.9 },
  ],
};

(async () => {
  for (const [addr, owners] of Object.entries(OWNERS)) {
    const listing = await prisma.listing.findFirst({
      where: { address: { startsWith: addr.split(",")[0] } },
      select: { id: true, address: true, rawData: true },
    });
    if (!listing) {
      console.log(`✘ no Listing for ${addr}`);
      continue;
    }
    const newRaw = {
      ...((listing.rawData as Record<string, unknown>) || {}),
      ownerName: owners[0].name,
      ownerNames: owners.map((o) => o.name),
    };
    await prisma.listing.update({
      where: { id: listing.id },
      data: { rawData: newRaw },
    });

    // Find latest DossierJob + update its DossierResult.owners
    const job = await prisma.dossierJob.findFirst({
      where: { listingId: listing.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (job) {
      // The owners JSON we want for the digest's pickOwnerInfo() — first
      // owner becomes `primary`, plus full array in `all` so the email
      // can show "Owner: Jorge + Reyna".
      const ownersJson = {
        name: owners[0].name,
        mailingAddress: owners[0].mailingAddress || null,
        all: owners,
      };
      await prisma.dossierResult.update({
        where: { jobId: job.id },
        data: { owners: ownersJson, entityType: owners[0].name.match(/LLC|Inc|Corp|Trust/i) ? "llc" : "individual" },
      });
      console.log(`✔ ${addr} → ${owners[0].name} (job ${job.id})`);
    } else {
      console.log(`⚠ ${addr}: listing patched but no DossierJob to update result`);
    }
  }
  await prisma.$disconnect();
  console.log("\nDONE");
})();
