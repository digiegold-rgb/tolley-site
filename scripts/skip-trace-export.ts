/**
 * scripts/skip-trace-export.ts
 *
 * Stage 1 of the PropStream skip-trace loop (BACKLOG 2026-07-26).
 *
 * Emits a PropStream-ready CSV of every probate/distress lead that has an
 * address but no ownerPhone, plus a manifest JSON that the import script uses
 * to match PropStream's results back to Lead rows (by Lead Id column when
 * PropStream preserves it, by normalized street address when it doesn't).
 *
 * PropStream has no public API and skip tracing is billed per matched record,
 * so the paid step is Jared's: upload the CSV in PropStream → Skip Tracing,
 * download the results, then run scripts/skip-trace-import.ts on them.
 * Nothing here spends money or contacts anyone.
 *
 * Usage: npx tsx scripts/skip-trace-export.ts
 * Output: ~/business-os/staged/skip-trace/skip-trace-<date>.csv + manifest
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { isPersonName } from "../lib/leads/heir-name";
import { normalizeAddress, splitName, streetLine } from "../lib/leads/skip-trace-shared";

const prisma = new PrismaClient();
const OUT_DIR = "/home/jelly/business-os/staged/skip-trace";

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

interface ManifestRow {
  leadId: string;
  signalId: string;
  signalModel: "probate" | "distress";
  contactType: "heir" | "decedent" | "owner";
  name: string;
  address: string;
  normAddress: string;
}

async function main() {
  const rows: string[][] = [];
  const manifest: ManifestRow[] = [];

  // ── Probate: promoted signals whose lead still has no phone ──
  const probate = await prisma.probateSignal.findMany({
    where: { leadId: { not: null }, matchedAddress: { not: null } },
    select: {
      id: true,
      leadId: true,
      decedentName: true,
      heirsJson: true,
      matchedAddress: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  for (const signal of probate) {
    const lead = await prisma.lead.findUnique({
      where: { id: signal.leadId! },
      select: { id: true, ownerPhone: true, ownerName: true },
    });
    if (!lead || lead.ownerPhone) continue;

    // Trace the heir when we have a real person, else the owner of record
    // (the decedent — PropStream returns household/relative phones too).
    const heirs = Array.isArray(signal.heirsJson)
      ? (signal.heirsJson as { name?: string }[])
      : [];
    const heir = heirs.map((h) => h?.name).find((n) => isPersonName(n));
    const traceName = heir ?? signal.decedentName;
    const { first, last } = splitName(traceName);
    if (!first || !last) continue;

    const address = signal.matchedAddress!;
    rows.push([
      lead.id,
      first,
      last,
      streetLine(address),
      signal.city ?? "",
      signal.state ?? "MO",
      signal.zip ?? "",
    ]);
    manifest.push({
      leadId: lead.id,
      signalId: signal.id,
      signalModel: "probate",
      contactType: heir ? "heir" : "decedent",
      name: traceName,
      address,
      normAddress: normalizeAddress(address),
    });
  }

  // ── Distress: promoted signals with an owner guess and address ──
  const distress = await prisma.distressSignal.findMany({
    where: { leadId: { not: null }, addressGuess: { not: null }, ownerGuess: { not: null } },
    select: { id: true, leadId: true, ownerGuess: true, addressGuess: true, city: true, state: true },
  });
  for (const signal of distress) {
    const lead = await prisma.lead.findUnique({
      where: { id: signal.leadId! },
      select: { id: true, ownerPhone: true },
    });
    if (!lead || lead.ownerPhone) continue;
    if (!isPersonName(signal.ownerGuess)) continue;
    const { first, last } = splitName(signal.ownerGuess!);
    if (!first || !last) continue;
    const address = signal.addressGuess!;
    rows.push([lead.id, first, last, streetLine(address), signal.city ?? "", signal.state ?? "MO", ""]);
    manifest.push({
      leadId: lead.id,
      signalId: signal.id,
      signalModel: "distress",
      contactType: "owner",
      name: signal.ownerGuess!,
      address,
      normAddress: normalizeAddress(address),
    });
  }

  if (rows.length === 0) {
    console.log("Nothing to export — every eligible lead already has a phone.");
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  mkdirSync(OUT_DIR, { recursive: true });
  const csvPath = join(OUT_DIR, `skip-trace-${date}.csv`);
  const manifestPath = join(OUT_DIR, `skip-trace-${date}.manifest.json`);

  const header = ["Lead Id", "First Name", "Last Name", "Property Address", "Property City", "Property State", "Property Zip"];
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
  writeFileSync(csvPath, csv);
  writeFileSync(manifestPath, JSON.stringify({ exportedAt: new Date().toISOString(), rows: manifest }, null, 2));

  console.log(`Exported ${rows.length} leads (${manifest.filter((m) => m.signalModel === "probate").length} probate, ${manifest.filter((m) => m.signalModel === "distress").length} distress)`);
  console.log(`CSV:      ${csvPath}`);
  console.log(`Manifest: ${manifestPath}`);
  for (const m of manifest) console.log(`  - [${m.contactType}] ${m.name} @ ${m.address}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
