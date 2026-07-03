import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncPlaidToBudget } from "@/lib/budget/plaid-bridge";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

async function budgetOwnerIds(): Promise<string[]> {
  // Only sync for users who have already seeded budget categories — keeps the
  // cron scoped to the actual budget owner(s) rather than every admin email.
  const owners = await prisma.budgetCategory.findMany({
    where: { archived: false },
    distinct: ["userId"],
    select: { userId: true },
  });
  return owners.map((o) => o.userId);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const userIds = await budgetOwnerIds();
  const reports: Record<string, unknown> = {};
  for (const userId of userIds) {
    try {
      reports[userId] = await syncPlaidToBudget(userId);
    } catch (err) {
      reports[userId] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return NextResponse.json({ ok: true, reports });
}

export const POST = GET;
