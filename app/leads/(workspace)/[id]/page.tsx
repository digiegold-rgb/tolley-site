import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import LeadDetail from "@/components/leads/LeadDetail";

export const revalidate = 0;

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/leads");
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      listing: {
        include: {
          enrichment: true,
        },
      },
    },
  });

  if (!lead) redirect("/leads");

  // Fetch dossier data for this lead's listing (if any)
  const dossierJob = lead.listingId
    ? await prisma.dossierJob.findFirst({
        where: { listingId: lead.listingId, status: "complete" },
        orderBy: { completedAt: "desc" },
        include: { result: true },
      })
    : null;

  // Serialize dates
  const serialized = {
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    contactedAt: lead.contactedAt?.toISOString() ?? null,
    closedAt: lead.closedAt?.toISOString() ?? null,
    listing: lead.listing
      ? {
          ...lead.listing,
          createdAt: lead.listing.createdAt.toISOString(),
          updatedAt: lead.listing.updatedAt.toISOString(),
        }
      : null,
    dossier: dossierJob?.result
      ? {
          ...dossierJob.result,
          jobId: dossierJob.id,
          jobStatus: dossierJob.status,
          completedAt: dossierJob.completedAt?.toISOString() ?? null,
          createdAt: dossierJob.result.createdAt.toISOString(),
          updatedAt: dossierJob.result.updatedAt.toISOString(),
        }
      : null,
  };

  return (
    /* eslint-disable @typescript-eslint/no-explicit-any */
    <LeadDetail lead={serialized as any} />
  );
}
