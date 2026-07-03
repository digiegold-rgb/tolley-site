import { PrismaClient } from "@prisma/client";
import { createHmac } from "crypto";
import "dotenv/config";

const salt = process.env.ANALYTICS_IP_SALT;
if (!salt) {
  console.error("ANALYTICS_IP_SALT not set in env. Pull it from Vercel first:");
  console.error("  npx vercel env pull .env.local");
  process.exit(1);
}

function hashIp(ip) {
  return createHmac("sha256", salt).update(ip).digest("hex");
}

const prisma = new PrismaClient();

async function backfillTable(model, label) {
  // 1. Find rows with a raw ip but no hash.
  const toHash = await model.findMany({
    where: { ip: { not: null }, ipHash: null },
    select: { id: true, ip: true },
  });
  console.log(`[${label}] Rows needing hash: ${toHash.length}`);

  let hashed = 0;
  for (const row of toHash) {
    await model.update({
      where: { id: row.id },
      data: { ipHash: hashIp(row.ip) },
    });
    hashed++;
    if (hashed % 200 === 0) console.log(`[${label}]   hashed ${hashed}/${toHash.length}`);
  }
  console.log(`[${label}] Hashed: ${hashed}`);

  // 2. Null out raw ip on every row where a hash now exists.
  const nulled = await model.updateMany({
    where: { ipHash: { not: null }, ip: { not: null } },
    data: { ip: null },
  });
  console.log(`[${label}] Raw IPs nulled: ${nulled.count}`);

  // 3. Sanity: any rows left with a raw ip?
  const leftover = await model.count({ where: { ip: { not: null } } });
  console.log(`[${label}] Rows still holding a raw ip: ${leftover}`);
}

console.log("=== Backfilling SiteView ===");
await backfillTable(prisma.siteView, "SiteView");
console.log("\n=== Backfilling SiteEvent ===");
await backfillTable(prisma.siteEvent, "SiteEvent");

await prisma.$disconnect();
console.log("\nDone.");
