import Link from "next/link";
import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";
import GrowthReport from "./report";
export const dynamic = "force-dynamic";
export const metadata = { title: "Daily Growth | HQ", robots: { index: false, follow: false } };
export default async function Page() {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=/hq/growth");
  return <main className="mx-auto max-w-7xl p-6 space-y-6"><Link href="/hq">← HQ</Link><h1 className="text-3xl font-bold">What growth did today</h1><p>Published work, results, and the reasons something didn’t happen. All dates are Central.</p><GrowthReport /></main>;
}
