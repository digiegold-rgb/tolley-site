import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ClientList from "@/components/clients/ClientList";

export const revalidate = 0;

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/leads/clients");
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
  });

  if (!sub || sub.status !== "active") {
    redirect("/leads/pricing");
  }

  const clients = await prisma.client.findMany({
    where: { subscriberId: sub.id },
    include: {
      notes: {
        orderBy: { createdAt: "desc" },
        take: 3,
      },
      triggerEvents: {
        orderBy: { occurredAt: "desc" },
      },
      _count: { select: { notes: true } },
    },
    orderBy: [{ fitScore: "desc" }, { updatedAt: "desc" }],
  });

  const serialized = clients.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    incomeEstimatedAt: c.incomeEstimatedAt?.toISOString() || null,
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
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6">
          <a
            href="/leads/dashboard"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Leads
          </a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">
            Clients
          </span>
          <span className="text-white/20">/</span>
          <a
            href="/leads/conversations"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Conversations
          </a>
        </nav>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Your Clients</h1>
            <p className="text-sm text-white/40 mt-1">
              Import and manage client profiles. The more you know, the better the match.
            </p>
          </div>
        </div>

        <ClientList clients={serialized} />
      </div>
    </div>
  );
}
