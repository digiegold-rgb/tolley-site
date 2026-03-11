import {
  HVAC_PHONE,
  HVAC_PHONE_RAW,
  HVAC_FACEBOOK,
  HVAC_WEBSITE,
} from "@/lib/hvac";

export function HvacCta() {
  return (
    <section className="text-center">
      {/* Thermostat ring */}
      <div className="mx-auto flex items-center justify-center">
        <div className="hvac-thermo-ring flex items-center justify-center">
          <div className="text-center">
            <svg className="mx-auto h-10 w-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>
        </div>
      </div>

      <h2 className="hvac-neon-text mt-8 text-3xl font-bold tracking-tight text-cyan-400 sm:text-4xl">
        Ready to Be Cool?
      </h2>

      <a
        href={`tel:${HVAC_PHONE_RAW}`}
        className="mt-4 inline-block text-4xl font-bold text-white transition hover:text-cyan-400 sm:text-5xl"
      >
        {HVAC_PHONE}
      </a>

      <p className="mt-2 text-neutral-400">
        Available 24/7 for emergencies
      </p>

      {/* CTAs */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
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
    </section>
  );
}
