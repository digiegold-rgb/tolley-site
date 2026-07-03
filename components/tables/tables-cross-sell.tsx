import Link from "next/link";

export function TablesCrossSell() {
  return (
    <section className="rounded-xl border border-[#e040a0]/20 bg-gradient-to-br from-[#e040a0]/[0.06] to-[#0c1e14] p-6 sm:p-8">
      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-wide text-[#e040a0] uppercase sm:text-3xl">
            Make It a Party
          </h2>
          <p className="mt-2 max-w-lg text-sm font-light leading-relaxed text-slate-400">
            Add Giant Kerplunk to your event &mdash; the life-sized party game everyone loves.
            Or grab a folding picnic table for outdoor seating.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/kerplunk"
            className="inline-flex items-center gap-2 rounded-lg border border-[#e040a0]/30 bg-[#e040a0]/[0.1] px-6 py-3 font-bold tracking-wide text-[#e040a0] uppercase transition-all hover:border-[#e040a0]/50 hover:bg-[#e040a0]/[0.15] hover:text-[#e88dc0]"
          >
            Giant Kerplunk
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
          <Link
            href="/picnic-table"
            className="inline-flex items-center gap-2 rounded-lg border border-[#c4a56e]/30 bg-[#c4a56e]/[0.1] px-6 py-3 font-bold tracking-wide text-[#c4a56e] uppercase transition-all hover:border-[#c4a56e]/50 hover:bg-[#c4a56e]/[0.15]"
          >
            Picnic Table
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
