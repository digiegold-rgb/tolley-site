import type { Metadata } from "next";
import { requireVaterAdminPageSession } from "@/lib/admin-auth";
import { TrendsClient } from "@/components/vater/budget/TrendsClient";

export const metadata: Metadata = {
  title: "Trends | Vater Budget",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  await requireVaterAdminPageSession("/vater/budget/trends");
  return (
    <main className="relative z-10 mx-auto max-w-5xl px-5 py-12 sm:px-8">
      <div className="mb-6">
        <a href="/vater/budget" className="text-sm text-sky-400 transition hover:text-sky-300">
          ← Back to budget
        </a>
        <h1 className="vater-section-title mt-2 text-2xl font-bold text-slate-100">Trends</h1>
        <p className="mt-1 text-sm text-slate-400">Month-over-month spending by category.</p>
      </div>
      <TrendsClient />
    </main>
  );
}
