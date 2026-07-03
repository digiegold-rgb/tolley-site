import { CRAZY } from "@/app/crazybins/data";

export function CrazyMap() {
  return (
    <section id="visit" className="bg-[#fff7ec] px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-stretch">
        <div className="crazy-enter">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#e63946]">Find Us · Visítanos</p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-[#1d2d50] sm:text-5xl">
            We're at <span className="text-[#ff6b1a]">4452 S Noland Rd.</span>
          </h2>
          <p className="mt-3 text-base italic text-[#5b6b85]">Estamos en 4452 S Noland Rd, Independence, MO 64055</p>

          <div className="mt-7 space-y-4">
            <div className="flex items-start gap-4 rounded-2xl border-2 border-orange-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#ff6b1a] text-2xl">📍</div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-[#e63946]">Address · Dirección</div>
                <div className="mt-1 font-bold text-[#1d2d50]">{CRAZY.location.addressLine}</div>
                <div className="text-sm text-[#5b6b85]">{CRAZY.location.cityState}</div>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl border-2 border-orange-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#ffd60a] text-2xl">⏰</div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-[#e63946]">Hours · Horario</div>
                <div className="mt-1 font-bold text-[#1d2d50]">Open 6 days · 10AM – 6:30PM</div>
                <div className="text-sm font-semibold text-[#e63946]">🚫 Closed Thursdays for restock</div>
                <div className="text-xs italic text-[#5b6b85]">Cerrado los jueves por reabasto</div>
              </div>
            </div>

            <div className="flex items-start gap-4 rounded-2xl border-2 border-orange-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#e63946] text-2xl">💬</div>
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-[#e63946]">Questions? · ¿Preguntas?</div>
                <div className="mt-1 font-bold text-[#1d2d50]">Message us on Facebook</div>
                <div className="text-sm text-[#5b6b85]">Mándanos un mensaje en Facebook</div>
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={CRAZY.location.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="crazy-glow inline-flex items-center gap-2 rounded-full bg-[#ff6b1a] px-7 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#e8540a]"
            >
              📍 Get Directions
            </a>
            <a
              href={CRAZY.brand.messengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border-2 border-[#1d2d50] bg-white px-7 py-3 text-sm font-black uppercase tracking-wider text-[#1d2d50] transition-all hover:-translate-y-0.5 hover:bg-[#1d2d50] hover:text-white"
            >
              💬 Message Us
            </a>
          </div>
        </div>

        <div className="crazy-enter overflow-hidden rounded-3xl border-4 border-[#1d2d50] shadow-2xl" style={{ "--enter-delay": "0.15s" } as React.CSSProperties}>
          <iframe
            src={CRAZY.location.embedUrl}
            width="100%"
            height="100%"
            style={{ border: 0, minHeight: "420px" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Crazy Bin Store #2 location map"
          />
        </div>
      </div>
    </section>
  );
}
