import Link from "next/link";
import type { ReactNode } from "react";

export default function ToolsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="portal-shell ambient-noise relative min-h-screen overflow-hidden bg-[#08070f]">
      {/* Background effects */}
      <div aria-hidden="true" className="hp-dot-grid pointer-events-none fixed inset-0 z-0" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-left" />
      <div aria-hidden="true" className="portal-spotlight portal-spotlight-right" />

      {/* Navbar */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-center px-4 pt-4">
        <div className="flex w-full max-w-5xl items-center justify-between rounded-full border border-white/18 bg-black/35 px-5 py-2.5 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[0.72rem] font-medium tracking-[0.42em] text-white/90 uppercase">
              t-agent
            </span>
          </Link>
          <div className="hidden items-center gap-5 md:flex">
            <Link href="/tools/missed-call-calculator" className="text-xs tracking-[0.1em] text-white/60 uppercase transition hover:text-white">
              Calculator
            </Link>
            <Link href="/tools/lead-follow-up-audit" className="text-xs tracking-[0.1em] text-white/60 uppercase transition hover:text-white">
              Audits
            </Link>
            <Link href="/blog" className="text-xs tracking-[0.1em] text-white/60 uppercase transition hover:text-white">
              Blog
            </Link>
          </div>
          <Link
            href="/leads/pricing"
            className="rounded-full border border-violet-200/45 bg-violet-300/20 px-5 py-2 text-xs font-semibold tracking-[0.1em] text-violet-50 uppercase transition hover:bg-violet-300/28"
          >
            Start Free — $49/mo
          </Link>
        </div>
      </nav>

      {/* Page content */}
      <main className="relative z-10 pt-24 pb-24">
        {children}
      </main>

      {/* Footer CTA */}
      <footer className="relative z-10 border-t border-white/10 bg-black/30 px-5 py-10 text-center">
        <p className="text-sm text-white/60">
          T-Agent automatically handles the gaps that kill your conversion rate.
        </p>
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/leads/pricing"
            className="rounded-full border border-violet-200/45 bg-violet-300/20 px-8 py-3 text-sm font-semibold tracking-[0.1em] text-violet-50 uppercase shadow-[0_0_24px_rgba(139,92,246,0.2)] transition hover:bg-violet-300/28"
          >
            Start 7-Day Free Trial
          </Link>
          <Link
            href="/leads/demo"
            className="rounded-full border border-white/18 bg-white/[0.05] px-8 py-3 text-sm font-semibold tracking-[0.1em] text-white/80 uppercase transition hover:bg-white/[0.1]"
          >
            See the Demo
          </Link>
        </div>
        <p className="mt-4 text-xs text-white/35">No credit card required during trial · Cancel anytime</p>
        <div className="mt-6 flex items-center justify-center gap-6">
          <Link href="/" className="text-xs tracking-[0.08em] text-white/40 uppercase hover:text-white/70">Home</Link>
          <Link href="/blog" className="text-xs tracking-[0.08em] text-white/40 uppercase hover:text-white/70">Blog</Link>
          <Link href="/leads/demo" className="text-xs tracking-[0.08em] text-white/40 uppercase hover:text-white/70">Demo</Link>
          <Link href="/privacy" className="text-xs tracking-[0.08em] text-white/40 uppercase hover:text-white/70">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
