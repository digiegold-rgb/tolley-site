import { redirect } from "next/navigation";
import { auth } from "@/auth";
import WorkflowEditor from "@/components/leads/WorkflowEditor";

export default async function WorkflowPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/leads/workflow");
  }

  return (
    <>
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
    </>
  );
}
