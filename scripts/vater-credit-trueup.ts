/**
 * scripts/vater-credit-trueup.ts
 *
 * Bring already-issued credit debits back in line after a project's compute
 * cost was corrected.
 *
 * scripts/vater-cost-reconcile.mjs re-derives costJson.totalUsd every 20
 * minutes. When that number moves for a project the customer has ALREADY been
 * debited for, the debit is stale — this writes the signed 'adjust' row that
 * corrects it. It never edits the original debit (a ledger that rewrites its
 * own history can't be audited) and it re-applies the repair cap, so a
 * true-up can't push a charge past REPAIR_CAP_MULTIPLE x the estimate.
 *
 * Called automatically by the reconciler; also runnable by hand:
 *   npx tsx scripts/vater-credit-trueup.ts --all
 *   npx tsx scripts/vater-credit-trueup.ts --projects <id>,<id> --apply
 *
 * DEFAULT IS A DRY RUN. --apply commits.
 */

import { prisma } from "../lib/prisma";
import {
  adjustProjectDebit,
  buildDebitLine,
  getProjectDebit,
} from "../lib/vater/billing/ledger";
import { hasVaterCreditLedgerTable } from "../lib/vater/schema-probe";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const ALL = argv.includes("--all");
const arg = (flag: string): string | undefined => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

/** Only write an adjust when the charge is off by more than this. */
const THRESHOLD_USD = 0.05;

async function main() {
  // Probe BEFORE any query. The ledger helpers guard themselves, but --all
  // reads the table directly, and an unmigrated database should print a
  // sentence rather than a P2021 stack trace — this runs from a cron.
  if (!(await hasVaterCreditLedgerTable())) {
    console.log(
      "VaterCreditLedger does not exist in this database yet — nothing to true up.\n" +
        "Apply it with: npx tsx scripts/apply-jelly-tenancy-2026-08-15.ts --apply",
    );
    return;
  }

  let projectIds: string[] = (arg("--projects") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ALL || projectIds.length === 0) {
    if (!ALL) {
      console.log("No --projects given and no --all — nothing to do.");
      return;
    }
    const rows = await prisma.vaterCreditLedger.findMany({
      where: { kind: "debit" },
      select: { projectId: true },
    });
    projectIds = rows
      .map((r) => r.projectId)
      .filter((id): id is string => !!id);
  }

  console.log(
    `${APPLY ? "APPLY" : "DRY RUN"} — checking ${projectIds.length} debited project(s)\n`,
  );

  let moved = 0;
  for (const projectId of projectIds) {
    const debit = await getProjectDebit(projectId);
    if (!debit) continue;

    if (!APPLY) {
      // Same arithmetic as adjustProjectDebit, without the write.
      const project = await prisma.youTubeProject.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          userId: true,
          status: true,
          finalVideoUrl: true,
          audioDuration: true,
          targetDuration: true,
          costJson: true,
          publishTitle: true,
          sourceTitle: true,
        },
      });
      if (!project) continue;
      const { line, chargeUsd } = buildDebitLine(project);
      const priorRows = await prisma.vaterCreditLedger.findMany({
        where: { projectId, kind: { in: ["debit", "adjust"] } },
        select: { deltaCents: true },
      });
      const chargedCents = priorRows.reduce((a, r) => a - r.deltaCents, 0);
      const targetCents = Math.round(chargeUsd * 100);
      const delta = targetCents - chargedCents;
      if (Math.abs(delta) < Math.round(THRESHOLD_USD * 100)) continue;
      moved++;
      console.log(
        `  [dry-run] ${projectId}  $${(chargedCents / 100).toFixed(2)} -> $${(targetCents / 100).toFixed(2)}` +
          `  (cost $${line.totalUsd.toFixed(2)}, est $${line.estimateUsd.toFixed(2)}${line.cappedAt ? ", REPAIR-CAPPED" : ""})`,
      );
      continue;
    }

    const res = await adjustProjectDebit(projectId, { thresholdUsd: THRESHOLD_USD });
    if (res.adjusted) {
      moved++;
      console.log(
        `  ${projectId}  $${res.fromUsd?.toFixed(2)} -> $${res.toUsd?.toFixed(2)}`,
      );
    } else if (res.reason === "not_ready") {
      console.log("  ledger table not migrated yet — nothing to true up.");
      break;
    }
  }

  console.log(
    moved
      ? `\n${moved} debit(s) ${APPLY ? "adjusted" : "would be adjusted"}.`
      : "\nAll credit debits already match their project costs.",
  );
}

main()
  .catch((err) => {
    console.error("FAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
