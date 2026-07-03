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
    <>
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
    </>
  );
}
