/**
 * Post-generation scene editor route for vater/youtube.
 *
 * Server component — loads the YouTubeProject row from Prisma, enforces
 * auth, and hands it to the EditorShell client component. Any edits inside
 * the editor go through /api/vater/youtube/[id]/* route handlers.
 */
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EditorShell } from "@/components/vater/editor/EditorShell";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function VaterYoutubeEditPage({
  params,
}: {
  params: Params;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/vater/youtube");
  }

  const { id } = await params;

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      sourceTitle: true,
      topic: true,
      status: true,
      audioUrl: true,
      audioDuration: true,
      scenesJson: true,
      captionTimings: true,
      finalVideoUrl: true,
      autopilotJobId: true,
    },
  });

  if (!project) notFound();

  return (
    <main className="min-h-screen bg-black pb-12 pt-6 text-zinc-100">
      <EditorShell project={project} />
    </main>
  );
}
