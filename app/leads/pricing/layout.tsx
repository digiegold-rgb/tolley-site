import Link from "next/link";
import { auth } from "@/auth";

export default async function PricingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const href = session?.mfaRequired
    ? "/login/mfa-challenge?callbackUrl=%2Fleads"
    : session?.user?.id ? "/leads" : "/login?callbackUrl=%2Fleads";
  const label = session?.mfaRequired ? "Complete sign in" : session?.user?.id ? "Open T-Agent" : "Sign in";
  return <div className="min-h-screen bg-[#0a0814] text-white">
    <nav aria-label="Pricing navigation" className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
      <Link href="/agent">T-Agent</Link><Link href={href}>{label}</Link>
    </nav><main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
  </div>;
}
