import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Project } from "@/lib/video-editor/types";
import { Editor } from "./editor";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function EditorPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/video/edit");
  }

  const { projectId } = await params;
  const project = await prisma.videoProject.findFirst({
    where: { id: projectId, userId: session.user.id },
  });
  if (!project) {
    notFound();
  }

  return (
    <Editor
      projectId={project.id}
      name={project.name}
      initialState={project.state as unknown as Project}
      status={project.status}
      outputBlobUrl={project.outputBlobUrl}
    />
  );
}
