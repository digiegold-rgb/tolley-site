import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AnalyticsDashboard from "@/components/analytics/analytics-dashboard";

export const revalidate = 0;

export const metadata = {
  title: "tolley.io | Analytics",
  description: "Unified analytics dashboard for all tolley.io sites.",
};

export default async function StartAnalyticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/start/analytics");
  }

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-purple-400">tolley.io Analytics</h1>
            <p className="text-sm text-white/40 mt-1">
              All sites &middot; Traffic &middot; Events &middot; API usage
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/junkinjays/analytics"
              className="rounded-lg bg-[#e85d04]/10 border border-[#e85d04]/30 px-3 py-1.5 text-xs text-[#e85d04] hover:bg-[#e85d04]/20 transition"
            >
              JJ Analytics
            </a>
            <a
              href="/start"
              className="rounded-lg bg-purple-600/10 border border-purple-500/30 px-3 py-1.5 text-xs text-purple-400 hover:bg-purple-600/20 transition"
            >
              All Sites
            </a>
          </div>
        </div>
        <AnalyticsDashboard />
      </div>
    </div>
  );
}
