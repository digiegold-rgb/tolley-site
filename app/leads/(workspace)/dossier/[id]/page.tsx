import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { secretEquals } from "@/lib/secret-compare";
import { isAdminEmail } from "@/lib/admin-auth";
import { requireLeadSubscriber } from "@/lib/lead-subscriber";
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
  const hasKeyAuth = secretEquals(key, process.env.SYNC_SECRET);
  const session = await auth();
  const canEdit = hasKeyAuth || Boolean(session?.user?.id && isAdminEmail(session.user.email) && !session.impersonatedBy);

  if (!hasKeyAuth) {
    if (!session?.user?.id) {
      redirect("/login?callbackUrl=/leads/dossier");
    }
    if (!canEdit) await requireLeadSubscriber();
  }

  const job = await prisma.dossierJob.findUnique({
    where: { id },
    include: {
      listing: {
        include: {
          enrichment: true,
          leads: { where: { ownerSubscriberId: null, OR: [{ source: null }, { source: { not: "fsbo_manual" } }] }, select: { score: true }, take: 1, orderBy: { score: "desc" } },
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
      <Link
        href="/leads/dossier"
        className="text-sm text-blue-400 hover:underline mb-4 inline-block"
      >
        &larr; Back to dossiers
      </Link>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <DossierView canEdit={canEdit} job={serializedJob as any} syncKey={hasKeyAuth ? key! : ""} />
    </>
  );
}
