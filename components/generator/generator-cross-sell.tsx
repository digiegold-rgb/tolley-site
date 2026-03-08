import Link from "next/link";

export function GeneratorCrossSell() {
  return (
    <section className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-[#0c1030] p-6 sm:p-8">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-wide text-amber-400 uppercase sm:text-3xl">
            Need a Trailer Too?
          </h2>
          <p className="mt-2 max-w-lg text-sm font-light leading-relaxed text-slate-400">
            We rent heavy-duty utility trailers &mdash; 18ft and 20ft, 7,000 lb
            capacity, dual axle. No plates needed. Perfect for hauling equipment
            to your job site or event.
          </p>
        </div>
        <Link
          href="/trailer"
          className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.1] px-6 py-3 font-bold tracking-wide text-amber-400 uppercase transition-all hover:border-amber-400/50 hover:bg-amber-500/[0.15] hover:text-amber-300"
        >
          View Trailers
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
