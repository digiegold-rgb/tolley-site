/**
 * /vater/youtube/styles — Styles gallery
 *
 * Lists user-owned + system YouTubeStyle rows. System rows are immutable
 * but cloneable. Each card shows name, voice, ref count, character count,
 * and a quick edit/clone CTA.
 *
 * Phase 2 ships a functional list + editor; visual polish (TubeGen
 * screenshot parity) is Phase 2B.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StylesGallery } from "@/components/vater/styles/StylesGallery";

export const dynamic = "force-dynamic";

export default async function StylesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/vater/youtube/styles");
  }

  const styles = await prisma.youTubeStyle.findMany({
    where: {
      OR: [{ userId: session.user.id }, { isSystem: true }],
    },
    include: {
      _count: { select: { characters: true } },
    },
    orderBy: [{ isSystem: "asc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Styles</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Reusable container for voice, references, characters, and visual defaults.
            Pick one when starting a project.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/vater/youtube"
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            ← Back to Studio
          </Link>
        </div>
      </header>
      <StylesGallery styles={styles} userId={session.user.id} />
    </div>
  );
}
