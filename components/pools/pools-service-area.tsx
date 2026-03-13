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
      <h2 className="text-xl font-bold text-cyan-900">Delivery Area</h2>
      <p className="mt-2 text-sm text-slate-600">
        We deliver across the Kansas City metro — from Lenexa to Lee&apos;s
        Summit and everywhere in between.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {cities.map((city) => (
          <span
            key={city}
            className="rounded-full bg-cyan-100 px-4 py-1.5 text-sm font-medium text-cyan-700"
          >
            {city}
          </span>
        ))}
        <span className="rounded-full bg-cyan-600 px-4 py-1.5 text-sm font-bold text-white shadow-md shadow-cyan-600/20">
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
