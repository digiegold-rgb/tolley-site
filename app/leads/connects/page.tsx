import { auth } from "@/auth";
import { redirect } from "next/navigation";

const integrations = [
  {
    icon: "\ud83d\udcc4",
    name: "CSV Upload",
    description: "Upload spreadsheets from any source",
    status: "Active" as const,
    href: "/leads/dashboard",
  },
  {
    icon: "\ud83d\udfd9\ufe0f",
    name: "Google Sheets",
    description: "Connect a shared Google Sheet URL",
    status: "Coming Soon" as const,
  },
  {
    icon: "\ud83c\udfe0",
    name: "PropStream",
    description: "Import investor lists, absentee owners, pre-foreclosures",
    status: "Coming Soon" as const,
  },
  {
    icon: "\ud83d\udcca",
    name: "MLS Grid",
    description: "Pull expired, withdrawn, and FSBO listings from MLS",
    status: "Coming Soon" as const,
  },
  {
    icon: "\ud83d\ude97",
    name: "DealMachine",
    description: "Driving for dollars property lists",
    status: "Coming Soon" as const,
  },
  {
    icon: "\ud83d\udcde",
    name: "Follow Up Boss",
    description: "Sync leads from your CRM",
    status: "Coming Soon" as const,
  },
  {
    icon: "\ud83d\udce6",
    name: "Podio",
    description: "Import real estate investor deal pipelines",
    status: "Coming Soon" as const,
  },
  {
    icon: "\u2696\ufe0f",
    name: "Foreclosure.com",
    description: "Pre-foreclosure and auction lists",
    status: "Coming Soon" as const,
  },
  {
    icon: "\ud83c\udfdb\ufe0f",
    name: "County Tax Records",
    description: "Delinquent tax lists and absentee owners",
    status: "Coming Soon" as const,
  },
  {
    icon: "\u26a1",
    name: "Zapier",
    description: "Connect 5000+ apps via Zapier webhook",
    status: "Coming Soon" as const,
  },
];

export default async function ConnectsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/leads/connects");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e] text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
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
          <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-white/10">
            Connects
          </span>
          <span className="text-white/20">/</span>
          <a
            href="/leads/analytics"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Analytics
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/workflow"
            className="rounded-lg px-3 py-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            Workflow
          </a>
          <span className="text-white/20">/</span>
          <a
            href="/leads/snap"
            className="rounded-lg px-3 py-1.5 text-sm text-purple-300/70 hover:text-purple-200 hover:bg-purple-500/10 transition-colors"
          >
            Snap & Know
          </a>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Cloud Connects</h1>
          <p className="text-white/40 text-sm mt-1">
            Import addresses from your favorite tools
          </p>
        </div>

        {/* Info box */}
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-8">
          <p className="text-sm text-white/50">
            Have a data source you&apos;d like connected? Email{" "}
            <a
              href="mailto:support@tolley.io"
              className="text-purple-300 hover:text-purple-200 underline"
            >
              support@tolley.io
            </a>
          </p>
        </div>

        {/* Integration grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="rounded-xl bg-white/5 border border-white/10 p-5 flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{integration.icon}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    integration.status === "Active"
                      ? "bg-green-500/20 text-green-300"
                      : "bg-yellow-500/20 text-yellow-300"
                  }`}
                >
                  {integration.status}
                </span>
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                {integration.name}
              </h3>
              <p className="text-sm text-white/40 mb-4 flex-1">
                {integration.description}
              </p>
              {integration.status === "Active" && integration.href ? (
                <a
                  href={integration.href}
                  className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-medium text-white text-center transition-colors"
                >
                  Open
                </a>
              ) : (
                <button
                  disabled
                  className="rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white/30 text-center cursor-not-allowed"
                >
                  Coming Soon
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
