import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateProjectButton } from "./create-project-button";

export const dynamic = "force-dynamic";

export default async function VideoEditHomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/video/edit");
  }

  const projects = await prisma.videoProject.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      durationS: true,
      width: true,
      height: true,
      status: true,
      outputBlobUrl: true,
      updatedAt: true,
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-purple-400">
              Video editor
            </p>
            <h1 className="mt-1 text-4xl font-black tracking-tight text-white">
              Your projects
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Multi-track timeline editor — compose clips, layer narration, render to MP4.
            </p>
          </div>
          <CreateProjectButton />
        </div>

        {projects.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center">
            <p className="text-lg font-bold text-slate-200">No projects yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Click <span className="text-purple-300">New project</span> to start composing.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/video/edit/${p.id}`}
                className="group rounded-xl border border-slate-700/60 bg-slate-800/30 p-5 transition hover:border-purple-400/40 hover:bg-slate-800/60"
              >
                <p className="truncate text-base font-bold text-white">{p.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {p.width}×{p.height} · {p.durationS.toFixed(1)}s · {p.status}
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-wider text-slate-600">
                  Updated {new Date(p.updatedAt).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
