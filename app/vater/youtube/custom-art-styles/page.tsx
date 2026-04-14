/**
 * /vater/youtube/custom-art-styles — manage user's CustomArtStyle library.
 *
 * Each CustomArtStyle is a name + 3-5 reference images + an 800-char
 * Gemini-Flash-generated descriptor. Used as the art-style argument inside
 * scene image prompts: "Make sure the art style looks like this: '...'"
 *
 * Once created, attach to a Style via the Style editor's Visual Defaults
 * section.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CustomArtStyleGallery } from "@/components/vater/styles/CustomArtStyleGallery";

export const dynamic = "force-dynamic";

export default async function CustomArtStylesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/vater/youtube/custom-art-styles");
  }

  const items = await prisma.customArtStyle.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { styles: true } } },
  });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Custom Art Styles</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Upload 3-5 reference images. Gemini Flash analyzes them and writes
            an 800-char hex-coded art-style descriptor that gets injected into
            every scene prompt.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/vater/youtube/styles"
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            ← Styles
          </Link>
        </div>
      </header>
      <CustomArtStyleGallery items={items} />
    </div>
  );
}
