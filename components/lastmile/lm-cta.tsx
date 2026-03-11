import { LM_FACEBOOK, LM_PHONE, LM_PHONE_RAW, LM_RATE } from "@/lib/lastmile";

export function LmCta() {
  return (
    <section className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.08] to-amber-500/[0.04] p-8 text-center sm:p-12">
      <h2 className="lm-neon-text text-4xl font-bold tracking-tight text-red-500 sm:text-5xl">
        Ready to Dispatch?
      </h2>

      <a
        href={`tel:${LM_PHONE_RAW}`}
        className="mt-6 inline-block text-3xl font-bold tracking-wide text-white transition hover:text-red-400 sm:text-4xl"
      >
        {LM_PHONE}
      </a>

      <p className="mt-4 text-lg text-amber-300">
        Starting at {LM_RATE} — invoiced on request
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <a
          href={`tel:${LM_PHONE_RAW}`}
          className="lm-glow inline-flex items-center gap-3 rounded-lg bg-red-500 px-8 py-3.5 text-lg font-bold tracking-wide text-white uppercase transition-all hover:-translate-y-0.5 hover:bg-red-600"
        >
          <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
            <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1.003 1.003 0 011.01-.24c1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.1.31.03.66-.25 1.01l-2.2 2.21z" />
          </svg>
          Call Now
        </a>
        <a
          href={LM_FACEBOOK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-6 py-3.5 text-sm font-bold tracking-wide text-red-300 uppercase transition-all hover:border-red-500/50 hover:text-white"
        >
          <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Message on Facebook
        </a>
      </div>
    </section>
  );
}
