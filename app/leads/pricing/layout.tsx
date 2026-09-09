import Link from "next/link";
export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0a0814] text-white">
    <nav aria-label="Pricing navigation" className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
      <Link href="/agent">T-Agent</Link><Link href="/login?callbackUrl=/leads/pricing">Sign in</Link>
    </nav><main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
  </div>;
}
