import { HM_SERVICES, HM_URE_URL } from "@/lib/homes";

function ServiceIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "key":
      return (
        <svg className="h-8 w-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
        </svg>
      );
    case "sign":
      return (
        <svg className="h-8 w-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
        </svg>
      );
    case "chart":
      return (
        <svg className="h-8 w-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941" />
        </svg>
      );
    default:
      return null;
  }
}

export function HomesServices() {
  return (
    <section>
      <h3 className="text-center text-xl font-extrabold tracking-wide text-white uppercase sm:text-left">
        How I Can Help
      </h3>

      <div className="mt-6 grid gap-5 sm:grid-cols-3">
        {HM_SERVICES.map((service) => (
          <div
            key={service.title}
            className="homes-card rounded-xl border border-sky-500/10 bg-neutral-900/40 p-6 text-center"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/10">
              <ServiceIcon icon={service.icon} />
            </div>
            <h4 className="mt-4 text-lg font-bold text-white">{service.title}</h4>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{service.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <a
          href={HM_URE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="homes-glow inline-flex items-center gap-3 rounded-lg bg-sky-500 px-8 py-3.5 text-lg font-extrabold tracking-wide text-white uppercase transition-all hover:-translate-y-0.5"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          Browse All Listings
        </a>
      </div>
    </section>
  );
}
