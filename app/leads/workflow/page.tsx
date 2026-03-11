import { redirect } from "next/navigation";
import { auth } from "@/auth";
import WorkflowEditor from "@/components/leads/WorkflowEditor";

export default async function WorkflowPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/leads/workflow");
  }

  return (
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-[1400px] px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a
            href="/leads/dashboard"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Leads
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/dossier"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Dossiers
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/clients"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Clients
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/conversations"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Conversations
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/sequences"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Sequences
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/connects"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Connects
          </a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">
            Workflow
          </span>
          <span className="text-white/20">/</span>
          <a
            href="/leads/snap"
            className="rounded-lg px-3 py-1.5 text-sm text-purple-300/70 hover:text-purple-200 hover:bg-purple-500/10 transition-colors"
          >
            Snap & Know
          </a>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Dossier Pipeline Workflow
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Visual DAG of the research pipeline — drag nodes, track status,
              execute jobs
            </p>
          </div>
        </div>

        {/* Editor fills remaining height */}
        <div className="rounded-xl border border-white/10 overflow-hidden" style={{ height: "calc(100vh - 220px)" }}>
          <WorkflowEditor />
        </div>
      </div>
    </div>
  );
}
