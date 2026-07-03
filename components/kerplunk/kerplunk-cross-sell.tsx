import Link from "next/link";

export function KerplunkCrossSell() {
  return (
    <section className="rounded-xl border border-[#c8a84e]/20 bg-gradient-to-br from-[#c8a84e]/[0.06] to-[#180d28] p-6 sm:p-8">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-wide text-[#c8a84e] uppercase sm:text-3xl">
            Planning a Party?
          </h2>
          <p className="mt-2 max-w-lg text-sm font-light leading-relaxed text-slate-400">
            Grab tables &amp; chairs for your event — folding tables from $5/day and
            bundle deals for table + 4 chairs. We&rsquo;ve also got a generator to
            power anything outdoors.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/tables"
            className="inline-flex items-center gap-2 rounded-lg border border-[#c8a84e]/30 bg-[#c8a84e]/[0.1] px-6 py-3 font-bold tracking-wide text-[#c8a84e] uppercase transition-all hover:border-[#c8a84e]/50 hover:bg-[#c8a84e]/[0.15]"
          >
            Tables & Chairs
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <Link
            href="/generator"
            className="inline-flex items-center gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/[0.1] px-6 py-3 font-bold tracking-wide text-yellow-400 uppercase transition-all hover:border-yellow-400/50 hover:bg-yellow-400/[0.15]"
          >
            Generator
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
