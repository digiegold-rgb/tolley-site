import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPluginManifest } from "@/lib/dossier/plugins/registry";
import DossierList from "@/components/leads/DossierList";

export const revalidate = 15; // ISR 15s

export default async function DossierPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const hasKeyAuth = key === process.env.SYNC_SECRET;

  // Accept either sync key OR session auth
  if (!hasKeyAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      redirect("/login?callbackUrl=/leads/dossier");
    }
  }

  // Fetch dossier jobs directly from DB (avoids self-fetch issues on Vercel)
  const [jobs, total] = await Promise.all([
    prisma.dossierJob.findMany({
      include: {
        listing: {
          select: {
            address: true,
            city: true,
            zip: true,
            listPrice: true,
            mlsId: true,
            photoUrls: true,
          },
        },
        result: {
          select: {
            motivationScore: true,
            motivationFlags: true,
            owners: true,
            entityType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.dossierJob.count(),
  ]);

  const data = {
    jobs: jobs.map((j) => ({
      ...j,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
      startedAt: j.startedAt?.toISOString() ?? null,
      completedAt: j.completedAt?.toISOString() ?? null,
    })),
    total,
    plugins: getPluginManifest(),
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a
            href="/leads/dashboard"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Leads
          </a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">
            Dossiers
          </span>
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
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lead Intelligence</h1>
            <p className="text-white/40 text-sm mt-1">
              Deep research dossiers — owner data, court records, social profiles
            </p>
          </div>
          <a
            href="/leads/narrpr"
            className="rounded-lg bg-orange-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 transition-colors flex items-center gap-2"
          >
            <span>NARRPR Import</span>
          </a>
        </div>

        {/* Plugin status */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-6">
          <h2 className="text-sm font-medium text-white/60 mb-2">Research Plugins</h2>
          <div className="flex flex-wrap gap-2">
            {data.plugins?.map((p: { name: string; label: string; enabled: boolean; configReady: boolean; estimatedDuration: string; category: string }) => (
              <span
                key={p.name}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  p.enabled && p.configReady
                    ? "bg-green-500/20 text-green-300"
                    : p.enabled
                      ? "bg-yellow-500/20 text-yellow-300"
                      : "bg-white/5 text-white/30"
                }`}
                title={`${p.label} (${p.category}) — ${p.estimatedDuration}${!p.configReady ? " — missing config" : ""}`}
              >
                {p.label} {p.enabled && p.configReady ? "" : p.enabled ? "(needs config)" : "(disabled)"}
              </span>
            ))}
          </div>
        </div>

        {/* Job list */}
        <DossierList
          jobs={data.jobs}
          total={data.total}
          syncKey={key || ""}
        />
      </div>
    </div>
  );
}
