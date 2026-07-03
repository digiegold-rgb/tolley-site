import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

function bumpNext(date: Date, cadence: string, dayOfMonth: number | null): Date {
  const next = new Date(date);
  switch (cadence) {
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    case "monthly":
    default: {
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonth) next.setDate(Math.min(dayOfMonth, 28));
      break;
    }
  }
  return next;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.budgetRecurring.findMany({
    where: { active: true, nextDueAt: { lte: now } },
  });

  let inserted = 0;
  const errors: string[] = [];

  for (const r of due) {
    try {
      await prisma.budgetEntry.create({
        data: {
          userId: r.userId,
          categoryId: r.categoryId,
          amountCents: -Math.abs(r.amountCents),
          vendor: r.name,
          note: `Recurring: ${r.cadence}`,
          tags: ["recurring"],
          occurredAt: r.nextDueAt,
          source: "MANUAL",
        },
      });
      const next = bumpNext(r.nextDueAt, r.cadence, r.dayOfMonth);
      await prisma.budgetRecurring.update({
        where: { id: r.id },
        data: { nextDueAt: next },
      });
      inserted += 1;
    } catch (err) {
      errors.push(`${r.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, inserted, errors });
}

export const POST = GET;
