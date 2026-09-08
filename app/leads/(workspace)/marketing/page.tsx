import { auth } from "@/auth";
import { redirect } from "next/navigation";
import MarketingTabs from "@/components/leads/marketing/MarketingTabs";

export const revalidate = 0;

/**
 * /leads/marketing — Marketing workspace (Phase 6).
 *
 * URL-synced tabs for: Sequences · Email · Scripts · Content · Farm Mail ·
 * Open House · FSBO. Each tab describes the feature and links to the
 * existing full-featured route (which still works and stays inside the
 * T-Agent shell).
 */
export default async function MarketingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/leads/marketing");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Marketing</h1>
        <p className="text-xs text-white/40">
          Drip campaigns, content, direct mail, open houses, and FSBO research — all in one place.
        </p>
      </div>
      <MarketingTabs />
    </div>
  );
}
