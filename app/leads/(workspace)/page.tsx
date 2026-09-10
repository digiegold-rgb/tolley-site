import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin-auth";
import { loadDailyDesk } from "@/lib/leads/daily-desk";
import DailyDesk from "@/components/leads/daily/DailyDesk";
import OwnerWorkspaceSetup from "@/components/leads/daily/OwnerWorkspaceSetup";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TodayPage() {
  const session = await auth();
  if (session?.mfaRequired) redirect("/login/mfa-challenge?callbackUrl=%2Fleads");
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fleads");
  const owner = isAdminEmail(session.user.email);
  const sub = await prisma.leadSubscriber.findUnique({ where: { userId: session.user.id } });
  if (!sub || sub.status !== "active") {
    if (owner) return <OwnerWorkspaceSetup />;
    redirect("/leads/pricing");
  }
  if (!sub.onboarded && !owner) redirect("/leads/onboard");
  let data;
  try { data = await loadDailyDesk(sub.id, owner); } catch { data = null; }
  if (!data) {
    return <section className="mx-auto max-w-xl rounded-2xl border border-amber-300/25 p-8">
      <h1 className="text-2xl font-semibold">Your follow-ups could not load</h1>
      <p className="mt-3 text-white/65">Your saved work has not been cleared. Reload this page, or open your contacts while the connection recovers.</p>
      <div className="mt-5 flex gap-5"><Link href="/leads" className="text-teal-300 underline">Try again</Link><Link href="/leads/clients" className="text-teal-300 underline">Open contacts</Link></div>
    </section>;
  }
  return <DailyDesk data={data} owner={owner} />;
}
