import { POOLS_CONTACT_EMAIL, POOLS_CONTACT_PHONE } from "@/lib/pools";

const cities = [
  "Independence",
  "Lee\u2019s Summit",
  "Blue Springs",
  "Raytown",
  "Grandview",
  "Kansas City, MO",
  "Kansas City, KS",
  "Overland Park",
  "Olathe",
  "Lenexa",
  "Liberty",
  "Belton",
];

export function PoolsServiceArea() {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-cyan-100/50 sm:p-8">
      <h2 className="text-[1.6rem] font-extrabold text-[#0e7490]">Delivery Area</h2>
      <p className="mt-2 text-sm text-slate-600">
        We deliver across the Kansas City metro — from Lenexa to Lee&apos;s
        Summit and everywhere in between.
      </p>

      {/* KC Metro badge — per handoff spec */}
      <div className="mt-4 rounded-2xl border border-[rgba(6,182,212,0.2)] bg-gradient-to-br from-cyan-500/8 to-cyan-500/[0.02] p-[16px] text-center">
        <p className="flex items-center justify-center gap-2 text-[1.1rem] font-extrabold text-[#0e7490]">
          <span className="text-[1.4rem]">📍</span>
          Kansas City Metro
        </p>
        <p className="mt-1 text-sm text-[rgba(22,78,99,0.68)]">
          Same-week delivery, free over $75
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {cities.map((city) => (
          <span
            key={city}
            className="rounded-full bg-cyan-100 px-4 py-1.5 text-sm font-medium text-cyan-700"
          >
            {city}
          </span>
        ))}
        <span className="rounded-full bg-cyan-500 px-4 py-1.5 text-sm font-bold text-white shadow-md shadow-cyan-500/20">
          + Many More!
        </span>
      </div>
      <p className="mt-5 text-sm text-slate-500">
        Don&apos;t see your area?{" "}
        <a
          href={`mailto:${POOLS_CONTACT_EMAIL}`}
          className="font-semibold text-cyan-600 underline decoration-cyan-300 underline-offset-4 transition hover:text-cyan-800"
        >
          Email us
        </a>{" "}
        or call{" "}
        <a
          href={`tel:${POOLS_CONTACT_PHONE}`}
          className="font-semibold text-cyan-600 underline decoration-cyan-300 underline-offset-4 transition hover:text-cyan-800"
        >
          {POOLS_CONTACT_PHONE}
        </a>
      </p>
    </section>
  );
}
