import Link from "next/link";
import { validateWdAdmin } from "@/lib/wd-auth";
import { DiscoveryReport } from "@/components/discovery/report";
export const dynamic = "force-dynamic";
export const metadata = { title: "Discovery & Referrals | Growth HQ", robots: { index: false, follow: false } };
export default async function Page() {
  if (!(await validateWdAdmin()).authed) return <main className="p-8"><p>Sign in to Growth HQ to view referrals and revenue.</p><Link href="/hq">Open Growth HQ</Link></main>;
  return <main className="mx-auto max-w-6xl space-y-6 p-8"><Link href="/hq">← Growth HQ</Link><h1 className="text-3xl font-bold">Discovery & referrals</h1><DiscoveryReport /></main>;
}
