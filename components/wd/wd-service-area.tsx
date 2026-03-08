import { WD_CONTACT_EMAIL, WD_CONTACT_PHONE } from "@/lib/wd";

const cities = [
  "Independence",
  "Lee's Summit",
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
    <section className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(45,175,180,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
      <h2 className="text-lg font-semibold text-white/95">Service Area</h2>
      <p className="mt-2 text-sm text-white/74">
        We deliver and service across the Kansas City metro.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {cities.map((city) => (
          <span
            key={city}
            className="rounded-full border border-white/18 bg-black/25 px-3 py-1 text-xs tracking-[0.06em] text-white/72"
          >
            {city}
          </span>
        ))}
      </div>
      <p className="mt-4 text-sm text-white/60">
        Don&apos;t see your area?{" "}
        <a
          href={`mailto:${WD_CONTACT_EMAIL}`}
          className="text-teal-200 underline decoration-white/30 underline-offset-4 transition hover:text-white"
        >
          Email us
        </a>{" "}
        or call{" "}
        <a
          href={`tel:${WD_CONTACT_PHONE}`}
          className="text-teal-200 underline decoration-white/30 underline-offset-4 transition hover:text-white"
        >
          {WD_CONTACT_PHONE}
        </a>
      </p>
    </section>
  );
}
