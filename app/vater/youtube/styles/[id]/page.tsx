import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StyleEditor } from "@/components/vater/styles/StyleEditor";
import { StyleEditorSimple } from "@/components/vater/styles/StyleEditorSimple";

export const dynamic = "force-dynamic";

type Ctx = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ simple?: string }>;
};

export default async function StyleEditPage({ params, searchParams }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin?callbackUrl=/vater/youtube/styles");
  }
  const { id } = await params;
  const { simple } = await searchParams;

  const style = await prisma.youTubeStyle.findUnique({
    where: { id },
    include: { characters: true, customArtStyle: true },
  });
  if (!style) notFound();
  if (style.userId && style.userId !== session.user.id) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-rose-400">Forbidden</h1>
        <p className="mt-2 text-sm text-zinc-400">
          This Style belongs to another user.
        </p>
      </div>
    );
  }

  const serialized = JSON.parse(JSON.stringify(style));

  // Default to simple view; ?simple=0 opts into the full editor
  const useSimple = simple !== "0";

  return useSimple ? (
    <StyleEditorSimple initialStyle={serialized} />
  ) : (
    <StyleEditor initialStyle={serialized} />
  );
}
