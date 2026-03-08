import { TR_TRAILERS, TR_CONTACT_PHONE } from "@/lib/trailer";
import { TrailerGallery } from "./trailer-gallery";

export function TrailerFleet() {
  return (
    <section>
      <h2 className="text-2xl font-black tracking-wide text-amber-400 uppercase sm:text-3xl">
        Our Fleet
      </h2>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {TR_TRAILERS.map((trailer) => (
          <div
            key={trailer.name}
            className="trailer-card trailer-neon-border rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden"
          >
            <TrailerGallery
              images={trailer.images}
              alt={trailer.name}
              size={trailer.size}
            />

            {/* Specs */}
            <div className="p-5 sm:p-6">
              <h3 className="text-xl font-black tracking-wide text-white uppercase">
                {trailer.name}
              </h3>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <span className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 font-bold text-amber-300">
                  {trailer.capacity}
                </span>
                <span className="rounded border border-neutral-700 bg-neutral-800 px-3 py-1 font-bold text-neutral-400">
                  {trailer.axles}
                </span>
              </div>
              <ul className="mt-4 space-y-1.5">
                {trailer.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-neutral-400">
                    <span className="trailer-bullet" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex gap-3">
                <a
                  href={`tel:${TR_CONTACT_PHONE}`}
                  className="trailer-glow inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-black tracking-wide text-black uppercase transition-all hover:-translate-y-0.5"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  Reserve
                </a>
                <a
                  href={trailer.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800/50 px-4 py-2.5 text-sm font-bold tracking-wide text-neutral-400 uppercase transition hover:border-amber-500/30 hover:text-white"
                >
                  Details
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
