import type { Metadata } from "next";
import { requireVaterAdminPageSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { GoalsClient } from "@/components/vater/budget/GoalsClient";

export const metadata: Metadata = {
  title: "Goals | Vater Budget",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const { userId } = await requireVaterAdminPageSession("/vater/budget/goals");
  const goals = await prisma.budgetGoal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return (
    <main className="relative z-10 mx-auto max-w-3xl px-5 py-12 sm:px-8">
      <div className="mb-6">
        <a href="/vater/budget" className="text-sm text-sky-400 transition hover:text-sky-300">
          ← Back to budget
        </a>
        <h1 className="vater-section-title mt-2 text-2xl font-bold text-slate-100">Goals</h1>
        <p className="mt-1 text-sm text-slate-400">Saving targets & contributions.</p>
      </div>
      <GoalsClient initialGoals={goals} />
    </main>
  );
}
