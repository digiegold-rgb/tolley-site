import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { CompanyError, cents } from "./policy";

export async function walletLock(tx: Prisma.TransactionClient, userId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"company-wallet:" + userId}, 0))`;
}
export async function reservedCents(userId: string, exceptId?: string, db: Prisma.TransactionClient = prisma) {
  // The feature flag is enabled only after the additive migration is verified.
  if (process.env.COMPANY_CREDITS_ENABLED !== "1") return 0;
  const rows = await db.companyReservation.aggregate({ where: { userId, state: "held", ...(exceptId ? { id: { not: exceptId } } : {}) }, _sum: { cents: true } });
  return rows._sum.cents || 0;
}
export async function holdCredit(tx: Prisma.TransactionClient, input: { id: string; userId: string; amount: number; available: number; purchasedOnly: boolean; projectId?: string; taskId?: string }) {
  let amount = cents(input.amount);
  const prior = await tx.companyReservation.findUnique({ where: { id: input.id } });
  if (prior && prior.userId !== input.userId) throw new CompanyError("reservation_conflict", 409);
  if (prior?.state === "held") amount = Math.max(amount, prior.cents);
  const additional = Math.max(0, amount - (prior?.state === "held" ? prior.cents : 0));
  if (additional > input.available) throw new CompanyError("insufficient_credits", 402);
  await tx.companyReservation.upsert({ where: { id: input.id }, create: { id: input.id, userId: input.userId, cents: amount, purchasedOnly: input.purchasedOnly, projectId: input.projectId, taskId: input.taskId }, update: { cents: amount, state: "held", purchasedOnly: input.purchasedOnly || prior?.purchasedOnly || false } });
}
export async function reserveProject(userId: string, projectId: string, amount: number, purchasedOnly: boolean) {
  if (process.env.COMPANY_CREDITS_ENABLED !== "1") return null;
  return prisma.$transaction(async tx => {
    await walletLock(tx, userId);
    const prior = await tx.companyReservation.findUnique({ where: { id: `project:${projectId}` } });
    if (prior?.taskId) {
      // A company quote is already funded. Studio estimates cannot enlarge it,
      // change its funding class, or reactivate a completed task's authority.
      if (prior.userId !== userId) throw new CompanyError("reservation_conflict", 409);
      return { allow: prior.state === "held", available: prior.state === "held" ? prior.cents : 0 };
    }
    const { getBalance } = await import("@/lib/vater/billing/ledger");
    const b = await getBalance(userId, tx);
    const available = purchasedOnly ? b.purchasedCents : b.balanceCents;
    if (!b.ready) throw new CompanyError("ledger_unavailable", 503);
    try {
      await holdCredit(tx, { id: `project:${projectId}`, userId, amount, available, purchasedOnly, projectId });
      return { allow: true, available };
    } catch (e) { if (e instanceof CompanyError && e.code === "insufficient_credits") return { allow: false, available }; throw e; }
  }, { timeout: 15000 });
}
export async function releaseProject(projectId: string) {
  if (process.env.COMPANY_CREDITS_ENABLED !== "1") return;
  await prisma.companyReservation.updateMany({ where: { projectId, state: "held" }, data: { state: "released" } });
}
