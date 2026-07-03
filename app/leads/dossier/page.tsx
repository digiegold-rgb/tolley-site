import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPluginManifest } from "@/lib/dossier/plugins/registry";
import DossierList from "@/components/leads/DossierList";

export const revalidate = 300;

export default async function DossierPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const hasKeyAuth = key === process.env.SYNC_SECRET;

  if (!hasKeyAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      redirect("/login?callbackUrl=/leads/dossier");
    }
  }

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
    <>
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Lead Intelligence</h1>
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
    </>
  );
}
