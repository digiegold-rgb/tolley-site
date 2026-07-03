import { NextResponse } from "next/server";
import { checkVoiceBearer } from "@/lib/budget/voice-auth";
import { prisma } from "@/lib/prisma";
import { centsToDollars, periodWindow } from "@/lib/budget/format";
import { parseQueryUtterance } from "@/lib/budget/llm";
import {
  periodPhrase,
  spokenRecent,
  spokenRemaining,
  spokenSpent,
  spokenTop,
} from "@/lib/budget/spoken";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function resolveAdminUserId(): Promise<string | null> {
  const allow = (process.env.VATER_ADMIN_ALLOWLIST_EMAILS || process.env.ADMIN_ALLOWLIST_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return null;
  const user = await prisma.user.findFirst({
    where: { email: { in: allow } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return user?.id ?? null;
}

export async function POST(req: Request) {
  const authCheck = checkVoiceBearer(req);
  if (!authCheck.ok) return authCheck.response;

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  if (!text) {
    return NextResponse.json(
      { ok: false, spoken: "I didn't catch your question." },
      { status: 400 },
    );
  }

  const userId = await resolveAdminUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, spoken: "Budget owner not configured." },
      { status: 503 },
    );
  }

  const categories = await prisma.budgetCategory.findMany({
    where: { userId, archived: false },
    select: { id: true, slug: true, name: true, monthlyLimitCents: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  let parsed;
  try {
    parsed = await parseQueryUtterance(text, categories.map((c) => ({ slug: c.slug, name: c.name })));
  } catch (err) {
    console.error("[budget/voice/ask] LLM error:", err);
    return NextResponse.json(
      { ok: false, spoken: "I couldn't understand that. Try again." },
      { status: 502 },
    );
  }

  const { from, to } = periodWindow(parsed.period);
  const tagFilter = parsed.tags.length > 0 ? { tags: { hasSome: parsed.tags } } : {};
  const matched = parsed.categorySlug ? categories.find((c) => c.slug === parsed.categorySlug) : null;

  let spoken = "I'm not sure what to check.";

  if (parsed.intent === "remaining" && matched) {
    const sum = await prisma.budgetEntry.aggregate({
      where: {
        userId,
        categoryId: matched.id,
        occurredAt: { gte: from, lte: to },
        amountCents: { lt: 0 },
        ...tagFilter,
      },
      _sum: { amountCents: true },
    });
    const spent = Math.abs(sum._sum.amountCents ?? 0);
    const remaining = matched.monthlyLimitCents - spent;
    spoken = spokenRemaining({
      categoryName: matched.name,
      remainingCents: remaining,
      period: periodPhrase(parsed.period),
    });
  } else if (parsed.intent === "spent") {
    const where: Record<string, unknown> = {
      userId,
      occurredAt: { gte: from, lte: to },
      amountCents: { lt: 0 },
      ...tagFilter,
    };
    if (matched) where.categoryId = matched.id;
    const sum = await prisma.budgetEntry.aggregate({ where, _sum: { amountCents: true } });
    const spent = Math.abs(sum._sum.amountCents ?? 0);
    const scope = matched
      ? matched.name
      : parsed.tags.length > 0
        ? parsed.tags.join(" + ")
        : "everything";
    spoken = spokenSpent({ scope, spentCents: spent, period: periodPhrase(parsed.period) });
  } else if (parsed.intent === "recent") {
    const items = await prisma.budgetEntry.findMany({
      where: { userId, ...tagFilter, ...(matched ? { categoryId: matched.id } : {}) },
      orderBy: { occurredAt: "desc" },
      take: parsed.limit ?? 5,
      include: { category: { select: { name: true } } },
    });
    spoken = spokenRecent(
      items.map((i) => ({
        vendor: i.vendor,
        amount: centsToDollars(Math.abs(i.amountCents)),
        categoryName: i.category?.name ?? null,
      })),
    );
  } else if (parsed.intent === "top") {
    const grouped = await prisma.budgetEntry.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        occurredAt: { gte: from, lte: to },
        amountCents: { lt: 0 },
        ...tagFilter,
      },
      _sum: { amountCents: true },
    });
    const ranked = grouped
      .map((g) => {
        const cat = categories.find((c) => c.id === g.categoryId);
        return cat
          ? { name: cat.name, spentCents: Math.abs(g._sum.amountCents ?? 0) }
          : null;
      })
      .filter((x): x is { name: string; spentCents: number } => x !== null)
      .sort((a, b) => b.spentCents - a.spentCents);
    spoken = spokenTop(ranked.slice(0, parsed.limit ?? 5));
  } else if (parsed.intent === "goal" && parsed.goalName) {
    const goal = await prisma.budgetGoal.findFirst({
      where: { userId, name: { contains: parsed.goalName, mode: "insensitive" } },
    });
    if (goal) {
      const pct = goal.targetCents > 0 ? Math.round((goal.currentCents / goal.targetCents) * 100) : 0;
      spoken = `Goal "${goal.name}": ${pct}% of $${(goal.targetCents / 100).toFixed(0)}.`;
    } else {
      spoken = `No goal matching "${parsed.goalName}".`;
    }
  }

  return NextResponse.json({ ok: true, spoken, intent: parsed.intent, period: parsed.period });
}
