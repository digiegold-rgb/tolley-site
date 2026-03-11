import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/settings");
  }

  const [user, sub] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, createdAt: true },
    }),
    prisma.leadSubscriber.findUnique({
      where: { userId: session.user.id },
      select: {
        tier: true,
        status: true,
        smsUsed: true,
        smsLimit: true,
        snapUsed: true,
        snapLimit: true,
        onboarded: true,
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold text-white mb-8">Account Settings</h1>

        {/* Profile */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 mb-6">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">Profile</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/40">Name</span>
              <span className="text-sm text-white/90">{user?.name || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/40">Email</span>
              <span className="text-sm text-white/90">{user?.email || "—"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-white/40">Member since</span>
              <span className="text-sm text-white/90">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
          </div>
        </section>

        {/* Subscription */}
        {sub && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-6 mb-6">
            <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">Subscription</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/40">Plan</span>
                <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-3 py-0.5 text-xs font-medium text-purple-300 capitalize">
                  {sub.tier}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/40">Status</span>
                <span className={`text-sm ${sub.status === "active" ? "text-green-400" : "text-yellow-400"}`}>
                  {sub.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/40">SMS used</span>
                <span className="text-sm text-white/90">{sub.smsUsed} / {sub.smsLimit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/40">Snap & Know used</span>
                <span className="text-sm text-white/90">{sub.snapUsed} / {sub.snapLimit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/40">Onboarded</span>
                <span className="text-sm text-white/90">{sub.onboarded ? "Yes" : "No"}</span>
              </div>
            </div>
          </section>
        )}

        {/* Quick Links */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-6 mb-6">
          <h2 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/leads/dashboard"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20 hover:text-white transition-colors"
            >
              Lead Dashboard
            </Link>
            <Link
              href="/leads/dossier"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20 hover:text-white transition-colors"
            >
              Dossiers
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/20 hover:text-white transition-colors"
            >
              Plans & Billing
            </Link>
            {sub?.onboarded === false && (
              <Link
                href="/leads/onboard"
                className="rounded-lg bg-purple-600/30 px-4 py-2 text-sm text-purple-300 hover:bg-purple-600/50 transition-colors"
              >
                Complete Onboarding
              </Link>
            )}
          </div>
        </section>

        {/* Sign Out */}
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/20 transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </main>
  );
}
