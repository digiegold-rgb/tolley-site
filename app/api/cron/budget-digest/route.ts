import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { centsToDollars, formatMoney, periodWindow } from "@/lib/budget/format";
import { notifyTelegram } from "@/lib/budget/notify";

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

async function buildDigest(userId: string): Promise<{ message: string; insights: string[] }> {
  const { from: monthStart, to: now } = periodWindow("month");
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const [categories, dayEntries] = await Promise.all([
    prisma.budgetCategory.findMany({
      where: { userId, archived: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.budgetEntry.findMany({
      where: {
        userId,
        occurredAt: { gte: dayStart, lte: now },
        amountCents: { lt: 0 },
      },
      include: { category: { select: { name: true } } },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
  ]);

  const monthGrouped = await prisma.budgetEntry.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      occurredAt: { gte: monthStart, lte: now },
      amountCents: { lt: 0 },
    },
    _sum: { amountCents: true },
  });
  const monthByCat = new Map(
    monthGrouped.map((g) => [g.categoryId, Math.abs(g._sum.amountCents ?? 0)]),
  );

  const dayTotalCents = dayEntries.reduce((s, e) => s + Math.abs(e.amountCents), 0);
  const monthSpentCents = Array.from(monthByCat.values()).reduce((s, v) => s + v, 0);
  const monthLimitCents = categories.reduce((s, c) => s + c.monthlyLimitCents, 0);

  // On-pace calculation: (spent / day_of_month) * days_in_month
  const today = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const insights: string[] = [];
  for (const c of categories) {
    const spent = monthByCat.get(c.id) ?? 0;
    if (spent === 0 || c.monthlyLimitCents === 0) continue;
    const projected = (spent / today) * lastDay;
    const overBy = projected - c.monthlyLimitCents;
    if (overBy > 5_00) {
      insights.push(
        `${c.icon ?? ""} ${c.name}: pace = ${formatMoney(Math.round(projected))} (${formatMoney(Math.round(overBy))} over cap)`,
      );
    }
  }

  const lines: string[] = [];
  lines.push(`*💰 Daily budget digest — ${now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}*`);
  lines.push("");
  lines.push(`*Today:* ${formatMoney(dayTotalCents)} across ${dayEntries.length} entries`);
  lines.push(`*Month:* ${formatMoney(monthSpentCents)} of ${formatMoney(monthLimitCents)}`);
  lines.push("");

  if (dayEntries.length > 0) {
    lines.push("*Today's transactions:*");
    for (const e of dayEntries.slice(0, 8)) {
      const tag = e.tags.length > 0 ? ` _#${e.tags.join(" #")}_` : "";
      lines.push(`• ${formatMoney(e.amountCents)} ${e.vendor || "?"} (${e.category?.name ?? "uncat"})${tag}`);
    }
    if (dayEntries.length > 8) lines.push(`…and ${dayEntries.length - 8} more`);
    lines.push("");
  }

  if (insights.length > 0) {
    lines.push("*⚠️ On pace to overspend:*");
    for (const i of insights) lines.push(`• ${i}`);
    lines.push("");
  }

  lines.push("[Open dashboard](https://tolley.io/vater/budget)");

  return { message: lines.join("\n"), insights };
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const owners = await prisma.budgetCategory.findMany({
    where: { archived: false },
    distinct: ["userId"],
    select: { userId: true },
  });

  const reports: Record<string, unknown> = {};
  for (const { userId } of owners) {
    try {
      const { message, insights } = await buildDigest(userId);
      const sent = await notifyTelegram(message);
      reports[userId] = {
        sent: sent.ok,
        sendError: sent.error ?? null,
        insightCount: insights.length,
        chars: message.length,
      };
    } catch (err) {
      reports[userId] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({ ok: true, reports, count: owners.length });
}

export const POST = GET;
