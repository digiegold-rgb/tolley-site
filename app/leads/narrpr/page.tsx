import { redirect } from "next/navigation";
import { auth } from "@/auth";
import NarrprUpload from "@/components/leads/NarrprUpload";
import NarrprDashboard from "./NarrprDashboard";

export const revalidate = 300;

export default async function NarrprPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const hasKeyAuth = key === process.env.SYNC_SECRET;

  if (!hasKeyAuth) {
    const session = await auth();
    if (!session?.user?.id) {
      redirect("/login?callbackUrl=/leads/narrpr");
    }
  }

  const syncKey = key || process.env.SYNC_SECRET || "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Nav */}
        <nav className="flex items-center gap-1 mb-6 flex-wrap">
          <a href="/leads/dashboard" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">
            Leads
          </a>
          <span className="text-white/20">/</span>
          <a href="/leads/dossier" className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">
            Dossiers
          </a>
          <span className="text-white/20">/</span>
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-orange-300 bg-orange-500/10">
            NARRPR
          </span>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">NARRPR Integration</h1>
          <p className="text-white/40 text-sm mt-1">
            Import data from Realtors Property Resource — mortgage records, RVM, demographics, distress
          </p>
        </div>

        {/* Bookmarklet Install */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-6 mb-6">
          <h2 className="text-sm font-medium text-white/60 mb-3">Bookmarklet (Property Detail Page Scraper)</h2>
          <p className="text-xs text-white/40 mb-4">
            Drag this button to your bookmarks bar. When viewing a property on narrpr.com, click it to send the data to Tolley.io.
          </p>
          <div className="flex items-center gap-4">
            <a
              href={`javascript:void(function(){var s=document.createElement('script');s.src='${process.env.NEXT_PUBLIC_APP_URL || 'https://tolley.io'}/narrpr-bookmarklet.js?t='+Date.now()+'&token=${syncKey}';document.body.appendChild(s)})();`}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white cursor-grab active:cursor-grabbing select-none"
              onClick={(e) => { e.preventDefault(); alert("Drag this to your bookmarks bar!"); }}
              draggable
            >
              NARRPR → Tolley.io
            </a>
            <span className="text-xs text-white/30">Drag to bookmarks bar</span>
          </div>
          <div className="mt-4 rounded-lg bg-black/30 p-3">
            <p className="text-xs text-white/30 mb-1">Manual token (for bookmarklet):</p>
            <code className="text-xs text-orange-300/60 break-all select-all">{syncKey}</code>
          </div>
        </div>

        {/* Import Stats */}
        <NarrprDashboard syncKey={syncKey} />

        {/* CSV Upload */}
        <div className="mt-6">
          <NarrprUpload />
        </div>
      </div>
    </div>
  );
}
