import Image from "next/image";

import {
  HM_AGENT_NAME,
  HM_BROKERAGE,
  HM_COMPANY,
  HM_CONTACT_EMAIL,
  HM_CONTACT_PHONE,
  HM_SERVICE_AREAS,
  HM_VALUE_PROPS,
} from "@/lib/homes";

export function HomesAgent() {
  return (
    <section>
      {/* Agent card */}
      <div className="homes-card rounded-2xl border border-sky-500/15 bg-neutral-900/60 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Photo */}
          <div className="homes-photo-ring h-32 w-32 flex-shrink-0 overflow-hidden rounded-full">
            <Image
              src="/homes/headshot.jpg"
              alt={HM_AGENT_NAME}
              width={128}
              height={128}
              className="h-full w-full object-cover"
              priority
            />
          </div>

          {/* Info */}
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-extrabold text-white">{HM_AGENT_NAME}</h2>
            <p className="mt-1 text-sm font-semibold text-sky-400">{HM_COMPANY}</p>
            <p className="text-sm text-neutral-400">{HM_BROKERAGE}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">
              <a
                href={`tel:${HM_CONTACT_PHONE}`}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/60 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-sky-500/40 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                {HM_CONTACT_PHONE}
              </a>
              <a
                href={`mailto:${HM_CONTACT_EMAIL}`}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/60 px-4 py-2 text-sm font-semibold text-neutral-300 transition hover:border-sky-500/40 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                {HM_CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Why work with me */}
      <div className="mt-10">
        <h3 className="text-center text-xl font-extrabold tracking-wide text-white uppercase sm:text-left">
          Why Work With Me
        </h3>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {HM_VALUE_PROPS.map((prop) => (
            <div
              key={prop.title}
              className="homes-card rounded-xl border border-sky-500/10 bg-neutral-900/40 p-5"
            >
              <div className="flex items-start gap-3">
                <div className="homes-bullet" />
                <div>
                  <h4 className="font-bold text-white">{prop.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-400">{prop.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service area */}
      <div className="mt-10">
        <h3 className="text-center text-xl font-extrabold tracking-wide text-white uppercase sm:text-left">
          Service Area
        </h3>
        <div className="mt-4 flex flex-wrap gap-2">
          {HM_SERVICE_AREAS.map((area) => (
            <span
              key={area}
              className="rounded-full border border-sky-500/20 bg-sky-500/[0.06] px-4 py-1.5 text-sm font-semibold text-sky-300"
            >
              {area}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
