import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { LEADS_TIERS } from "@/lib/leads-subscription";
import LeadsPricingActions from "@/components/leads/LeadsPricingActions";

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
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-5xl px-4 py-16">
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

        {/* Pricing cards */}
        <div className="grid sm:grid-cols-3 gap-6 mb-16">
          {LEADS_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-2xl border p-6 ${
                tier.popular
                  ? "border-purple-500/50 bg-purple-900/10"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-purple-500 px-3 py-0.5 text-[0.65rem] font-bold text-white uppercase tracking-wider">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">${tier.price}</span>
                  <span className="text-white/40 text-sm">/month</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-white/60"
                  >
                    <span className="text-green-400 mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <LeadsPricingActions
                tierId={tier.id}
                isLoggedIn={!!userId}
                isCurrent={currentTier === tier.id}
              />
            </div>
          ))}
        </div>

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
      </div>
    </div>
  );
}
