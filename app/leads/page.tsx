import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AddressSearch from "@/components/leads/AddressSearch";
import ActivityTracker from "@/components/leads/ActivityTracker";
import TodayQueueWidget from "@/components/leads/cockpit/TodayQueueWidget";
import OverdueTasksWidget from "@/components/leads/cockpit/OverdueTasksWidget";
import LastSyncBar from "@/components/leads/cockpit/LastSyncBar";
import PipelineKpis from "@/components/leads/cockpit/PipelineKpis";
import HotLeadsList from "@/components/leads/cockpit/HotLeadsList";
import QuickActionsGrid from "@/components/leads/cockpit/QuickActionsGrid";
import AiChatPane from "@/components/leads/cockpit/AiChatPane";
import SnapDropZone from "@/components/leads/cockpit/SnapDropZone";

export const revalidate = 60;

/**
 * /leads — Cockpit landing (Phase 3).
 *
 * Replaces both the old pipeline-as-home and the 8-section kitchen-sink at
 * /leads/dashboard. Three-column layout:
 *   Left  — Today queue, Overdue tasks, Recent activity
 *   Mid   — AI co-pilot, Snap drop zone, address search
 *   Right — Pipeline KPIs, Hot leads, Quick actions
 */
export default async function CockpitPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/leads");
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });
  if (!sub || sub.status !== "active") redirect("/leads/pricing");
  if (!sub.onboarded) redirect("/leads/onboard");

  // Gather all Cockpit data in a single Promise.all
  const [hotLeads, statusCounts, overdueTasks, lastSync, listingCount, leadCount] =
    await Promise.all([
      prisma.lead.findMany({
        where: {
          score: { gte: 50 },
          ...(sub.farmZips.length > 0
            ? { listing: { zip: { in: sub.farmZips } } }
            : {}),
        },
        include: {
          listing: {
            select: {
              address: true,
              city: true,
              listPrice: true,
              originalListPrice: true,
              daysOnMarket: true,
            },
          },
        },
        orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
        take: 10,
      }),
      prisma.lead.groupBy({
        by: ["status"],
        where:
          sub.farmZips.length > 0
            ? { listing: { zip: { in: sub.farmZips } } }
            : {},
        _count: { id: true },
      }),
      prisma.crmTask.findMany({
        where: {
          subscriberId: sub.id,
          status: "pending",
          dueDate: { lt: new Date() },
        },
        orderBy: { dueDate: "asc" },
        take: 10,
      }),
      prisma.syncLog.findFirst({
        where: { source: "mls_grid" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.listing.count(),
      prisma.lead.count({
        where: { score: { gte: 20 } },
      }),
    ]);

  // Shape data for widgets
  const todayLeads = hotLeads.slice(0, 6).map((l) => {
    const priceDropPct =
      l.listing?.listPrice && l.listing?.originalListPrice
        ? ((l.listing.originalListPrice - l.listing.listPrice) /
            l.listing.originalListPrice) *
          100
        : null;
    return {
      id: l.id,
      score: l.score,
      status: l.status,
      address: l.listing?.address ?? "(no address)",
      city: l.listing?.city ?? null,
      priceDropPct,
      daysOnMarket: l.listing?.daysOnMarket ?? null,
    };
  });

  const topHot = hotLeads.slice(0, 5).map((l) => ({
    id: l.id,
    score: l.score,
    address: l.listing?.address ?? "(no address)",
    city: l.listing?.city ?? null,
    listPrice: l.listing?.listPrice ?? null,
  }));

  const kpiTiles = [
    {
      label: "new",
      value: statusCounts.find((s) => s.status === "new")?._count.id ?? 0,
    },
    {
      label: "contacted",
      value: statusCounts.find((s) => s.status === "contacted")?._count.id ?? 0,
      tone: "warning" as const,
    },
    {
      label: "interested",
      value: statusCounts.find((s) => s.status === "interested")?._count.id ?? 0,
      tone: "good" as const,
    },
    {
      label: "closed",
      value: statusCounts.find((s) => s.status === "closed")?._count.id ?? 0,
      tone: "good" as const,
    },
  ];

  const serializedTasks = overdueTasks.map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.dueDate?.toISOString() ?? null,
    priority: t.priority,
    leadId: t.leadId,
  }));

  return (
    <div className="relative space-y-5">
      {/* Fresh pastel mesh — sits behind the cockpit, softens the dark shell */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-10 -z-10 h-[520px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 55% at 8% 10%, rgba(94,234,212,0.22) 0%, transparent 60%), radial-gradient(55% 60% at 92% 0%, rgba(196,181,253,0.22) 0%, transparent 60%), radial-gradient(45% 50% at 50% 80%, rgba(253,186,116,0.18) 0%, transparent 65%), radial-gradient(40% 45% at 30% 100%, rgba(125,211,252,0.18) 0%, transparent 65%)",
          filter: "blur(24px)",
        }}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="bg-gradient-to-r from-white via-sky-100 to-violet-200 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
            Cockpit
          </h1>
          <p className="mt-1 text-xs text-white/60">
            Your command center ·{" "}
            <span className="text-emerald-300">{sub.farmZips.length} zips</span>{" "}
            ·{" "}
            <span className="text-violet-300 capitalize">{sub.tier} tier</span>
          </p>
        </div>
        <LastSyncBar
          lastSyncAt={lastSync?.createdAt.toISOString() ?? null}
          listingCount={listingCount}
          leadCount={leadCount}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-4">
          <TodayQueueWidget
            leads={todayLeads}
            subtitle={`Top ${todayLeads.length} hot leads`}
          />
          <OverdueTasksWidget tasks={serializedTasks} />
          <ActivityTracker />
        </div>

        {/* Middle column */}
        <div className="space-y-5 lg:col-span-5">
          <AiChatPane />
          <SnapDropZone />
          <AddressSearch />
        </div>

        {/* Right column */}
        <div className="space-y-5 lg:col-span-3">
          <PipelineKpis tiles={kpiTiles} />
          <HotLeadsList leads={topHot} />
          <QuickActionsGrid />
        </div>
      </div>
    </div>
  );
}
