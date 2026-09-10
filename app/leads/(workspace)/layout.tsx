import type { Metadata } from "next";
import Link from "next/link";
import { isAdminEmail } from "@/lib/admin-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withPrismaTimeout } from "@/lib/prisma-url";
import LeadsSidebar from "@/components/leads/LeadsSidebar";
import LeadsTopbar from "@/components/leads/LeadsTopbar";
import LeadsCommandProvider from "@/components/leads/LeadsCommandProvider";
import {
  LeadsRightRailProvider,
  LeadsRightRailSlot,
} from "@/components/leads/LeadsRightRail";
import { ToastProvider } from "@/components/ui/Toast";

// ~45 pages under /leads are app internals; noindex here keeps them all out
// of search. The two marketing pages (/leads/pricing, /leads/onboard) opt
// back in with their own metadata.robots.
export const metadata: Metadata = {
  title: "T-Agent Leads | Tolley",
  robots: { index: false, follow: false },
};

/* This layout always calls auth() and prisma.listing.count() — even for
 * signed-out visitors. Several children are ISR (revalidate 60/300/600), so
 * 1.16's SSG workers sat on Neon at 0/655. Do not prerender this tree.
 * Root force-dynamic is what hung 1.17 at collect-page-data; mark here. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const owner = Boolean(userId && !session?.mfaRequired && !session?.impersonatedBy && isAdminEmail(session?.user?.email));

  let tier: string | null = null;
  let smsUsed: number | undefined;
  let smsLimit: number | undefined;

  if (userId) {
    const sub = await withPrismaTimeout(
      prisma.leadSubscriber.findUnique({
        where: { userId },
        select: {
          tier: true,
          status: true,
          smsUsed: true,
          smsLimit: true,
        },
      }),
      null,
    );
    if (sub?.status === "active") {
      tier = sub.tier;
      smsUsed = sub.smsUsed;
      smsLimit = sub.smsLimit;
    }
  }

  // Latest listing sync snapshot for the topbar. Best-effort — if the table
  // is empty this is just null. listing.count() with no timeout is what sat
  // SSG workers at 0/655; fail the chrome stats fast, never the deploy.
  let lastSyncAt: string | null = null;
  let totalListings: number | undefined;
  try {
    const listingStats = await withPrismaTimeout(
      Promise.all([
        prisma.listing.findFirst({
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        }),
        prisma.listing.count(),
      ]),
      null,
    );
    if (listingStats) {
      const [latest, count] = listingStats;
      if (latest?.updatedAt) lastSyncAt = latest.updatedAt.toISOString();
      totalListings = count;
    }
  } catch {
    // table may not exist in certain preview branches — ignore
  }

  return (
    <ToastProvider>
      <LeadsCommandProvider owner={owner}>
        <LeadsRightRailProvider>
          <div className="min-h-screen bg-[#0a0814] text-white [background-image:radial-gradient(1200px_600px_at_80%_-10%,rgba(167,139,250,0.08),transparent_60%),radial-gradient(900px_500px_at_10%_10%,rgba(94,234,212,0.06),transparent_60%)]">
            <div className="flex">
              <LeadsSidebar tier={tier} owner={owner} />
              <div className="flex min-w-0 flex-1 flex-col">
                <LeadsTopbar
                  tier={tier}
                  smsUsed={smsUsed}
                  smsLimit={smsLimit}
                  userEmail={session?.user?.email ?? null}
                  lastSyncAt={lastSyncAt}
                  totalListings={totalListings}
                />
                <nav aria-label="Mobile workspace" className="flex flex-wrap gap-4 border-b border-white/10 px-4 py-3 text-sm text-white/75 md:hidden">
                  <Link href="/leads">Today</Link><Link href="/leads/pipeline">Pipeline</Link><Link href="/leads/people">People</Link><Link href="/leads/marketing">Marketing</Link><Link href="/leads/admin">Admin</Link>
                  {owner && <Link href="/leads/tools" className="text-teal-200">Business tools</Link>}
                </nav>
                <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
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
