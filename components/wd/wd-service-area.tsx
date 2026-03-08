import { WD_CONTACT_EMAIL, WD_CONTACT_PHONE } from "@/lib/wd";

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
  "Liberty",
  "Gladstone",
  "Belton",
];

export function WdServiceArea() {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-blue-100/50 sm:p-8">
      <h2 className="text-xl font-bold text-blue-900">Service Area</h2>
      <p className="mt-2 text-sm text-slate-600">
        We deliver and service across the Kansas City metro.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {cities.map((city) => (
          <span
            key={city}
            className="rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700"
          >
            {city}
          </span>
        ))}
        <span className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-bold text-white shadow-md shadow-blue-600/20">
          + Many More!
        </span>
      </div>
      <p className="mt-5 text-sm text-slate-500">
        Don&apos;t see your area?{" "}
        <a
          href={`mailto:${WD_CONTACT_EMAIL}`}
          className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-800"
        >
          Email us
        </a>{" "}
        or call{" "}
        <a
          href={`tel:${WD_CONTACT_PHONE}`}
          className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-4 transition hover:text-blue-800"
        >
          {WD_CONTACT_PHONE}
        </a>
      </p>
    </section>
  );
}
