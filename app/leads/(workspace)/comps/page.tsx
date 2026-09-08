import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CompsAnalysis from "@/components/leads/CompsAnalysis";

export const revalidate = 300;

export default async function CompsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leads/comps");

  const listings = await prisma.listing.findMany({
    where: { status: { in: ["Active", "Closed", "Expired", "Withdrawn"] } },
    select: {
      id: true,
      address: true,
      city: true,
      zip: true,
      listPrice: true,
      beds: true,
      baths: true,
      sqft: true,
      daysOnMarket: true,
      status: true,
      propertyType: true,
      photoUrls: true,
      enrichment: {
        select: {
          buyScore: true,
          estimatedAnnualTax: true,
          taxBurdenRating: true,
          countyName: true,
        },
      },
    },
    orderBy: { listPrice: "desc" },
    take: 500,
  });

  return <CompsAnalysis listings={listings} />;
}
