import type { Metadata } from "next";
import { requireVaterAdminPageSession } from "@/lib/admin-auth";
import { getCategoryStates, getMonthHero, getRecentEntries } from "@/lib/budget/queries";
import { prisma } from "@/lib/prisma";
import { BudgetDashboardClient } from "@/components/vater/budget/BudgetDashboardClient";

export const metadata: Metadata = {
  title: "Budget | Vater",
  description: "Voice-activated personal budgeting.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BudgetDashboardPage() {
  const { userId } = await requireVaterAdminPageSession("/vater/budget");

  const [hero, categories, recent, categoryOptions] = await Promise.all([
    getMonthHero(userId),
    getCategoryStates(userId, "month"),
    getRecentEntries(userId, 20),
    prisma.budgetCategory.findMany({
      where: { userId, archived: false },
      select: { id: true, name: true, slug: true, color: true, icon: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const voiceKeyConfigured = Boolean(
    process.env.VATER_BUDGET_VOICE_KEY && process.env.VATER_BUDGET_VOICE_KEY.length >= 24,
  );

  return (
    <main className="relative z-10 mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <BudgetDashboardClient
        initialHero={hero}
        initialCategories={categories}
        initialRecent={recent}
        categoryOptions={categoryOptions}
        voiceKeyConfigured={voiceKeyConfigured}
      />
    </main>
  );
}
