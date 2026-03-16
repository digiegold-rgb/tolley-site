import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import LeadsDashboard from "@/components/leads/LeadsDashboard";

export const revalidate = 300;

/**
 * /leads?key=SYNC_SECRET
 *
 * Auth via query param. Bookmark the full URL for quick access.
 * Falls back to shop admin cookie if no key provided.
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const params = await searchParams;
  const syncSecret = process.env.SYNC_SECRET;
  const keyMatch = syncSecret && params.key === syncSecret;

  if (!keyMatch) {
    redirect("/?err=unauthorized");
  }

  const [leads, stats, lastSync, listingCount] = await Promise.all([
    prisma.lead.findMany({
      where: { score: { gte: 20 } },
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
      take: 100,
    }),
    prisma.lead.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { referralFee: true },
    }),
    prisma.syncLog.findFirst({
      where: { source: "mls_grid" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.listing.count(),
  ]);

  const serialized = leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    contactedAt: l.contactedAt?.toISOString() ?? null,
    closedAt: l.closedAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-white">T-Agent Leads</h1>
        <div className="flex gap-3">
          <a
            href={`/leads/dossier?key=${params.key}`}
            className="rounded-lg bg-purple-600/30 text-purple-300 px-4 py-2 text-sm hover:bg-purple-600/50"
          >
            Dossiers
          </a>
          <a
            href={`/leads/conversations?key=${params.key}`}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/20"
          >
            Conversations
          </a>
        </div>
      </div>

      {/* Sync info */}
      <div className="flex flex-wrap gap-4 text-sm text-white/40 mb-6">
        <span>
          Last sync:{" "}
          {lastSync
            ? new Date(lastSync.createdAt).toLocaleString()
            : "Never"}
        </span>
        <span>{listingCount.toLocaleString()} total listings</span>
        {lastSync && (
          <span>
            {lastSync.recordsNew} new | {lastSync.error ? `Error: ${lastSync.error}` : "OK"}
          </span>
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
            {s._sum.referralFee ? (
              <div className="text-xs text-green-400 mt-1">
                ${s._sum.referralFee.toLocaleString()}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {leads.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/50 text-lg">No leads yet</p>
          <p className="text-white/30 text-sm mt-2">
            Run a sync first: POST /api/leads/sync?mode=active
          </p>
        </div>
      )}

      <LeadsDashboard leads={serialized} />
    </div>
  );
}
