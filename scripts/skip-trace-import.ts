/**
 * scripts/skip-trace-import.ts
 *
 * Stage 2 of the PropStream skip-trace loop: ingest the results CSV that
 * PropStream produces after Jared runs the paid skip trace, and write the
 * phones/emails onto the Lead rows the export manifest points at.
 *
 * Matching order per row:
 *   1. a "Lead Id" column, if PropStream preserved our extra column
 *   2. normalized street address against the export manifest
 *
 * Column names are matched fuzzily because PropStream export headers vary
 * ("Phone 1", "Mobile Phone", "Landline 2", "Email1", ...). All phones found
 * on a row are recorded in the lead notes; the first one becomes ownerPhone.
 *
 * Idempotent: reruns skip leads that already carry a phone (use --overwrite
 * to replace). Probate lead scores are recomputed with hasPhone=true via the
 * same probateLeadScore used at promotion — no ad-hoc bumps.
 *
 * Usage:
 *   npx tsx scripts/skip-trace-import.ts <results.csv> [--manifest <path>] [--overwrite] [--dry]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { probateLeadScore, type ProbateScoreFactors } from "../lib/leads/probate-score";
// Reuse the exact normalizer the export used to build the manifest.
import { normalizeAddress } from "../lib/leads/skip-trace-shared";

const prisma = new PrismaClient();
const STAGED_DIR = "/home/jelly/business-os/staged/skip-trace";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const OVERWRITE = args.includes("--overwrite");
const csvPath = args.find((a) => !a.startsWith("--"));
const manifestArg = args.includes("--manifest") ? args[args.indexOf("--manifest") + 1] : null;

if (!csvPath) {
  console.error("Usage: npx tsx scripts/skip-trace-import.ts <results.csv> [--manifest <path>] [--overwrite] [--dry]");
  process.exit(1);
}
const resultsCsvPath: string = csvPath;

/** Minimal RFC-4180 CSV parser (quoted fields, embedded commas/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/** Digits-only → E.164 (+1XXXXXXXXXX) or null if not a US-shaped number. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

function latestManifest(): string {
  const files = readdirSync(STAGED_DIR)
    .filter((f) => f.endsWith(".manifest.json"))
    .sort();
  if (files.length === 0) throw new Error(`No manifest found in ${STAGED_DIR} — run skip-trace-export.ts first`);
  return join(STAGED_DIR, files[files.length - 1]);
}

interface ManifestRow {
  leadId: string;
  signalModel: "probate" | "distress";
  contactType: string;
  name: string;
  address: string;
  normAddress: string;
}

async function main() {
  const manifestPath = manifestArg ?? latestManifest();
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { rows: ManifestRow[] };
  const byLeadId = new Map<string, ManifestRow>(manifest.rows.map((r) => [r.leadId, r]));
  const byAddress = new Map<string, ManifestRow>(manifest.rows.map((r) => [r.normAddress, r]));
  console.log(`Manifest: ${manifestPath} (${manifest.rows.length} rows)`);

  const table = parseCsv(readFileSync(resultsCsvPath, "utf8"));
  if (table.length < 2) throw new Error("Results CSV has no data rows");
  const header = table[0].map((h) => h.trim());

  const findCols = (rx: RegExp, exclude?: RegExp) =>
    header
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => rx.test(h) && !(exclude && exclude.test(h)))
      .map(({ i }) => i);

  const leadIdCol = findCols(/lead.?id/i)[0] ?? null;
  // Prefer the property/street/site address; a mailing address matches nothing
  // in the manifest (heirs usually live elsewhere).
  const addressCols = [
    ...findCols(/(property|street|site).*address/i),
    ...findCols(/^address/i, /mail/i),
  ];
  const phoneCols = findCols(/phone|mobile|cell|landline/i, /type|dnc|carrier|score|status/i);
  const emailCols = findCols(/e-?mail/i, /type|status/i);

  console.log(
    `Columns — leadId: ${leadIdCol != null ? header[leadIdCol] : "(none)"}, ` +
      `address: ${addressCols.map((i) => header[i]).join("/") || "(none)"}, ` +
      `phones: ${phoneCols.map((i) => header[i]).join("/") || "(none)"}, ` +
      `emails: ${emailCols.map((i) => header[i]).join("/") || "(none)"}`,
  );
  if (phoneCols.length === 0) throw new Error("No phone columns recognized in results CSV — check the header row");

  let updated = 0;
  let skippedHasPhone = 0;
  let noHit = 0;
  const unmatched: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const row of table.slice(1)) {
    const cell = (i: number | null) => (i != null && row[i] != null ? row[i].trim() : "");

    // Match the row to a lead.
    let match: ManifestRow | undefined;
    if (leadIdCol != null && byLeadId.has(cell(leadIdCol))) match = byLeadId.get(cell(leadIdCol));
    if (!match) {
      for (const i of addressCols) {
        const addr = cell(i);
        if (addr && byAddress.has(normalizeAddress(addr))) {
          match = byAddress.get(normalizeAddress(addr));
          break;
        }
      }
    }
    if (!match) {
      unmatched.push(row.slice(0, 6).join(", "));
      continue;
    }

    const phones = [...new Set(phoneCols.map((i) => normalizePhone(cell(i))).filter((p): p is string => !!p))];
    const emails = [...new Set(emailCols.map((i) => cell(i)).filter((e) => /^\S+@\S+\.\S+$/.test(e)))];
    if (phones.length === 0 && emails.length === 0) {
      noHit++;
      continue;
    }

    const lead = await prisma.lead.findUnique({
      where: { id: match.leadId },
      select: { id: true, ownerPhone: true, ownerEmail: true, notes: true, scoreFactors: true },
    });
    if (!lead) {
      unmatched.push(`${match.leadId} (lead row deleted?)`);
      continue;
    }
    if (lead.ownerPhone && !OVERWRITE) {
      skippedHasPhone++;
      continue;
    }

    const noteLine =
      `Skip trace (PropStream ${today}, traced ${match.contactType} ${match.name}): ` +
      [phones.length ? `phones ${phones.join(", ")}` : null, emails.length ? `emails ${emails.join(", ")}` : null]
        .filter(Boolean)
        .join("; ");

    const data: Prisma.LeadUpdateInput = {
      ownerPhone: phones[0] ?? lead.ownerPhone,
      ownerEmail: lead.ownerEmail ?? emails[0] ?? undefined,
      notes: lead.notes ? `${lead.notes}\n${noteLine}` : noteLine,
    };

    // Recompute the probate score with the phone present — same function,
    // same factors, no invented bump.
    const factors = lead.scoreFactors as ProbateScoreFactors | null;
    if (phones.length > 0 && factors && factors.signal === "probate") {
      const next = { ...factors, hasPhone: true };
      data.score = probateLeadScore(next);
      data.scoreFactors = next;
    }

    console.log(`✓ ${match.name} @ ${match.address} → ${phones.join(", ") || "(no phone)"} ${emails.join(", ")}`);
    if (!DRY) await prisma.lead.update({ where: { id: lead.id }, data });
    updated++;
  }

  console.log(
    `\n${DRY ? "DRY RUN — nothing written. " : ""}` +
      `${updated} leads updated, ${skippedHasPhone} already had phones (use --overwrite), ` +
      `${noHit} rows returned no phone/email, ${unmatched.length} rows unmatched`,
  );
  for (const u of unmatched) console.log(`  unmatched: ${u}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
