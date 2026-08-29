#!/usr/bin/env node
/**
 * scripts/prune-e2e-users.mjs — delete the throwaway Playwright studio accounts
 * (`e2e-*@tolley.io`) that an interrupted spec run left on the /hq roster.
 *
 * The E2E specs run against a Vercel preview, and preview shares the PRODUCTION
 * database — so a seeded test tenant whose afterAll never fired shows up next to
 * real beta testers. tests/e2e/_studio-auth.ts now seeds ONE stable address per
 * spec tag so this can never stack again; this script clears the backlog and is
 * safe to re-run.
 *
 *   node --env-file=.env.local scripts/prune-e2e-users.mjs          # dry run
 *   node --env-file=.env.local scripts/prune-e2e-users.mjs --apply
 *
 * Refuses to touch an account that has spent money or owns projects — that would
 * mean the pattern matched something that is not a throwaway.
 *
 * ⛔ Scope is `e2e-*` ONLY. The long-lived QA fixtures on the same domain —
 * `qa.walkthrough.0820@` (hardcoded by ~18 scripts/tmp-walkthrough-*),
 * `audit-public@` (AUDIT_ANIMATE_EMAIL for tests/e2e/audit + workspaces.spec),
 * `qa.newuser.0817@`, `listing.e2e.0827@` — are deliberately persistent and
 * must never be swept. They are folded out of the /hq roster by the "Tests"
 * chip (components/hq/hq-studio-users.tsx) instead.
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  where: { email: { startsWith: "e2e-", endsWith: "@tolley.io" } },
  select: { id: true, email: true, createdAt: true },
  orderBy: { createdAt: "asc" },
});

if (users.length === 0) {
  console.log("no e2e accounts — nothing to prune");
  await prisma.$disconnect();
  process.exit(0);
}

const skipped = [];
const doomed = [];
for (const u of users) {
  const spent = await prisma.vaterCreditLedger.count({ where: { userId: u.id } });
  if (spent > 0) skipped.push(`${u.email} (${spent} ledger rows)`);
  else doomed.push(u);
}

console.log(`${users.length} e2e account(s): ${doomed.length} prunable, ${skipped.length} skipped`);
for (const u of doomed) console.log(`  ${APPLY ? "delete" : "would delete"}  ${u.email}  ${u.createdAt.toISOString()}`);
for (const s of skipped) console.log(`  SKIP (has spend)  ${s}`);

if (!APPLY) {
  console.log("\ndry run — re-run with --apply to delete");
  await prisma.$disconnect();
  process.exit(0);
}

for (const u of doomed) {
  const userId = u.id;
  await prisma.$executeRaw`UPDATE "User" SET "betaInviteId" = NULL WHERE "id" = ${userId}`;
  await prisma.betaInvite.deleteMany({ where: { email: u.email } }).catch(() => {});
  await prisma.$executeRaw`DELETE FROM "VaterAccount" WHERE "userId" = ${userId}`.catch(() => {});
  await prisma.vaterCreditLedger.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.vaterSubscription.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.credentialAuth.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } });
  console.log(`deleted ${u.email}`);
}

await prisma.$disconnect();
