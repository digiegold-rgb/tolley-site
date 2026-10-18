import Link from "next/link";
import { validateWdAdmin } from "@/lib/wd-auth";
import { Operations } from "@/components/company/operations";
export const dynamic = "force-dynamic";
export const metadata = { title: "Company Operations | Tolley HQ", robots: { index: false, follow: false } };
export default async function Page() {
  if (!(await validateWdAdmin()).authed) return <main className="p-8"><Link href="/hq">Sign in to Growth HQ to view company operations.</Link></main>;
  return <main className="mx-auto max-w-6xl space-y-6 p-6"><Link href="/hq">← Growth HQ</Link><h1 className="text-3xl font-semibold">Company operations</h1><Operations /></main>;
}
