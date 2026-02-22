import type { SearchResponse } from "@/types/search";

type SearchResultsPanelProps = {
  result: SearchResponse;
};

function SectionList({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-[0.14em] text-violet-100/85 uppercase">
        {title}
      </h3>
      <ul className="space-y-2 text-sm leading-6 text-white/84 sm:text-[0.93rem]">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-[0.58rem] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-200/75" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SearchResultsPanel({ result }: SearchResultsPanelProps) {
  return (
    <section className="results-panel mt-7 w-full rounded-3xl p-5 sm:mt-8 sm:p-7">
      <header className="border-b border-white/14 pb-5">
        <p className="mb-2 text-[0.69rem] tracking-[0.28em] text-violet-100/80 uppercase">
          T-Agent Response
        </p>
        <h2 className="text-xl leading-tight font-semibold text-white/95 sm:text-[1.62rem]">
          {result.title}
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/82 sm:text-[0.98rem]">
          {result.summary}
        </p>
      </header>

      <div className="mt-6 space-y-7">
        <SectionList title="Highlights" items={result.highlights} />

        {result.vendors?.length ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold tracking-[0.14em] text-violet-100/85 uppercase">
              Vendors
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {result.vendors.map((vendor) => (
                <article
                  key={vendor.name}
                  className="rounded-2xl border border-white/12 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white/84"
                >
                  <h4 className="text-[0.92rem] font-semibold text-white/93">
                    {vendor.name}
                  </h4>
                  <p className="mt-1 text-white/74">{vendor.specialty}</p>
                  <p className="mt-2 text-white/72">
                    <span className="font-semibold text-white/88">Why: </span>
                    {vendor.note}
                  </p>
                  <p className="mt-1 text-white/72">
                    <span className="font-semibold text-white/88">Timing: </span>
                    {vendor.eta}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {result.steps?.length ? <SectionList title="Next Steps" items={result.steps} /> : null}
        {result.checklist?.length ? (
          <SectionList title="Checklist" items={result.checklist} />
        ) : null}
      </div>

      <footer className="mt-7 flex flex-wrap gap-3 border-t border-white/14 pt-5">
        <button
          type="button"
          className="action-chip cursor-not-allowed rounded-full px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/75 uppercase"
          aria-disabled="true"
        >
          Share
        </button>
        <button
          type="button"
          className="action-chip cursor-not-allowed rounded-full px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/75 uppercase"
          aria-disabled="true"
        >
          Save
        </button>
        <button
          type="button"
          className="action-chip cursor-not-allowed rounded-full px-4 py-2 text-xs font-semibold tracking-[0.12em] text-white/75 uppercase"
          aria-disabled="true"
        >
          Revise
        </button>
      </footer>
    </section>
  );
}
