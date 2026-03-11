import Image from "next/image";

import { LM_FLEET } from "@/lib/lastmile";

const FLEET_ICONS: Record<string, string> = {
  truck: "\uD83D\uDE9A",
  dually: "\uD83D\uDEFB",
  covered: "\uD83D\uDCE6",
  utility: "\uD83D\uDD17",
  hauler: "\uD83D\uDE9B",
  temp: "\u2744\uFE0F",
};

const FLEET_PHOTOS = [
  { src: "/lastmile/trailer-clean.jpg", alt: "Honda Ridgeline with utility trailer" },
  { src: "/lastmile/equipment-haul.jpg", alt: "Hauling heavy equipment" },
  { src: "/lastmile/car-haul.jpg", alt: "Car on flatbed hauler" },
];

export function LmFleet() {
  return (
    <section>
      <h2 className="lm-neon-text text-center text-3xl font-bold tracking-tight text-red-500 sm:text-4xl">
        The Fleet
      </h2>
      <p className="mt-3 text-center text-neutral-400">
        8 vehicles &amp; trailers — up to 10,000 lbs capacity.
      </p>

      <div className="lm-route-line" />

      {/* Fleet grid */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LM_FLEET.map((v) => (
          <div
            key={v.name}
            className="lm-card rounded-xl border border-red-500/15 bg-red-500/[0.04] p-5"
          >
            <div className="text-2xl">{FLEET_ICONS[v.icon] ?? "\uD83D\uDE9A"}</div>
            <h3 className="mt-2 text-lg font-bold text-white">{v.name}</h3>
            <p className="mt-1 text-sm font-semibold text-amber-400">{v.capacity}</p>
            <p className="mt-1 text-sm text-neutral-400">{v.feature}</p>
          </div>
        ))}
      </div>

      {/* Fleet photo strip */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FLEET_PHOTOS.map((p) => (
          <div
            key={p.src}
            className="relative aspect-[16/10] overflow-hidden rounded-xl border border-red-500/10"
          >
            <Image src={p.src} alt={p.alt} fill className="object-cover" />
          </div>
        ))}
      </div>
    </section>
  );
}
