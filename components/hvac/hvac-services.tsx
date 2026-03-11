import Image from "next/image";

import { HVAC_SERVICES } from "@/lib/hvac";

function ServiceIcon({ icon }: { icon: "snowflake" | "wrench" | "house-gear" }) {
  if (icon === "snowflake") {
    return (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (icon === "wrench") {
    return (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
      </svg>
    );
  }
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6.75l1.5-1.5 1.5 1.5M12 5.25v3" />
    </svg>
  );
}

export function HvacServices() {
  return (
    <section>
      <h2 className="hvac-neon-text text-center text-3xl font-bold tracking-tight text-cyan-400 sm:text-4xl">
        Our Services
      </h2>
      <p className="mt-3 text-center text-neutral-400">
        Keeping Kansas City comfortable — heating, cooling, and everything in between.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {HVAC_SERVICES.map((svc) => (
          <div
            key={svc.name}
            className="hvac-card hvac-neon-border group overflow-hidden rounded-xl border border-cyan-400/15 bg-[#0d1a2d]"
          >
            <div className="relative h-48 overflow-hidden">
              <Image
                src={svc.image}
                alt={svc.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a2d] via-transparent to-transparent" />
            </div>
            <div className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-400">
                  <ServiceIcon icon={svc.icon} />
                </div>
                <h3 className="text-xl font-bold text-white">{svc.name}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {svc.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
