import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DealsTracker from "@/components/leads/DealsTracker";

export const revalidate = 0;

export default async function DealsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/leads/deals");

  const deals = await prisma.deal.findMany({
    include: {
      Lead: {
        select: {
          ownerName: true,
          score: true,
          listing: {
            select: {
              address: true,
              city: true,
              listPrice: true,
              photoUrls: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const serialized = deals.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    offerDate: d.offerDate?.toISOString() ?? null,
    contractDate: d.contractDate?.toISOString() ?? null,
    inspectionDate: d.inspectionDate?.toISOString() ?? null,
    appraisalDate: d.appraisalDate?.toISOString() ?? null,
    closingDate: d.closingDate?.toISOString() ?? null,
    closedDate: d.closedDate?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Deal Tracker</h1>
      <DealsTracker deals={serialized} />
    </div>
  );
}
