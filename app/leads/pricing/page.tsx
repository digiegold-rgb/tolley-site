import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import LeadsPricingClient from "@/components/leads/LeadsPricingClient";

export default async function LeadsPricingPage() {
  const session = await auth();
  const userId = session?.user?.id;

  let currentTier: string | null = null;
  if (userId) {
    const sub = await prisma.leadSubscriber.findUnique({
      where: { userId },
      select: { tier: true, status: true },
    });
    if (sub?.status === "active") {
      currentTier = sub.tier;
    }
  }

  return (
    <>
      {/* Header */}
      <div className="text-center mb-12">
          <p className="text-xs tracking-[0.2em] text-purple-400/80 uppercase mb-3">
            T-Agent Leads
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            AI-Powered Real Estate Leads
          </h1>
          <p className="text-white/50 max-w-2xl mx-auto">
            Motivated seller leads scored by AI. Dual buy/sell scoring, county tax
            data, 12 proximity categories. Delivered daily to your inbox.
          </p>
        </div>

        {/* Billing toggle + pricing cards (client component for interactivity) */}
        <LeadsPricingClient isLoggedIn={!!userId} currentTier={currentTier} />

        {/* What's included */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 mb-12">
          <h2 className="text-xl font-bold text-white mb-6">What Every Lead Includes</h2>
          <div className="grid sm:grid-cols-3 gap-6 text-sm">
            <div>
              <h4 className="font-medium text-white mb-2">Sell Score (0-100)</h4>
              <p className="text-white/40">
                AI-analyzed motivation signals: days on market, price drops,
                expired/withdrawn status, price range scoring.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">Buy Score (0-100)</h4>
              <p className="text-white/40">
                Location desirability from 12 proximity categories: schools,
                hospitals, parks, grocery, fire stations, libraries, and more.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-white mb-2">County & Tax Data</h4>
              <p className="text-white/40">
                Estimated annual/monthly property taxes, effective tax rate,
                county identification, assessment ratios — all computed per listing.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-6 text-center">FAQ</h2>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-medium text-white">Where do the leads come from?</h4>
              <p className="text-white/40 mt-1">
                Directly from Heartland MLS via MLS Grid API. We analyze every
                active, expired, and withdrawn listing for motivation signals.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-white">Can I pick my farm area?</h4>
              <p className="text-white/40 mt-1">
                Yes. After subscribing, you choose your zip codes, cities, and
                specialties. You only see leads in your farm area.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-white">What are AI SMS?</h4>
              <p className="text-white/40 mt-1">
                AI-powered text messages that nurture leads on your behalf.
                The AI qualifies prospects, answers questions, and books
                appointments via SMS.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-white">Can I cancel anytime?</h4>
              <p className="text-white/40 mt-1">
                Yes. No contracts. Cancel from your billing portal anytime.
              </p>
            </div>
          </div>
        </div>
    </>
  );
}
