import Image from "next/image";

import {
  HVAC_OWNER,
  HVAC_PHONE,
  HVAC_PHONE_RAW,
  HVAC_EMAIL,
  HVAC_ADDRESS,
  HVAC_HOURS,
} from "@/lib/hvac";

export function HvacAbout() {
  return (
    <section className="hvac-airflow">
      <h2 className="hvac-neon-text text-center text-3xl font-bold tracking-tight text-cyan-400 sm:text-4xl">
        Meet {HVAC_OWNER}
      </h2>
      <p className="mt-3 text-center text-lg text-neutral-300">
        10+ Years Serving KC Families
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {/* Owner photo + bio */}
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="relative">
            <div className="absolute -inset-2 rounded-2xl border-2 border-cyan-400/20 shadow-[0_0_30px_rgba(34,211,238,0.15)]" />
            <Image
              src="/hvac/josh.jpg"
              alt="Josh — owner of The Cool Guys"
              width={400}
              height={400}
              className="relative rounded-2xl"
            />
          </div>
          <div className="mt-6 max-w-md">
            <p className="text-neutral-300 leading-relaxed">
              {HVAC_OWNER} founded The Cool Guys with a simple promise: honest pricing, quality work,
              and emergency availability when you need it most. No upselling, no hidden fees — just
              straightforward HVAC service from a family-oriented team that treats your home like their own.
            </p>
          </div>
        </div>

        {/* Crew photos + contact info */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Image
              src="/hvac/crew.jpg"
              alt="The Cool Guys crew"
              width={300}
              height={220}
              className="hvac-photo-tilt w-full rounded-xl object-cover"
            />
            <Image
              src="/hvac/team-install.jpg"
              alt="Crew with customer after installation"
              width={300}
              height={220}
              className="hvac-photo-tilt w-full rounded-xl object-cover"
            />
          </div>

          {/* Contact block */}
          <div className="rounded-xl border border-cyan-400/15 bg-[#0d1a2d] p-6">
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="text-neutral-300">{HVAC_ADDRESS}</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 flex-shrink-0 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-orange-300 font-semibold">{HVAC_HOURS}</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 flex-shrink-0 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                <a href={`tel:${HVAC_PHONE_RAW}`} className="text-cyan-400 transition hover:text-cyan-300">
                  {HVAC_PHONE}
                </a>
              </div>
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 flex-shrink-0 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <a href={`mailto:${HVAC_EMAIL}`} className="text-cyan-400 transition hover:text-cyan-300">
                  {HVAC_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
