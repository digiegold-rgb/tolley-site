import Image from "next/image";

import {
  HVAC_BRAND,
  HVAC_PHONE,
  HVAC_PHONE_RAW,
  HVAC_FACEBOOK,
  HVAC_WEBSITE,
  HVAC_RATING,
  HVAC_REVIEW_COUNT,
} from "@/lib/hvac";

export function HvacHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#0a1628] via-[#0f1d35] to-[#0a1628] pb-16 sm:pb-20">
      {/* Decorative glows */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-cyan-400/[0.07] blur-[100px]" />
        <div className="absolute -bottom-24 right-1/3 h-72 w-72 rounded-full bg-orange-500/[0.05] blur-[80px]" />
        <div className="absolute top-1/2 right-1/4 h-64 w-64 rounded-full bg-cyan-400/[0.04] blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">
          {/* Mascot — mobile: above text */}
          <div className="flex-shrink-0 lg:order-2">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-cyan-400/10 blur-2xl" />
              <Image
                src="/hvac/mascot.jpg"
                alt="The Cool Guys yeti mascot"
                width={400}
                height={400}
                className="relative rounded-2xl shadow-2xl"
                priority
              />
            </div>
          </div>

          {/* Text content */}
          <div className="flex-1 text-center lg:order-1 lg:text-left">
            <p className="text-sm font-bold tracking-[0.4em] text-cyan-400/80 uppercase">
              {HVAC_BRAND}
            </p>

            <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              <span className="hvac-neon-text text-cyan-400">It&apos;s Time to Be Cool.</span>
              <br />
              <span className="text-white">Call The Cool Guys!</span>
            </h1>

            {/* Badges */}
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs font-bold tracking-widest uppercase lg:justify-start">
              <span className="hvac-emergency-badge rounded border border-orange-500/40 bg-orange-500/[0.12] px-3 py-1.5 text-orange-300">
                Open 24/7
              </span>
              <span className="rounded border border-cyan-400/25 bg-cyan-400/[0.08] px-3 py-1.5 text-cyan-300">
                10+ Years
              </span>
              <span className="rounded border border-cyan-400/25 bg-cyan-400/[0.08] px-3 py-1.5 text-cyan-300">
                Goodman Equipment
              </span>
              <span className="rounded border border-cyan-400/25 bg-cyan-400/[0.08] px-3 py-1.5 text-cyan-300">
                KC Metro
              </span>
            </div>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <a
                href={`tel:${HVAC_PHONE_RAW}`}
                className="hvac-glow inline-flex items-center gap-3 rounded-lg bg-cyan-400 px-8 py-3.5 text-lg font-bold tracking-wide text-[#0a1628] uppercase transition-all hover:-translate-y-0.5"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                Call Josh
              </a>
              <a
                href={HVAC_FACEBOOK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/[0.06] px-6 py-3.5 text-sm font-bold tracking-wide text-cyan-300 uppercase transition-all hover:border-cyan-400/50 hover:text-white"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Book on Facebook
              </a>
              <a
                href={HVAC_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-800/50 px-6 py-3.5 text-sm font-bold tracking-wide text-neutral-300 uppercase transition-all hover:border-cyan-400/40 hover:text-white"
              >
                Visit Website
              </a>
            </div>

            {/* Star rating */}
            <div className="mt-6 flex items-center justify-center gap-2 lg:justify-start">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <svg key={i} className={`h-4 w-4 ${i < Math.floor(HVAC_RATING) ? "text-yellow-400" : "text-yellow-400/40"}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm font-medium text-neutral-400">
                {HVAC_RATING} — {HVAC_REVIEW_COUNT} Google Reviews
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom edge — wavy sine-curve SVG */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          className="block h-[40px] w-full sm:h-[60px]"
        >
          <path
            d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30 L1440,60 L0,60 Z"
            fill="#0a1628"
          />
          <path
            d="M0,30 C240,60 480,0 720,30 C960,60 1200,0 1440,30"
            fill="none"
            stroke="rgba(34,211,238,0.2)"
            strokeWidth="1"
          />
        </svg>
      </div>
    </section>
  );
}
