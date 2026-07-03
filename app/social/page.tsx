import { requireAdminPageSession } from "@/lib/admin-auth";
import { SocialDashboard } from "./social-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Social Suite | Tolley",
  description: "Unified control plane for social posting across all platforms",
  robots: { index: false, follow: false },
};

export default async function SocialPage() {
  const session = await requireAdminPageSession("/social");

  return (
    <main className="min-h-screen bg-[#0a0a0f] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-white/10 bg-white/5 px-6 py-5 backdrop-blur">
          <p className="text-xs font-semibold tracking-widest text-white/50 uppercase">Social Suite</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Unified Posting Dashboard</h1>
          <p className="mt-1 text-sm text-white/50">
            One control plane for FB, IG, Pinterest, YouTube, TikTok &mdash; logged in as {session.email}
          </p>
        </header>
        <SocialDashboard />
      </div>
    </main>
  );
}
