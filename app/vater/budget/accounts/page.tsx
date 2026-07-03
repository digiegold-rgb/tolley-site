import type { Metadata } from "next";
import { requireVaterAdminPageSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { AccountsClient } from "@/components/vater/budget/AccountsClient";

export const metadata: Metadata = {
  title: "Budget Accounts | Vater",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BudgetAccountsPage() {
  const { userId } = await requireVaterAdminPageSession("/vater/budget/accounts");
  const accounts = await prisma.budgetPlaidAccount.findMany({
    where: { userId },
    orderBy: [{ isPersonal: "desc" }, { name: "asc" }],
  });

  return (
    <main className="relative z-10 mx-auto max-w-4xl px-5 py-12 sm:px-8">
      <div className="mb-8">
        <a href="/vater/budget" className="text-sm text-sky-400 transition hover:text-sky-300">
          ← Back to budget
        </a>
        <h1 className="vater-section-title mt-2 text-2xl font-bold text-slate-100">Bank accounts</h1>
        <p className="mt-1 text-sm text-slate-400">
          Toggle which Plaid-linked accounts feed into your budget. Business accounts should be off.
        </p>
      </div>
      <AccountsClient initialAccounts={accounts} />
    </main>
  );
}
