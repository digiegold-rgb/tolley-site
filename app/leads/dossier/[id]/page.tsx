import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DossierView from "@/components/leads/DossierView";

export const revalidate = 300;

export default async function DossierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  const { id } = await params;
  const { key } = await searchParams;
  const hasKeyAuth = key === process.env.SYNC_SECRET;

  // Accept either sync key OR session auth
  if (!hasKeyAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      redirect("/login?callbackUrl=/leads/dossier");
    }
  }

  const job = await prisma.dossierJob.findUnique({
    where: { id },
    include: {
      listing: {
        include: {
          enrichment: true,
          leads: { take: 1, orderBy: { score: "desc" } },
        },
      },
      result: true,
    },
  });

  if (!job) redirect("/leads/dossier");

  // Serialize dates for client component
  const serializedJob = {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <a
          href="/leads/dossier"
          className="text-sm text-blue-400 hover:underline mb-4 inline-block"
        >
          &larr; Back to dossiers
        </a>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <DossierView job={serializedJob as any} syncKey={key || ""} />
      </div>
    </div>
  );
}
