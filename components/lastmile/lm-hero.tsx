import Image from "next/image";

import {
  LM_COMPANY,
  LM_DELIVERIES,
  LM_FACEBOOK,
  LM_PHONE,
  LM_PHONE_RAW,
  LM_RATE,
  LM_STARS,
} from "@/lib/lastmile";

export function LmHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0d0808] via-[#150a0a] to-[#0d0808] pb-16 sm:pb-20">
      {/* Decorative glows */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-red-500/[0.07] blur-[100px]" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-amber-500/[0.05] blur-[90px]" />
        <div className="absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-red-600/[0.06] blur-[80px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
          {/* Hero image — mobile: above, desktop: right */}
          <div className="flex-shrink-0 lg:order-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-red-500/10 blur-2xl" />
              <Image
                src="/lastmile/jared-bobcat.jpg"
                alt="Jared with Bobcat on trailer — Red Alert Dispatch"
                width={440}
                height={440}
                className="relative rounded-2xl shadow-2xl"
                priority
              />
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 text-center lg:order-1 lg:text-left">
            {/* Eyebrow */}
            <p className="text-sm font-bold tracking-[0.4em] text-red-400/80 uppercase">
              {LM_COMPANY}
            </p>

            {/* Headline */}
            <h1 className="mt-5 text-6xl font-bold tracking-tight sm:text-7xl lg:text-8xl">
              <span className="lm-neon-text text-red-500">Fast.</span>
              <br />
              <span className="text-white">Done.</span>
            </h1>

            {/* Sub */}
            <p className="mt-4 max-w-md text-lg leading-relaxed text-neutral-400 lg:text-xl">
              Last-mile delivery for contractors &amp; businesses. Kansas City metro.
            </p>

            {/* Badges */}
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs font-bold tracking-widest uppercase lg:justify-start">
              <span className="lm-dispatch-pulse rounded border border-amber-500/40 bg-amber-500/[0.12] px-3 py-1.5 text-amber-300">
                {LM_RATE}
              </span>
              <span className="rounded border border-red-500/25 bg-red-500/[0.08] px-3 py-1.5 text-red-300">
                {LM_DELIVERIES} Deliveries
              </span>
              <span className="rounded border border-amber-400/25 bg-amber-400/[0.08] px-3 py-1.5 text-amber-300">
                {LM_STARS} Stars
              </span>
              <span className="rounded border border-neutral-500/25 bg-neutral-500/[0.08] px-3 py-1.5 text-neutral-300">
                Available 24/7
              </span>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
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

            {/* Star rating */}
            <div className="mt-6 flex items-center justify-center gap-2 lg:justify-start">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <svg
                    key={i}
                    className={`h-4 w-4 ${i < Math.floor(LM_STARS) ? "text-yellow-400" : "text-yellow-400/40"}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm font-medium text-neutral-400">
                {LM_STARS} — {LM_DELIVERIES} deliveries &middot; {LM_PHONE}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Angular SVG divider — sharp/urgency feel */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          className="block h-[40px] w-full sm:h-[60px]"
        >
          <path
            d="M0,60 L0,40 L720,0 L1440,40 L1440,60 Z"
            fill="#0d0808"
          />
          <path
            d="M0,40 L720,0 L1440,40"
            fill="none"
            stroke="rgba(239,68,68,0.2)"
            strokeWidth="1"
          />
        </svg>
      </div>
    </section>
  );
}
