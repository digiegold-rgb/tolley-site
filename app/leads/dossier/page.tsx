import { redirect } from "next/navigation";
import { auth } from "@/auth";
import DossierList from "@/components/leads/DossierList";

export const revalidate = 15; // ISR 15s

export default async function DossierPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const hasKeyAuth = key === process.env.SYNC_SECRET;

  // Accept either sync key OR session auth
  if (!hasKeyAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      redirect("/login?callbackUrl=/leads/dossier");
    }
  }

  // Fetch dossier jobs server-side
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/leads/dossier?limit=50`, {
    headers: { "x-sync-secret": process.env.SYNC_SECRET! },
    cache: "no-store",
  });

  const data = res.ok ? await res.json() : { jobs: [], total: 0, plugins: [] };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Lead Intelligence</h1>
            <p className="text-white/40 text-sm mt-1">
              Deep research dossiers — owner data, court records, social profiles
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="/leads/snap"
              className="rounded-lg bg-purple-600/20 border border-purple-500/30 px-4 py-2 text-sm text-purple-300 hover:bg-purple-600/30"
            >
              Snap & Know
            </a>
            <a
              href="/leads/dashboard"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Leads
            </a>
            <a
              href="/leads/conversations"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Conversations
            </a>
          </div>
        </div>

        {/* Plugin status */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-6">
          <h2 className="text-sm font-medium text-white/60 mb-2">Research Plugins</h2>
          <div className="flex flex-wrap gap-2">
            {data.plugins?.map((p: { name: string; label: string; enabled: boolean; configReady: boolean; estimatedDuration: string; category: string }) => (
              <span
                key={p.name}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  p.enabled && p.configReady
                    ? "bg-green-500/20 text-green-300"
                    : p.enabled
                      ? "bg-yellow-500/20 text-yellow-300"
                      : "bg-white/5 text-white/30"
                }`}
                title={`${p.label} (${p.category}) — ${p.estimatedDuration}${!p.configReady ? " — missing config" : ""}`}
              >
                {p.label} {p.enabled && p.configReady ? "" : p.enabled ? "(needs config)" : "(disabled)"}
              </span>
            ))}
          </div>
        </div>

        {/* Job list */}
        <DossierList
          jobs={data.jobs}
          total={data.total}
          syncKey={key || ""}
        />
      </div>
    </div>
  );
}
