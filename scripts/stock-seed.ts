import { readFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { opportunityInput } from "../lib/stock/core";
import { parseManifest } from "../lib/stock/imports";
async function main() {
  const file = process.argv[2];
  if (!file)
    throw new Error(
      "Provide a JSON array of verified observations; optional manifestFile is a local CSV/XLSX path",
    );
  const entries = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(entries)) throw new Error("Expected an observation array");
  for (const entry of entries) {
    const input = opportunityInput.parse(entry);
    const data = {
      ...input,
      observedAt: new Date(input.observedAt || Date.now()),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      ...(entry.manifestFile
        ? { manifest: parseManifest(readFileSync(entry.manifestFile)) }
        : {}),
    };
    await prisma.stockOpportunity.upsert({
      where: { sourceUrl: input.sourceUrl },
      create: data,
      update: {},
    });
    console.log("Seeded observation:", input.title);
  }
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
