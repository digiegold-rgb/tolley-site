/**
 * scripts/apply-jelly-tenancy-2026-08-15.ts
 *
 * ONE script that finishes the Jelly Studio multi-tenancy rollout against the
 * prod Neon database. Staged to /hq "Must Complete" because prod DB writes
 * are Jared's hands only (see memory: queue-janitor rules).
 *
 * Runs four steps, in order, all idempotent:
 *   1. MIGRATION  — apply prisma/migrations/20260815_vater_account/migration.sql
 *                   (creates VaterAccount, adds VaterPayment.userId + indexes;
 *                   every statement is IF NOT EXISTS, nothing is dropped)
 *   2. SEED       — VaterAccount rows: owner (digiegold@gmail.com) tier=owner
 *                   unmetered, Trey (tvater326@gmail.com) tier=studio unmetered
 *   3. PROJECTS   — assign the 208 legacy YouTubeProject rows with userId=NULL
 *                   to the owner, so NULL stops being a permission state
 *   4. PAYMENTS   — backfill VaterPayment.userId = Trey for the pre-tenancy row
 *
 * SAFE TO RUN TWICE: step 1 is IF NOT EXISTS, step 2 upserts, steps 3-4 match
 * only rows that are still NULL. A second run reports 0 changes.
 *
 * WHAT CHANGES FOR TREY: nothing he owes. His compute stays $108.79 and his
 * current due stays $68.27. His all-time ops fee drops $37.98 -> $33.20,
 * because 11 legacy April-2026 videos that were never his (13.66 min, $0.00
 * compute) stop being counted on his bill.
 *
 * Usage:
 *   cd ~/tolley-site && npx tsx scripts/apply-jelly-tenancy-2026-08-15.ts
 *   cd ~/tolley-site && npx tsx scripts/apply-jelly-tenancy-2026-08-15.ts --apply
 *
 * Default is a DRY RUN — it prints exactly what it would do and writes
 * nothing. Add --apply to commit.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { prisma } from "../lib/prisma";

const MIGRATION_SQL = path.join(
  __dirname,
  "..",
  "prisma",
  "migrations",
  "20260815_vater_account",
  "migration.sql",
);

const OWNER_EMAIL = "digiegold@gmail.com";
const OWNER_FALLBACK_EMAIL = "jared@yourkchomes.com";
const TREY_EMAIL = "tvater326@gmail.com";

const APPLY = process.argv.includes("--apply");
const tag = (s: string) => (APPLY ? s : `[dry-run] ${s}`);

function heading(n: number, title: string) {
  console.log(`\n${"=".repeat(66)}\nSTEP ${n} — ${title}\n${"=".repeat(66)}`);
}

async function findUser(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
}

/** Does VaterPayment.userId exist yet? Determines whether steps 4 can run. */
async function paymentUserIdExists(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'VaterPayment' AND column_name = 'userId'
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

async function vaterAccountExists(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'VaterAccount'
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

// ---------------------------------------------------------------- step 1
async function stepMigration() {
  heading(1, "Migration — VaterAccount + VaterPayment.userId");

  const before = {
    account: await vaterAccountExists(),
    paymentUserId: await paymentUserIdExists(),
  };
  console.log(
    `  current: VaterAccount table=${before.account}, VaterPayment.userId=${before.paymentUserId}`,
  );
  if (before.account && before.paymentUserId) {
    console.log("  already applied — nothing to do.");
    return;
  }

  const statements = readFileSync(MIGRATION_SQL, "utf8")
    .split(";")
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);

  for (const stmt of statements) {
    console.log(`  ${tag(stmt.replace(/\s+/g, " "))}`);
    if (APPLY) await prisma.$executeRawUnsafe(stmt);
  }

  if (APPLY) {
    console.log(
      `  now: VaterAccount table=${await vaterAccountExists()}, VaterPayment.userId=${await paymentUserIdExists()}`,
    );
  }
}

// ---------------------------------------------------------------- step 2
async function stepSeedAccounts(ownerId: string, treyId: string | null) {
  heading(2, "Seed VaterAccount rows");

  if (!APPLY && !(await vaterAccountExists())) {
    console.log(
      "  [dry-run] VaterAccount does not exist yet (step 1 would create it);\n" +
        "            would then upsert the two rows below.",
    );
  }

  const seeds = [
    {
      userId: ownerId,
      label: OWNER_EMAIL,
      tier: "owner",
      unmetered: true,
      notes: "owner account; sees all tenants, unmetered",
    },
    ...(treyId
      ? [
          {
            userId: treyId,
            label: TREY_EMAIL,
            tier: "studio",
            unmetered: true,
            notes: "founding beta tester; Zelle billing",
          },
        ]
      : []),
  ];

  for (const seed of seeds) {
    console.log(
      `  ${tag(`upsert ${seed.label} (${seed.userId}) -> tier=${seed.tier} unmetered=${seed.unmetered}`)}`,
    );
    if (!APPLY) continue;
    await prisma.vaterAccount.upsert({
      where: { userId: seed.userId },
      create: {
        userId: seed.userId,
        tier: seed.tier,
        unmetered: seed.unmetered,
        notes: seed.notes,
      },
      update: { tier: seed.tier, unmetered: seed.unmetered, notes: seed.notes },
    });
  }

  if (!treyId) {
    console.warn(`  ! no User row for ${TREY_EMAIL} — skipped his seed.`);
  }

  if (APPLY) {
    const rows = await prisma.vaterAccount.findMany({
      orderBy: { createdAt: "asc" },
    });
    console.log(`  VaterAccount now holds ${rows.length} row(s):`);
    for (const r of rows) {
      console.log(
        `    ${r.userId}  tier=${r.tier.padEnd(6)} unmetered=${r.unmetered}  ${r.notes ?? ""}`,
      );
    }
  }
}

// ---------------------------------------------------------------- step 3
async function stepAssignProjects(ownerId: string) {
  heading(3, "Assign legacy null-owner YouTubeProject rows to the owner");

  const orphans = await prisma.youTubeProject.count({ where: { userId: null } });
  const owned = await prisma.youTubeProject.count({
    where: { userId: ownerId },
  });
  console.log(`  userId=NULL: ${orphans}   already owner's: ${owned}`);

  if (orphans === 0) {
    console.log("  nothing to assign.");
    return;
  }

  const sample = await prisma.youTubeProject.findMany({
    where: { userId: null },
    select: { id: true, status: true, createdAt: true, topic: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
  for (const p of sample) {
    console.log(
      `    ${p.id}  ${p.status.padEnd(10)} ${p.createdAt.toISOString().slice(0, 10)}  ${(p.topic ?? "").slice(0, 50)}`,
    );
  }
  if (orphans > sample.length) {
    console.log(`    ... and ${orphans - sample.length} more`);
  }

  console.log(`  ${tag(`assign ${orphans} project(s) to ${ownerId}`)}`);
  if (APPLY) {
    const res = await prisma.youTubeProject.updateMany({
      where: { userId: null },
      data: { userId: ownerId },
    });
    console.log(`  assigned ${res.count}; remaining NULL: ${await prisma.youTubeProject.count({ where: { userId: null } })}`);
  }
}

// ---------------------------------------------------------------- step 4
async function stepBackfillPayments(treyId: string | null) {
  heading(4, "Backfill VaterPayment.userId");

  if (!(await paymentUserIdExists())) {
    console.log(
      APPLY
        ? "  ! column still missing after step 1 — skipping."
        : "  [dry-run] column does not exist yet (step 1 would add it);\n" +
            "            would then attribute all null-userId payments to Trey.",
    );
    if (!APPLY) {
      const total = await prisma.vaterPayment.count();
      console.log(`            VaterPayment currently holds ${total} row(s).`);
    }
    return;
  }

  if (!treyId) {
    console.warn(`  ! no User row for ${TREY_EMAIL} — cannot attribute.`);
    return;
  }

  const unattributed = await prisma.vaterPayment.count({
    where: { userId: null },
  });
  console.log(`  userId=NULL: ${unattributed}`);
  if (unattributed === 0) {
    console.log("  nothing to backfill.");
    return;
  }

  console.log(`  ${tag(`attribute ${unattributed} payment(s) to ${TREY_EMAIL} (${treyId})`)}`);
  if (APPLY) {
    const res = await prisma.vaterPayment.updateMany({
      where: { userId: null },
      data: { userId: treyId },
    });
    console.log(
      `  attributed ${res.count}; remaining NULL: ${await prisma.vaterPayment.count({ where: { userId: null } })}`,
    );
  }
}

// ---------------------------------------------------------------- main
async function main() {
  console.log(
    APPLY
      ? "MODE: APPLY — this writes to the database in DATABASE_URL\n"
      : "MODE: DRY RUN — nothing will be written. Re-run with --apply to commit.\n",
  );

  let owner = await findUser(OWNER_EMAIL);
  if (!owner) {
    console.warn(`! ${OWNER_EMAIL} has no User row — trying ${OWNER_FALLBACK_EMAIL}`);
    owner = await findUser(OWNER_FALLBACK_EMAIL);
  }
  if (!owner) {
    throw new Error(
      `No owner account (tried ${OWNER_EMAIL}, ${OWNER_FALLBACK_EMAIL}). Aborting.`,
    );
  }
  const trey = await findUser(TREY_EMAIL);

  console.log(`Owner : ${owner.email} -> ${owner.id}`);
  console.log(`Trey  : ${trey?.email ?? "NOT FOUND"} -> ${trey?.id ?? "-"}`);

  await stepMigration();
  await stepSeedAccounts(owner.id, trey?.id ?? null);
  await stepAssignProjects(owner.id);
  await stepBackfillPayments(trey?.id ?? null);

  console.log(
    APPLY
      ? "\nDone. Verify with: npx tsx scripts/verify-vater-billing-scope.ts"
      : "\nDry run complete. Re-run with --apply to commit.",
  );
}

main()
  .catch((err) => {
    console.error("\nFAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
