import { requireAdminPageSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { RoutineInbox } from "@/components/admin/routine-inbox";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const session = await requireAdminPageSession("/admin/routines");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const briefs = await prisma.routineBrief.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const unreadCount = briefs.filter((b) => !b.readAt).length;

  return (
    <main className="portal-shell ambient-noise relative min-h-screen overflow-hidden px-5 py-8 sm:px-8">
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      <section className="relative z-20 mx-auto w-full max-w-4xl">
        <header className="mb-5 rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-2xl">
          <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
            t-agent routines
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white/95">Routine Inbox</h1>
          <p className="mt-2 text-sm text-white/72">
            Briefs from scheduled cloud agents · last 7 days · {briefs.length} total
            {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}. Logged in as {session.email}.
          </p>
        </header>

        <RoutineInbox
          initialBriefs={briefs.map((b) => ({
            id: b.id,
            slug: b.slug,
            title: b.title,
            body: b.body,
            severity: b.severity,
            readAt: b.readAt ? b.readAt.toISOString() : null,
            createdAt: b.createdAt.toISOString(),
          }))}
        />
      </section>
    </main>
  );
}
