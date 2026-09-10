import Link from "next/link";
import { requireOwnerTool } from "@/lib/leads/owner-tool-auth";
import { OWNER_TOOLS } from "@/lib/leads/owner-tools";

export default async function OwnerToolsPage() {
  await requireOwnerTool("/leads/tools");
  return <div className="space-y-8">
    <header><h1 className="text-2xl font-semibold">Your business tools</h1><p className="mt-2 max-w-2xl text-white/65">Research opportunities, manage visibility, and run your sales operations from T-Agent. These tools manage your businesses and are available to owner accounts.</p></header>
    {[...new Set(OWNER_TOOLS.map(tool => tool.group))].map(group => <section key={group}>
      <h2 className="mb-3 text-lg font-semibold">{group}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{OWNER_TOOLS.filter(tool => tool.group === group).map(tool => <Link key={tool.slug} href={`/leads/tools/${tool.slug}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-teal-300/40">
        <h3 className="font-medium text-teal-200">{tool.label}</h3><p className="mt-2 text-sm text-white/60">{tool.description}</p>
      </Link>)}</div>
    </section>)}
  </div>;
}
