import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PeopleWorkspace from "@/components/leads/people/PeopleWorkspace";

export const revalidate = 0;

/**
 * /leads/people — People workspace (Phase 5).
 *
 * Replaces /leads/dashboard (farm leads), /leads/clients (client DB), and
 * /leads/matches (buyer matches). Smart-list sidebar switches between lead-
 * based views (All / Hot / Cold) and client-based views (Buyers / Sellers /
 * Clients / Matches). A "Full filters" toggle reveals the existing 1,027-
 * line LeadsDashboard inline when the user needs to drill down.
 */
export default async function PeoplePage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/leads/people");
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });
  if (!sub || sub.status !== "active") redirect("/leads/pricing");
  if (!sub.onboarded) redirect("/leads/onboard");

  const farmFilter =
    sub.farmZips.length > 0
      ? { listing: { zip: { in: sub.farmZips } } }
      : {};

  const [leads, clients, matchClients] = await Promise.all([
    prisma.lead.findMany({
      where: { score: { gte: 20 }, ...farmFilter },
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
      take: 500,
    }),
    prisma.client.findMany({
      where: { subscriberId: sub.id },
      include: {
        notes: { orderBy: { createdAt: "desc" }, take: 3 },
        triggerEvents: { orderBy: { occurredAt: "desc" } },
        _count: { select: { notes: true } },
      },
      orderBy: [{ fitScore: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.client
      .findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          buyerSeller: true,
          fitScore: true,
          minPrice: true,
          maxPrice: true,
          preferredCities: true,
          preferredZips: true,
        },
        orderBy: { fitScore: "desc" },
        take: 50,
      })
      .catch(() => []),
  ]);

  const serializedLeads = leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    contactedAt: l.contactedAt?.toISOString() ?? null,
    closedAt: l.closedAt?.toISOString() ?? null,
  }));

  const serializedClients = clients.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    incomeEstimatedAt: c.incomeEstimatedAt?.toISOString() ?? null,
    notes: c.notes.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
    })),
    triggerEvents: c.triggerEvents.map((t) => ({
      ...t,
      occurredAt: t.occurredAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
    })),
  }));

  return (
    <PeopleWorkspace
      leads={serializedLeads}
      clients={serializedClients}
      matchClients={matchClients}
    />
  );
}
