import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ConversationsPanel from "@/components/leads/ConversationsPanel";

export const revalidate = 30;

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/leads/conversations");
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

  const params = await searchParams;
  const syncKey = params.key || "";

  const [conversations, stats, totalMessages] = await Promise.all([
    prisma.smsConversation.findMany({
      where: sub.id ? { subscriberId: sub.id } : {},
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    }),
    prisma.smsConversation.groupBy({
      by: ["status"],
      where: sub.id ? { subscriberId: sub.id } : {},
      _count: { id: true },
    }),
    prisma.smsMessage.count({
      where: sub.id
        ? { conversation: { subscriberId: sub.id } }
        : {},
    }),
  ]);

  const serialized = conversations.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    messages: c.messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  }));

  const statusCounts: Record<string, number> = {};
  for (const s of stats) {
    statusCounts[s.status] = s._count.id;
  }

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a
            href={`/leads/dashboard${syncKey ? `?key=${syncKey}` : ""}`}
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Leads
          </a>
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
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">
            Conversations
          </span>
          <span className="text-white/20">/</span>
          <a
            href="/leads/sequences"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Sequences
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/connects"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Connects
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/analytics"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Analytics
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/workflow"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Workflow
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/snap"
            className="rounded-lg px-3 py-1.5 text-sm text-purple-300/70 hover:text-purple-200 hover:bg-purple-500/10 transition-colors"
          >
            Snap & Know
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/markets"
            className="rounded-lg px-3 py-1.5 text-sm text-cyan-300/70 hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
          >
            Markets
          </a>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-white">SMS Conversations</h1>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-3 py-0.5 text-xs font-medium text-purple-300 capitalize">
              {sub.tier}
            </span>
            <span className="text-xs text-white/40">
              {sub.smsUsed}/{sub.smsLimit} SMS used
            </span>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-3 text-xs text-white/40 mb-6">
          <span>{conversations.length} conversations</span>
          <span>|</span>
          <span>{totalMessages} total messages</span>
          {statusCounts.active && (
            <>
              <span>|</span>
              <span className="text-green-400/70">{statusCounts.active} active</span>
            </>
          )}
          {statusCounts.paused && (
            <>
              <span>|</span>
              <span className="text-yellow-400/70">{statusCounts.paused} paused</span>
            </>
          )}
          {statusCounts.opted_out && (
            <>
              <span>|</span>
              <span className="text-red-400/70">{statusCounts.opted_out} opted out</span>
            </>
          )}
        </div>

        <ConversationsPanel
          conversations={serialized}
          syncKey={syncKey}
        />
      </div>
    </div>
  );
}
