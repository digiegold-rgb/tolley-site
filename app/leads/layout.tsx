import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import LeadsSidebar from "@/components/leads/LeadsSidebar";
import LeadsTopbar from "@/components/leads/LeadsTopbar";
import LeadsCommandProvider from "@/components/leads/LeadsCommandProvider";
import {
  LeadsRightRailProvider,
  LeadsRightRailSlot,
} from "@/components/leads/LeadsRightRail";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * T-Agent shell. Phase 2: sidebar + topbar + content + optional right rail.
 *
 * Auth is soft here — we fetch the session if one exists and pass tier/email/
 * quota to the topbar, but we do NOT redirect unauth users. Individual pages
 * like /leads/dashboard handle their own redirects; public pages like
 * /leads/demo and /leads/pricing keep working.
 */
export default async function LeadsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  let tier: string | null = null;
  let smsUsed: number | undefined;
  let smsLimit: number | undefined;

  if (userId) {
    const sub = await prisma.leadSubscriber.findUnique({
      where: { userId },
      select: {
        tier: true,
        status: true,
        smsUsed: true,
        smsLimit: true,
      },
    });
    if (sub?.status === "active") {
      tier = sub.tier;
      smsUsed = sub.smsUsed;
      smsLimit = sub.smsLimit;
    }
  }

  // Latest listing sync snapshot for the topbar. Best-effort — if the table
  // is empty this is just null.
  let lastSyncAt: string | null = null;
  let totalListings: number | undefined;
  try {
    const [latest, count] = await Promise.all([
      prisma.listing.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
      prisma.listing.count(),
    ]);
    if (latest?.updatedAt) lastSyncAt = latest.updatedAt.toISOString();
    totalListings = count;
  } catch {
    // table may not exist in certain preview branches — ignore
  }

  return (
    <ToastProvider>
      <LeadsCommandProvider>
        <LeadsRightRailProvider>
          <div className="min-h-screen bg-[#0a0814] text-white [background-image:radial-gradient(1200px_600px_at_80%_-10%,rgba(167,139,250,0.08),transparent_60%),radial-gradient(900px_500px_at_10%_10%,rgba(94,234,212,0.06),transparent_60%)]">
            <div className="flex">
              <LeadsSidebar tier={tier} />
              <div className="flex min-w-0 flex-1 flex-col">
                <LeadsTopbar
                  tier={tier}
                  smsUsed={smsUsed}
                  smsLimit={smsLimit}
                  userEmail={session?.user?.email ?? null}
                  lastSyncAt={lastSyncAt}
                  totalListings={totalListings}
                />
                <main className="flex-1 px-6 py-6">
                  <div className="mx-auto max-w-[1400px]">{children}</div>
                </main>
              </div>
              <LeadsRightRailSlot />
            </div>
          </div>
        </LeadsRightRailProvider>
      </LeadsCommandProvider>
    </ToastProvider>
  );
}
