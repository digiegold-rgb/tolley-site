import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CrmBoard from "@/components/leads/crm/CrmBoard";
import type { CrmLead } from "@/lib/crm-types";

export const revalidate = 0;

export default async function CrmPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/leads/crm");
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

  // Fetch leads with listings
  const leads = await prisma.lead.findMany({
    where: {
      ...(sub.farmZips.length > 0
        ? { listing: { zip: { in: sub.farmZips } } }
        : {}),
    },
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

  // Serialize dates
  const serializedLeads: CrmLead[] = leads.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
    contactedAt: l.contactedAt?.toISOString() ?? null,
    closedAt: l.closedAt?.toISOString() ?? null,
  }));

  // Group leads by status (pipeline stage)
  const grouped: Record<string, CrmLead[]> = {
    new: [],
    contacted: [],
    interested: [],
    referred: [],
    closed: [],
    dead: [],
  };

  for (const lead of serializedLeads) {
    const stage = lead.status || "new";
    if (grouped[stage]) {
      grouped[stage].push(lead);
    } else {
      grouped.new.push(lead);
    }
  }

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-[1600px] px-4 py-6">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a
            href="/leads/dashboard"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Leads
          </a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-orange-300 bg-orange-500/10">
            CRM
          </span>
          <span className="text-white/20">/</span>
          <a
            href="/leads/dossier"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Dossiers
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/clients"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Clients
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/conversations"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Conversations
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/sequences"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Sequences
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/analytics"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Analytics
          </a>
        </nav>

        <CrmBoard
          initialLeads={grouped}
          initialTasks={[]}
          initialTags={[]}
          initialDeals={[]}
          initialSmartLists={[]}
        />
      </div>
    </div>
  );
}
