/**
 * READ-ONLY report: reconstruct Wayne Clark / Aramsco's recurring delivery runs
 * from his historical invoice line items.
 *
 *   npx tsx scripts/wayne-runs-report.ts
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    // strip literal trailing backslash-n / real newline bug in env values
    val = val.replace(/\\n$/, "").replace(/\s+$/, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), ".env.local"));
loadEnvFile(join(process.cwd(), ".env.production.local"));
loadEnvFile(join(process.cwd(), ".env"));

import { prisma } from "../lib/prisma";

async function main() {
  const needle = process.argv[2] || "Wayne";
  const contact = await prisma.accountContact.findFirst({
    where: { name: { contains: needle, mode: "insensitive" } },
  });
  if (!contact) {
    console.log(`No contact matching '${needle}' found.`);
    return;
  }
  console.log(`\n=== CONTACT ===`);
  console.log(`id=${contact.id}  name=${contact.name}  email=${contact.email ?? "-"}  phone=${contact.phone ?? "-"}`);

  const invoices = await prisma.invoice.findMany({
    where: { contactId: contact.id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    orderBy: { issueDate: "asc" },
  });

  console.log(`\n=== INVOICES (${invoices.length}) ===`);
  for (const inv of invoices) {
    console.log(
      `${inv.invoiceNumber}  ${inv.issueDate.toISOString().slice(0, 10)}  status=${inv.status}  total=$${Number(inv.total).toFixed(2)}  due=$${Number(inv.amountDue).toFixed(2)}  lines=${inv.lineItems.length}`
    );
  }

  // Aggregate line items by normalized description → the "regular runs"
  type Agg = { desc: string; count: number; milesSet: Set<number>; rates: Set<number>; lastSeen: string };
  const byDesc = new Map<string, Agg>();
  for (const inv of invoices) {
    const d = inv.issueDate.toISOString().slice(0, 10);
    for (const li of inv.lineItems) {
      const desc = (li.description ?? "").trim();
      if (!desc) continue;
      const key = desc.toLowerCase().replace(/\s+/g, " ");
      const a = byDesc.get(key) ?? { desc, count: 0, milesSet: new Set(), rates: new Set(), lastSeen: d };
      a.count += 1;
      a.milesSet.add(Number(li.quantity));
      a.rates.add(Number(li.unitAmount));
      if (d > a.lastSeen) a.lastSeen = d;
      byDesc.set(key, a);
    }
  }

  const rows = [...byDesc.values()].sort((x, y) => y.count - x.count);
  console.log(`\n=== DISTINCT LINE-ITEM DESCRIPTIONS (${rows.length}) — sorted by frequency ===`);
  for (const r of rows) {
    const miles = [...r.milesSet].sort((a, b) => a - b).join("/");
    const rates = [...r.rates].sort((a, b) => a - b).map((v) => `$${v}`).join("/");
    console.log(`x${r.count}  [${rates} @ ${miles}mi]  last=${r.lastSeen}  ${r.desc}`);
  }

  // Full raw dump for the most recent 3 invoices so we can see exact templates
  console.log(`\n=== RAW LINE ITEMS — most recent 3 invoices ===`);
  for (const inv of invoices.slice(-3)) {
    console.log(`\n-- ${inv.invoiceNumber} (${inv.issueDate.toISOString().slice(0, 10)}) status=${inv.status} --`);
    for (const li of inv.lineItems) {
      console.log(`   qty=${Number(li.quantity)}  unit=$${Number(li.unitAmount)}  line=$${Number(li.lineAmount).toFixed(2)}  | ${li.description}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
