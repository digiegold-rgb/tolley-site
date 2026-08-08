/**
 * scripts/probate-lead-repair.ts
 *
 * One-time repair for promoted probate leads (BACKLOG 2026-07-26):
 *   1. ownerName holding a relationship phrase ("her four children") is
 *      replaced with a salvaged heir name when one exists, else the decedent.
 *   2. Signal heirsJson entries are re-validated: phrases are salvaged into
 *      real names or dropped; the cleaned list is written back.
 *   3. Lead.score is recomputed per-lead via probateLeadScore, replacing the
 *      flat 70 that made ranking impossible.
 *
 * Idempotent — reruns converge to the same state. Pass --dry to preview.
 *
 * Usage: npx tsx scripts/probate-lead-repair.ts [--dry]
 */
import { PrismaClient } from "@prisma/client";
import { isPersonName, salvageHeirName } from "../lib/leads/heir-name";
import { probateLeadScore, type ProbateScoreFactors } from "../lib/leads/probate-score";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

async function main() {
  const signals = await prisma.probateSignal.findMany({
    where: { leadId: { not: null } },
    select: {
      id: true,
      leadId: true,
      decedentName: true,
      heirsJson: true,
      matchedAddress: true,
      estimatedValue: true,
      obitDate: true,
      createdAt: true,
    },
  });
  console.log(`${signals.length} promoted probate signals`);

  for (const signal of signals) {
    const rawHeirs = Array.isArray(signal.heirsJson)
      ? (signal.heirsJson as { name?: string; relationship?: string | null; source?: string }[])
      : [];

    // Clean the heir list: keep valid names, salvage phrases, drop the rest.
    const cleaned: { name: string; relationship: string | null; source: string }[] = [];
    for (const heir of rawHeirs) {
      if (!heir?.name) continue;
      if (isPersonName(heir.name)) {
        cleaned.push({
          name: heir.name,
          relationship: heir.relationship ?? null,
          source: heir.source ?? "unknown",
        });
        continue;
      }
      const salvaged = salvageHeirName(heir.name, signal.decedentName);
      if (salvaged) {
        cleaned.push({
          name: salvaged.name,
          relationship: salvaged.relationship,
          source: heir.source ?? "unknown",
        });
      }
    }

    const lead = await prisma.lead.findUnique({
      where: { id: signal.leadId! },
      select: { id: true, ownerName: true, ownerPhone: true, score: true },
    });
    if (!lead) {
      console.warn(`  !! lead ${signal.leadId} missing for signal ${signal.id}`);
      continue;
    }

    const heirContact = cleaned[0]?.name ?? null;
    const newOwnerName =
      isPersonName(lead.ownerName) && lead.ownerName !== signal.decedentName
        ? lead.ownerName // already a person (possibly hand-corrected) — keep
        : heirContact ?? signal.decedentName;

    const signalDate = signal.obitDate ?? signal.createdAt;
    const factors: ProbateScoreFactors = {
      signal: "probate",
      hasAddress: Boolean(signal.matchedAddress),
      hasHeirContact: heirContact != null,
      hasPhone: Boolean(lead.ownerPhone),
      estimatedValue: signal.estimatedValue ?? null,
      signalAgeDays: Math.max(
        0,
        Math.round((Date.now() - signalDate.getTime()) / 86_400_000),
      ),
    };
    const newScore = probateLeadScore(factors);

    const heirsBefore = rawHeirs.map((h) => h?.name).join(" | ") || "(none)";
    const heirsAfter = cleaned.map((h) => h.name).join(" | ") || "(none)";
    console.log(
      `- ${signal.decedentName}\n` +
        `    heirs:  ${heirsBefore}  →  ${heirsAfter}\n` +
        `    owner:  ${lead.ownerName ?? "(null)"}  →  ${newOwnerName}\n` +
        `    score:  ${lead.score}  →  ${newScore}`,
    );

    if (DRY) continue;
    await prisma.probateSignal.update({
      where: { id: signal.id },
      data: { heirsJson: cleaned },
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { ownerName: newOwnerName, score: newScore, scoreFactors: factors },
    });
  }

  console.log(DRY ? "\nDRY RUN — nothing written" : "\nRepair complete");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
