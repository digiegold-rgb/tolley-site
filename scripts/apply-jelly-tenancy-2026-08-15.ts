/**
 * scripts/apply-jelly-tenancy-2026-08-15.ts
 *
 * ONE script that finishes the Jelly Studio multi-tenancy rollout against the
 * prod Neon database. Staged to /hq "Must Complete" because prod DB writes
 * are Jared's hands only (see memory: queue-janitor rules).
 *
 * Runs six steps, in order, all idempotent:
 *   1. MIGRATION  — apply prisma/migrations/20260815_vater_account/migration.sql
 *                   (creates VaterAccount, adds VaterPayment.userId + indexes;
 *                   every statement is IF NOT EXISTS, nothing is dropped)
 *   2. SEED       — VaterAccount rows: owner (digiegold@gmail.com) tier=owner
 *                   unmetered, Trey (tvater326@gmail.com) tier=studio unmetered
 *   3. PROJECTS   — assign the 208 legacy YouTubeProject rows with userId=NULL
 *                   to the owner, so NULL stops being a permission state
 *   4. PAYMENTS   — backfill VaterPayment.userId = Trey for the pre-tenancy row
 *   5. BETA       — apply prisma/migrations/20260815_beta_invites/migration.sql
 *                   (BetaInvite, AdminImpersonation, VaterEvent + two User
 *                   columns; all IF NOT EXISTS, nothing dropped)
 *   8. API+TEAMS  — apply prisma/migrations/20260816_api_keys_orgs/migration.sql
 *                   (VaterApiKey, VaterOrg, VaterOrgMember, BetaInvite.orgId;
 *                   IF NOT EXISTS throughout, creates tables, drops nothing)
 *   6. CREDITS    — apply prisma/migrations/20260815_vater_credit_ledger/
 *                   migration.sql (creates VaterCreditLedger: the prepaid
 *                   credit ledger + its unique idempotency indexes). Also
 *                   IF NOT EXISTS throughout; creates a table, touches none.
 *
 * SAFE TO RUN TWICE: the migration steps are IF NOT EXISTS, step 2 upserts, steps
 * 3-4 match only rows that are still NULL. A second run reports 0 changes.
 *
 * UNTIL THE CREDITS STEP RUNS, prepaid credits are simply dormant: /animate reports the
 * balance as "not ready" and the budget gate falls back to the pre-credits
 * rules, so nothing is blocked and nothing is billed. Nobody can buy a credit
 * pack that will not be recorded, because the Billing screen hides the pack
 * buttons while the ledger is unavailable.
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
import { splitSqlStatements } from "./lib/sql-statements";

const MIGRATION_SQL = path.join(
  __dirname,
  "..",
  "prisma",
  "migrations",
  "20260815_vater_account",
  "migration.sql",
);

const CREDIT_LEDGER_SQL = path.join(
  __dirname,
  "..",
  "prisma",
  "migrations",
  "20260815_vater_credit_ledger",
  "migration.sql",
);

/**
 * Phase 3 (invites / password reset / view-as / system log), 2026-08-15.
 * Appended as STEP 5 rather than a second script: both migrations are staged
 * to the same /hq item, both are IF NOT EXISTS, and running one without the
 * other leaves /animate half-built.
 */
const BETA_MIGRATION_SQL = path.join(
  __dirname,
  "..",
  "prisma",
  "migrations",
  "20260815_beta_invites",
  "migration.sql",
);

/**
 * Public API v1 + team seats (2026-08-16). Appended as STEP 8 rather than a
 * new script for the same reason steps 5-6 were: one /hq item, one command,
 * and a half-applied /animate is worse than a not-yet-applied one.
 *
 * Every statement is IF NOT EXISTS and nothing is dropped, so it is safe to
 * run against a live database and safe to run twice.
 *
 * What stays dormant until it runs (all degrade, none 500):
 *   - /animate "API Keys" + "Team" report FEATURE_NOT_READY (503)
 *   - /api/v1/* returns 503 "not_ready" rather than a misleading 401
 *   - project visibility is unchanged: owner-only, exactly as today
 */
const API_ORGS_SQL = path.join(
  __dirname,
  "..",
  "prisma",
  "migrations",
  "20260816_api_keys_orgs",
  "migration.sql",
);

const OWNER_EMAIL = "digiegold@gmail.com";
const OWNER_FALLBACK_EMAIL = "jared@yourkchomes.com";
const TREY_EMAIL = "tvater326@gmail.com";

const APPLY = process.argv.includes("--apply");
const tag = (s: string) => (APPLY ? s : `[dry-run] ${s}`);

/**
 * Split a migration file into executable statements.
 *
 * 🔴 THIS FEEDS $executeRawUnsafe AGAINST THE PRODUCTION DATABASE. Anything
 * this function mistakes for SQL gets run. A naive split has bitten us twice
 * already, so it is a real scanner rather than a chain of string ops:
 *
 *   1. `.split(";")` BEFORE stripping comments cut a `--` comment in half and
 *      the tail survived as a "statement" — the credit-ledger migration's
 *      "no cached balance column" was printed as SQL (fixed 2026-08-15).
 *   2. Stripping only comments that START a line leaves a trailing `-- note;`
 *      after real SQL intact, which reintroduces (1) on the next semicolon.
 *   3. `/* *​/` block comments were not handled AT ALL — prose inside one went
 *      straight through as a statement.
 *   4. A `DO $$ … END IF; … $$;` block was shredded on the semicolons INSIDE
 *      its body. This one survived fix (1): verified against the repo's 60
 *      migrations, `20260704_launchpad_platform` and `20260705_regular_runs`
 *      still emitted a bare `END IF` as a statement afterwards.
 *
 * The scanner walks the file once, tracking whether it is inside a string
 * literal, a quoted identifier, or a dollar-quoted body, and only treats
 * `--`, `/* *​/` and `;` as syntax when it is not. That also means a semicolon
 * inside a string ('a;b') no longer splits a statement in half.
 *
 * Comments are replaced with whitespace rather than deleted so tokens on
 * either side can never be glued together.
 */
function sqlStatements(file: string): string[] {
  return splitSqlStatements(readFileSync(file, "utf8"));
}

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

/** Generic table probe — shared by the Phase 3 and credit-ledger steps. */
async function tableExists(table: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = ${table}
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

/** Generic column probe — used by the Phase 3 step. */
async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ${table} AND column_name = ${column}
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

  const statements = sqlStatements(MIGRATION_SQL);

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

// ---------------------------------------------------------------- step 6
/**
 * Prepaid credit ledger (Phase 2 of the beta launch).
 *
 * Creates ONE table. The unique indexes are the point of it: they are what
 * make a duplicated Stripe webhook, a re-poll of a finished render, or a
 * re-sent invite unable to double-credit or double-charge anyone.
 *
 * Nothing is written into it here. Balances start empty, starter grants are
 * handed out by the invite flow, and the first debit happens the next time a
 * metered user's video finishes.
 */
async function stepCreditLedger() {
  heading(6, "Migration — VaterCreditLedger (prepaid credits)");

  if (await tableExists("VaterCreditLedger")) {
    console.log("  already applied — nothing to do.");
    return;
  }

  for (const stmt of sqlStatements(CREDIT_LEDGER_SQL)) {
    console.log(`  ${tag(stmt.replace(/\s+/g, " "))}`);
    if (APPLY) await prisma.$executeRawUnsafe(stmt);
  }

  if (APPLY) {
    console.log(
      `  now: VaterCreditLedger table=${await tableExists("VaterCreditLedger")}`,
    );
  }
}

// ---------------------------------------------------------------- main
// ---------------------------------------------------------------- step 5
/**
 * Phase 3 schema: BetaInvite, AdminImpersonation, VaterEvent, plus
 * User.betaInviteId / User.sessionVersion.
 *
 * Every statement is IF NOT EXISTS and nothing is dropped or rewritten, so
 * this is safe to run against a live database and safe to run twice.
 *
 * What stays broken until it runs (all degrade, none 500):
 *   - invite gate is OPEN — /animate signup accepts anyone
 *   - password reset works but does NOT sign other devices out
 *   - System Log shows project status only, no event history
 *   - /hq "Studio users" can't mint invites
 */
async function stepBetaMigration() {
  heading(5, "Migration — beta invites, impersonation audit, system log");

  const before = {
    invite: await tableExists("BetaInvite"),
    event: await tableExists("VaterEvent"),
    impersonation: await tableExists("AdminImpersonation"),
    sessionVersion: await columnExists("User", "sessionVersion"),
    betaInviteId: await columnExists("User", "betaInviteId"),
  };
  console.log(
    `  current: BetaInvite=${before.invite}, VaterEvent=${before.event}, ` +
      `AdminImpersonation=${before.impersonation}, ` +
      `User.sessionVersion=${before.sessionVersion}, User.betaInviteId=${before.betaInviteId}`,
  );
  if (Object.values(before).every(Boolean)) {
    console.log("  already applied — nothing to do.");
    return;
  }

  for (const stmt of sqlStatements(BETA_MIGRATION_SQL)) {
    console.log(`  ${tag(stmt.replace(/\s+/g, " "))}`);
    if (APPLY) await prisma.$executeRawUnsafe(stmt);
  }

  if (APPLY) {
    console.log(
      `  now: BetaInvite=${await tableExists("BetaInvite")}, ` +
        `VaterEvent=${await tableExists("VaterEvent")}, ` +
        `AdminImpersonation=${await tableExists("AdminImpersonation")}, ` +
        `User.sessionVersion=${await columnExists("User", "sessionVersion")}, ` +
        `User.betaInviteId=${await columnExists("User", "betaInviteId")}`,
    );
  }
}

// ---------------------------------------------------------------- step 7
// Flip every non-owner YouTubeStyle row to Modal backends (firered-modal +
// indextts-modal). The site already FORCES Modal for non-owner sessions in
// code (context route), so this only makes the stored rows honest. Delegates to
// the dedicated, idempotent script so there is exactly one implementation.
async function stepStylesModal() {
  heading(7, "Styles → Modal backends (migrate-styles-modal.ts)");
  const { spawnSync } = await import("node:child_process");
  const args = ["tsx", "scripts/migrate-styles-modal.ts", APPLY ? "--apply" : "--dry-run"];
  const r = spawnSync("npx", args, { stdio: "inherit", cwd: path.join(__dirname, "..") });
  if (r.status !== 0) throw new Error(`migrate-styles-modal exited ${r.status}`);
}

// ---------------------------------------------------------------- step 8
async function stepApiKeysOrgs() {
  heading(8, "Migration — VaterApiKey, VaterOrg, VaterOrgMember, BetaInvite.orgId");

  const before = {
    apiKey: await tableExists("VaterApiKey"),
    org: await tableExists("VaterOrg"),
    member: await tableExists("VaterOrgMember"),
    inviteOrgId: await columnExists("BetaInvite", "orgId"),
  };
  console.log(
    `  current: VaterApiKey=${before.apiKey}, VaterOrg=${before.org}, ` +
      `VaterOrgMember=${before.member}, BetaInvite.orgId=${before.inviteOrgId}`,
  );
  if (Object.values(before).every(Boolean)) {
    console.log("  already applied — nothing to do.");
    return;
  }

  for (const stmt of sqlStatements(API_ORGS_SQL)) {
    console.log(`  ${tag(stmt.replace(/\s+/g, " "))}`);
    if (APPLY) await prisma.$executeRawUnsafe(stmt);
  }

  if (APPLY) {
    console.log(
      `  now: VaterApiKey=${await tableExists("VaterApiKey")}, ` +
        `VaterOrg=${await tableExists("VaterOrg")}, ` +
        `VaterOrgMember=${await tableExists("VaterOrgMember")}, ` +
        `BetaInvite.orgId=${await columnExists("BetaInvite", "orgId")}`,
    );
  }
}

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
  await stepBetaMigration();
  await stepCreditLedger();
  await stepStylesModal();
  await stepApiKeysOrgs();

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
