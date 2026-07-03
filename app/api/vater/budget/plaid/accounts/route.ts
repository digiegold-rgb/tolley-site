import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const accounts = await prisma.budgetPlaidAccount.findMany({
    where: { userId: auth.session.userId },
    orderBy: [{ isPersonal: "desc" }, { name: "asc" }],
  });

  const counts = await prisma.budgetEntry.groupBy({
    by: ["plaidAccount"],
    where: {
      userId: auth.session.userId,
      plaidAccount: { in: accounts.map((a) => a.plaidAccountId) },
    },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.plaidAccount, c._count._all]));

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      ...a,
      transactionCount: countMap.get(a.plaidAccountId) ?? 0,
    })),
  });
}
