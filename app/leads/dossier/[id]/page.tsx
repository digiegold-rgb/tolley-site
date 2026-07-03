import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DossierView from "@/components/leads/DossierView";

// Always fetch fresh — the client polls the GET API for live progress, but
// the initial SSR render must reflect current pipeline state.
export const revalidate = 0;

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

  const serializedJob = {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
  };

  return (
    <>
      <a
        href="/leads/dossier"
        className="text-sm text-blue-400 hover:underline mb-4 inline-block"
      >
        &larr; Back to dossiers
      </a>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <DossierView job={serializedJob as any} syncKey={key || ""} />
    </>
  );
}
