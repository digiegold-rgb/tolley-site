import type { Metadata } from "next";
import { requireVaterAdminPageSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { RecurringClient } from "@/components/vater/budget/RecurringClient";

export const metadata: Metadata = {
  title: "Recurring Bills | Vater Budget",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const { userId } = await requireVaterAdminPageSession("/vater/budget/recurring");
  const [recurring, categories] = await Promise.all([
    prisma.budgetRecurring.findMany({
      where: { userId },
      orderBy: [{ active: "desc" }, { nextDueAt: "asc" }],
      include: { category: { select: { id: true, name: true, color: true, icon: true } } },
    }),
    prisma.budgetCategory.findMany({
      where: { userId, archived: false },
      select: { id: true, name: true, slug: true, color: true, icon: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return (
    <main className="relative z-10 mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <div className="mb-6">
        <a href="/vater/budget" className="text-sm text-sky-400 transition hover:text-sky-300">
          ← Back to budget
        </a>
        <h1 className="vater-section-title mt-2 text-2xl font-bold text-slate-100">Recurring bills</h1>
        <p className="mt-1 text-sm text-slate-400">Subscriptions, rent, utilities — what hits your account on a schedule.</p>
      </div>
      <RecurringClient initialRecurring={recurring} categories={categories} />
    </main>
  );
}
