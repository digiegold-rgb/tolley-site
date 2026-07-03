import Link from "next/link";

export function HpCta() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(129,75,229,0.1)),rgba(8,7,15,0.58)] p-10 text-center shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-16">
        {/* Background radial glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(139,92,246,0.12),transparent_70%)]"
        />

        <div className="relative z-10">
          <h2 className="text-3xl font-semibold tracking-[0.02em] text-white/95 sm:text-4xl">
            Ready to close more deals?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-white/72">
            Stop guessing. Start knowing. T-Agent gives you the intelligence to
            reach the right leads at the right time.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3 max-w-2xl mx-auto">
            <Link
              href="/tools/lead-follow-up-audit"
              className="flex flex-col items-center rounded-2xl border border-white/18 bg-white/[0.06] px-5 py-4 text-left transition-all hover:bg-white/[0.1] hover:border-white/28"
            >
              <span className="text-xs tracking-[0.1em] text-white/52 uppercase">Free Tool</span>
              <span className="mt-1.5 text-sm font-semibold text-white/90">Take the Free Audit</span>
              <span className="mt-1 text-xs text-white/52">Score your follow-up strategy</span>
            </Link>
            <Link
              href="/leads/pricing"
              className="flex flex-col items-center rounded-2xl border border-violet-200/45 bg-violet-300/20 px-5 py-4 text-left shadow-[0_0_32px_rgba(139,92,246,0.2)] transition-all hover:bg-violet-300/28 hover:shadow-[0_0_48px_rgba(139,92,246,0.35)]"
            >
              <span className="text-xs tracking-[0.1em] text-violet-200/70 uppercase">Most Popular</span>
              <span className="mt-1.5 text-sm font-semibold text-violet-50">See Plans — $49/mo</span>
              <span className="mt-1 text-xs text-violet-200/60">7-day free trial, no card needed</span>
            </Link>
            <a
              href="mailto:support@tolley.io?subject=T-Agent%20Demo%20Request"
              className="flex flex-col items-center rounded-2xl border border-white/18 bg-white/[0.06] px-5 py-4 text-left transition-all hover:bg-white/[0.1] hover:border-white/28"
            >
              <span className="text-xs tracking-[0.1em] text-white/52 uppercase">Talk to Us</span>
              <span className="mt-1.5 text-sm font-semibold text-white/90">Book a Demo</span>
              <span className="mt-1 text-xs text-white/52">15-min walkthrough, no pitch</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
