"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { OWNER_TOOLS } from "@/lib/leads/owner-tools";

export default function ToolNavigation() {
  const pathname = usePathname();
  const active = OWNER_TOOLS.find(tool => pathname === `/leads/tools/${tool.slug}`);
  return <div className="mb-6 space-y-3">
    <nav aria-label="Owner workspace" className="flex flex-wrap gap-4 text-sm text-teal-200">
      <Link href="/leads">Today</Link>
      <Link href="/leads/tools" aria-current={pathname === "/leads/tools" ? "page" : undefined}>All owner tools</Link>
      <Link href="/leads/pipeline">Pipeline</Link>
      <Link href="/leads/clients">Contacts</Link>
    </nav>
    {active && <nav aria-label={active.group} className="flex flex-wrap gap-2">
      {OWNER_TOOLS.filter(tool => tool.group === active.group).map(tool => <Link key={tool.slug} href={`/leads/tools/${tool.slug}`} aria-current={tool === active ? "page" : undefined} className={`rounded-lg border px-3 py-2 text-sm ${tool === active ? "border-teal-300/40 bg-teal-300/10 text-teal-200" : "border-white/10 text-white/65"}`}>{tool.label}</Link>)}
    </nav>}
  </div>;
}
