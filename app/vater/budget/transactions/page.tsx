import type { Metadata } from "next";
import { requireVaterAdminPageSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { TransactionsClient } from "@/components/vater/budget/TransactionsClient";

export const metadata: Metadata = {
  title: "Transactions | Vater Budget",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const { userId } = await requireVaterAdminPageSession("/vater/budget/transactions");
  const categories = await prisma.budgetCategory.findMany({
    where: { userId, archived: false },
    select: { id: true, name: true, slug: true, color: true, icon: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <main className="relative z-10 mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <div className="mb-6">
        <a href="/vater/budget" className="text-sm text-sky-400 transition hover:text-sky-300">
          ← Back to budget
        </a>
        <h1 className="vater-section-title mt-2 text-2xl font-bold text-slate-100">Transactions</h1>
      </div>
      <TransactionsClient categories={categories} />
    </main>
  );
}
