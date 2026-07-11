import { OpenClawAdminConsole } from "@/components/admin/openclaw-admin-console";
import { requireAdminPageSession } from "@/lib/admin-auth";

export default async function AdminPage() {
  const session = await requireAdminPageSession("/admin");

  return (
    <main className="portal-shell ambient-noise relative min-h-screen overflow-hidden px-5 py-8 sm:px-8">
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      <section className="relative z-20 mx-auto w-full max-w-6xl">
        <header className="mb-5 rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-2xl">
          <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
            t-agent admin
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white/95">Connector Control</h1>
          <p className="mt-2 text-sm text-white/72">
            Logged in as {session.email}. Admin allowlist enforced server-side.
          </p>
          <a
            href="/admin/routines"
            className="mt-4 inline-flex items-center rounded-full bg-violet-500/20 px-4 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/30"
          >
            Routine Inbox — scheduled-agent briefs →
          </a>
          {/* Internal dashboards — these pages had no inbound link anywhere
              (URL-only reachable) until this strip. CTO audit 2026-07-06. */}
          <nav className="mt-4 flex flex-wrap gap-2">
            {[
              ["/hq", "HQ CRM"],
              ["/content", "Content"],
              ["/social", "Social"],
              ["/media", "Media"],
              ["/manus", "Manus"],
              ["/action", "Action Cam"],
              ["/tv", "TV Requests"],
              ["/credit", "Credit"],
              ["/trading", "Trading"],
              ["/gpu", "GPU"],
              ["/chat", "Chat"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75 hover:bg-white/10"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        <OpenClawAdminConsole />
      </section>
    </main>
  );
}
