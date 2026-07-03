import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const months = Math.min(Math.max(Number(searchParams.get("months") ?? 6), 1), 24);

  const userId = auth.session.userId;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1, 0, 0, 0, 0);

  const entries = await prisma.budgetEntry.findMany({
    where: {
      userId,
      occurredAt: { gte: start, lte: now },
      amountCents: { lt: 0 },
    },
    select: {
      categoryId: true,
      amountCents: true,
      occurredAt: true,
    },
  });

  const categories = await prisma.budgetCategory.findMany({
    where: { userId, archived: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true, color: true },
  });

  const buckets = new Map<string, Map<string | null, number>>();
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    buckets.set(key, new Map());
  }

  for (const e of entries) {
    const d = new Date(e.occurredAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const prev = bucket.get(e.categoryId) ?? 0;
    bucket.set(e.categoryId, prev + Math.abs(e.amountCents));
  }

  const series = Array.from(buckets.entries()).map(([month, m]) => {
    const row: Record<string, string | number> = { month };
    let total = 0;
    for (const c of categories) {
      const v = m.get(c.id) ?? 0;
      row[c.slug] = v;
      total += v;
    }
    row.total = total;
    return row;
  });

  return NextResponse.json({ series, categories });
}
