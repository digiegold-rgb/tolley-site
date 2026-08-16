/**
 * scripts/verify-vater-billing-scope.ts
 *
 * Before/after check for the 2026-08-15 per-tenant billing scoping.
 *
 * Replicates the getVaterBillingSummary math twice over the SAME live data —
 * once unscoped (the old behaviour) and once filtered to one userId (the new
 * behaviour) — so the effect of scoping can be read off directly without
 * needing the migration applied first. Payments are read with raw SQL so this
 * runs both before and after VaterPayment.userId exists.
 *
 * Read-only. Usage:
 *   npx tsx scripts/verify-vater-billing-scope.ts
 *   npx tsx scripts/verify-vater-billing-scope.ts --user cmnzgxvoy0000l4r6fyuatyku
 */

import { prisma } from "../lib/prisma";
import { getOpsRate } from "../lib/vater/billing/ops-fee";

const TREY_USER_ID = "cmnzgxvoy0000l4r6fyuatyku";

const r2 = (n: number) => Math.round(n * 100) / 100;

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

interface Row {
  userId: string | null;
  status: string;
  finalVideoUrl: string | null;
  audioDuration: number | null;
  costJson: unknown;
  updatedAt: Date;
  completedAt: Date | null;
}

function compute(rows: Row[], opsRate: number, paidUsd: number, settledUpTo: Date) {
  const finished = rows.filter(
    (p) => p.status === "ready" && p.finalVideoUrl !== null,
  );
  const cardUsd = (p: Row) =>
    Number((p.costJson as { totalUsd?: number } | null)?.totalUsd ?? 0);
  const mins = (p: Row) => Math.max(0, Number(p.audioDuration ?? 0)) / 60;
  const deliveredAt = (p: Row) => p.completedAt ?? p.updatedAt;

  const minutes = finished.reduce((a, p) => a + mins(p), 0);
  const computeUsd = r2(finished.reduce((a, p) => a + cardUsd(p), 0));
  const opsUsd = r2(minutes * opsRate);

  const since = finished.filter((p) => deliveredAt(p) > settledUpTo);
  const minutesSince = since.reduce((a, p) => a + mins(p), 0);
  const dueUsd = r2(
    since.reduce((a, p) => a + cardUsd(p), 0) + minutesSince * opsRate,
  );

  return {
    videos: finished.length,
    minutes: r2(minutes),
    computeUsd,
    opsUsd,
    paidUsd: r2(paidUsd),
    dueUsd,
    totalUsd: r2(paidUsd + dueUsd),
  };
}

function print(label: string, s: ReturnType<typeof compute>) {
  console.log(`\n${label}`);
  console.log(`  videos      ${s.videos}`);
  console.log(`  minutes     ${s.minutes}`);
  console.log(`  computeUsd  $${s.computeUsd.toFixed(2)}`);
  console.log(`  opsUsd      $${s.opsUsd.toFixed(2)}`);
  console.log(`  paidUsd     $${s.paidUsd.toFixed(2)}`);
  console.log(`  dueUsd      $${s.dueUsd.toFixed(2)}`);
  console.log(`  totalUsd    $${s.totalUsd.toFixed(2)}   (paid + due)`);
}

async function main() {
  const userId = getArg("--user") ?? TREY_USER_ID;
  const opsRate = getOpsRate();

  const rows = (await prisma.youTubeProject.findMany({
    select: {
      userId: true,
      status: true,
      finalVideoUrl: true,
      audioDuration: true,
      costJson: true,
      updatedAt: true,
      completedAt: true,
    },
  })) as Row[];

  // Raw SQL: works whether or not the userId column exists yet.
  const payments = await prisma.$queryRawUnsafe<
    { amountUsd: number; createdAt: Date }[]
  >(`SELECT "amountUsd", "createdAt" FROM "VaterPayment" ORDER BY "createdAt" DESC`);

  const paidAll = payments.reduce((a, p) => a + Number(p.amountUsd), 0);
  const settledUpTo = payments[0]?.createdAt ?? new Date(0);

  console.log(`opsRatePerMinute  $${opsRate}`);
  console.log(`tenant            ${userId}`);
  console.log(`payments          ${payments.length} totalling $${r2(paidAll).toFixed(2)}`);
  console.log(`last payment      ${settledUpTo.toISOString()}`);

  const before = compute(rows, opsRate, paidAll, settledUpTo);
  const after = compute(
    rows.filter((p) => p.userId === userId),
    opsRate,
    paidAll,
    settledUpTo,
  );

  print("BEFORE (unscoped — every tenant's projects)", before);
  print("AFTER  (scoped to tenant)", after);

  console.log("\nDELTA");
  for (const key of ["videos", "minutes", "computeUsd", "opsUsd", "dueUsd", "totalUsd"] as const) {
    const d = r2(after[key] - before[key]);
    console.log(`  ${key.padEnd(11)} ${d >= 0 ? "+" : ""}${d}`);
  }

  const foreign = rows.filter(
    (p) =>
      p.userId !== userId && p.status === "ready" && p.finalVideoUrl !== null,
  );
  const foreignMin = foreign.reduce(
    (a, p) => a + Math.max(0, Number(p.audioDuration ?? 0)) / 60,
    0,
  );
  const foreignCompute = foreign.reduce(
    (a, p) => a + Number((p.costJson as { totalUsd?: number } | null)?.totalUsd ?? 0),
    0,
  );
  console.log(
    `\nRemoved from this tenant's bill: ${foreign.length} finished project(s) not theirs,` +
      ` ${r2(foreignMin)} min, $${r2(foreignCompute).toFixed(2)} compute,` +
      ` $${r2(foreignMin * opsRate).toFixed(2)} ops`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
