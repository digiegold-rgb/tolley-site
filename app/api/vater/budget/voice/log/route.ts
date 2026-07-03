import { NextResponse } from "next/server";
import { checkVoiceBearer } from "@/lib/budget/voice-auth";
import { prisma } from "@/lib/prisma";
import { dollarsToCents, periodWindow } from "@/lib/budget/format";
import { parseExpenseUtterance } from "@/lib/budget/llm";
import { periodPhrase, spokenLogged } from "@/lib/budget/spoken";

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
      { ok: false, error: "Missing text", spoken: "I didn't catch what you said." },
      { status: 400 },
    );
  }

  const userId = await resolveAdminUserId();
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "No admin user", spoken: "Budget owner not configured." },
      { status: 503 },
    );
  }

  const categories = await prisma.budgetCategory.findMany({
    where: { userId, archived: false },
    select: { id: true, slug: true, name: true },
    orderBy: { sortOrder: "asc" },
  });

  let parsed;
  try {
    parsed = await parseExpenseUtterance(text, categories.map((c) => ({ slug: c.slug, name: c.name })));
  } catch (err) {
    console.error("[budget/voice/log] LLM error:", err);
    return NextResponse.json(
      { ok: false, error: "LLM parse failed", spoken: "I couldn't understand that. Try again." },
      { status: 502 },
    );
  }

  if (!parsed.amount || parsed.amount <= 0) {
    return NextResponse.json(
      { ok: false, error: "No amount parsed", spoken: "I didn't hear an amount." },
      { status: 400 },
    );
  }

  const matched = parsed.categorySlug
    ? categories.find((c) => c.slug === parsed.categorySlug) ?? null
    : null;

  const occurredAt = parsed.occurredAt ? new Date(parsed.occurredAt) : new Date();

  const entry = await prisma.budgetEntry.create({
    data: {
      userId,
      categoryId: matched?.id ?? null,
      amountCents: -dollarsToCents(parsed.amount),
      vendor: parsed.vendor,
      note: parsed.note,
      tags: parsed.tags,
      occurredAt: Number.isFinite(occurredAt.getTime()) ? occurredAt : new Date(),
      source: "VOICE",
      rawText: text,
      needsReview: !matched,
    },
  });

  let remainingCents: number | null = null;
  let remainingPeriod = "this month";
  if (matched) {
    const { from, to } = periodWindow("month");
    const grouped = await prisma.budgetEntry.aggregate({
      where: {
        userId,
        categoryId: matched.id,
        occurredAt: { gte: from, lte: to },
        amountCents: { lt: 0 },
      },
      _sum: { amountCents: true },
    });
    const cat = await prisma.budgetCategory.findUnique({ where: { id: matched.id } });
    if (cat) {
      const spent = Math.abs(grouped._sum.amountCents ?? 0);
      remainingCents = cat.monthlyLimitCents - spent;
      remainingPeriod = periodPhrase("month");
    }
  }

  const spoken = spokenLogged({
    amount: parsed.amount,
    categoryName: matched?.name ?? null,
    tags: parsed.tags,
    remainingCents,
    remainingPeriod,
  });

  return NextResponse.json({
    ok: true,
    spoken,
    entry: {
      id: entry.id,
      amountCents: entry.amountCents,
      categoryId: entry.categoryId,
      tags: entry.tags,
      vendor: entry.vendor,
      needsReview: entry.needsReview,
    },
  });
}
