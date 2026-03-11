import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeadsDashboard from "@/components/leads/LeadsDashboard";

export const revalidate = 120;

export default async function AgentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const syncKey = params.key || "";

  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/leads/dashboard");
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });

  if (!sub || sub.status !== "active") {
    redirect("/leads/pricing");
  }

  if (!sub.onboarded) {
    redirect("/leads/onboard");
  }

  // Build where clause from farm area
  const listingWhere: Record<string, unknown> = {};
  if (sub.farmZips.length > 0) {
    listingWhere.zip = { in: sub.farmZips };
  }

  // Tier-based daily lead limit
  const dailyLimit =
    sub.tier === "team" ? 50 : sub.tier === "pro" ? 25 : 10;

  const [leads, stats] = await Promise.all([
    prisma.lead.findMany({
      where: {
        score: { gte: 20 },
        ...(sub.farmZips.length > 0
          ? { listing: { zip: { in: sub.farmZips } } }
          : {}),
      },
      include: {
        listing: {
          select: {
            id: true,
            mlsId: true,
            address: true,
            city: true,
            zip: true,
            listPrice: true,
            originalListPrice: true,
            daysOnMarket: true,
            beds: true,
            baths: true,
            sqft: true,
            status: true,
            listingUrl: true,
            photoUrls: true,
            listAgentName: true,
            listOfficeName: true,
            propertyType: true,
            enrichment: {
              select: {
                buyScore: true,
                buyScoreFactors: true,
                nearestSchoolName: true,
                nearestSchoolDist: true,
                schoolsWithin3mi: true,
                nearestHospitalName: true,
                nearestHospitalDist: true,
                nearestFireStationDist: true,
                nearestParkName: true,
                nearestParkDist: true,
                parksWithin2mi: true,
                nearestGroceryName: true,
                nearestGroceryDist: true,
                nearestAirportName: true,
                nearestAirportDist: true,
                restaurantsWithin1mi: true,
                nearestCourthouseName: true,
                nearestCourthouseDist: true,
                nearestLibraryName: true,
                nearestLibraryDist: true,
                librariesWithin3mi: true,
                countyName: true,
                countyState: true,
                estimatedAnnualTax: true,
                estimatedMonthlyTax: true,
                effectiveTaxRate: true,
                taxBurdenRating: true,
              },
            },
          },
        },
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: dailyLimit * 3, // show ~3 days of leads
    }),
    prisma.lead.groupBy({
      by: ["status"],
      where: {
        ...(sub.farmZips.length > 0
          ? { listing: { zip: { in: sub.farmZips } } }
          : {}),
      },
      _count: { id: true },
    }),
  ]);

  const serialized = leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    contactedAt: l.contactedAt?.toISOString() ?? null,
    closedAt: l.closedAt?.toISOString() ?? null,
  }));

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6">
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">
            Leads
          </span>
          <span className="text-white/20">/</span>
          <a
            href="/leads/clients"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Clients
          </a>
          <span className="text-white/20">/</span>
          <a
            href={`/leads/conversations${syncKey ? `?key=${syncKey}` : ""}`}
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Conversations
          </a>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white">Your Leads</h1>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-3 py-0.5 text-xs font-medium text-purple-300 capitalize">
              {sub.tier}
            </span>
            <a
              href="/leads/onboard"
              className="text-xs text-white/40 hover:text-white/60"
            >
              Edit farm area
            </a>
          </div>
        </div>

        {/* Farm area info */}
        <div className="flex flex-wrap gap-2 text-xs text-white/40 mb-6">
          <span>{sub.farmZips.length} zip codes</span>
          <span>|</span>
          <span>{dailyLimit} leads/day</span>
          <span>|</span>
          <span>
            {sub.smsUsed}/{sub.smsLimit} SMS used
          </span>
          {sub.specialties.length > 0 && (
            <>
              <span>|</span>
              <span>{sub.specialties.join(", ")}</span>
            </>
          )}
        </div>

        {/* Pipeline stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {stats.map((s) => (
            <div
              key={s.status}
              className="rounded-lg bg-white/5 p-4 text-center"
            >
              <div className="text-2xl font-bold text-white">
                {s._count.id}
              </div>
              <div className="text-xs text-white/50 capitalize">{s.status}</div>
            </div>
          ))}
        </div>

        {leads.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/50 text-lg">No leads in your farm area yet</p>
            <p className="text-white/30 text-sm mt-2">
              Leads are refreshed daily. Check back tomorrow or expand your farm area.
            </p>
          </div>
        ) : (
          <LeadsDashboard leads={serialized} />
        )}
      </div>
    </div>
  );
}
