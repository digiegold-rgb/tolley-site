import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CrmBoard from "@/components/leads/crm/CrmBoard";
import { PIPELINE_STAGES, type CrmLead } from "@/lib/crm-types";

export const revalidate = 0;

/**
 * /leads/pipeline — Full-feature kanban (Phase 4).
 *
 * Replaces the old /leads/crm route (which now redirects here). Wires the
 * existing CrmBoard with the extended 8-stage funnel: new → contacted →
 * interested → showing → referred → closed → past_client (+ dead).
 */
export default async function PipelinePage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/leads/pipeline");
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });
  if (!sub || sub.status !== "active") redirect("/leads/pricing");
  if (!sub.onboarded) redirect("/leads/onboard");

  const leads = await prisma.lead.findMany({
    where:
      sub.farmZips.length > 0
        ? { listing: { zip: { in: sub.farmZips } } }
        : {},
    include: {
      listing: {
        select: {
          id: true,
          address: true,
          city: true,
          zip: true,
          listPrice: true,
          beds: true,
          baths: true,
          sqft: true,
          photoUrls: true,
          status: true,
        },
      },
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const serializedLeads: CrmLead[] = leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    contactedAt: l.contactedAt?.toISOString() ?? null,
    closedAt: l.closedAt?.toISOString() ?? null,
  }));

  // Initialize every stage with an empty bucket so the board always renders
  // the full 8 columns even if some are empty.
  const grouped: Record<string, CrmLead[]> = {};
  for (const stage of PIPELINE_STAGES) {
    grouped[stage.id] = [];
  }
  for (const lead of serializedLeads) {
    const stage = lead.status || "new";
    if (grouped[stage]) {
      grouped[stage].push(lead);
    } else {
      grouped.new.push(lead);
    }
  }

  return (
    <CrmBoard
      initialLeads={grouped}
      initialTasks={[]}
      initialTags={[]}
      initialDeals={[]}
      initialSmartLists={[]}
    />
  );
}
