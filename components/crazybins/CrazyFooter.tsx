import { CRAZY } from "@/app/crazybins/data";

export function CrazyFooter() {
  return (
    <footer className="bg-[#1d2d50] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xl font-black uppercase tracking-wide text-[#ffd60a]">Crazy Bin Store #2</div>
          <p className="mt-2 text-sm text-white/80">{CRAZY.brand.tagline}</p>
          <p className="mt-1 text-xs italic text-white/60">{CRAZY.brand.bilingualTagline}</p>
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[#ff6b1a]">Visit</div>
          <div className="mt-2 font-semibold">{CRAZY.location.addressLine}</div>
          <div className="text-sm text-white/80">{CRAZY.location.cityState}</div>
          <a
            href={CRAZY.location.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-black uppercase tracking-wider text-[#ffd60a] hover:underline"
          >
            Get Directions →
          </a>
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[#ff6b1a]">Hours</div>
          <div className="mt-2 font-semibold">Sun–Wed · Fri · Sat</div>
          <div className="text-sm text-white/80">10AM – 6:30PM</div>
          <div className="text-xs font-semibold text-[#ffd60a]">🚫 Closed Thursdays for restock</div>
          <div className="text-xs italic text-white/55">Cerrado los jueves</div>
        </div>

        <div>
          <div className="text-xs font-black uppercase tracking-widest text-[#ff6b1a]">Connect</div>
          <a
            href={CRAZY.brand.fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#1877F2] px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-[#0c5fcc]"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Facebook
          </a>
          <a
            href={CRAZY.brand.messengerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 ml-2 inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-white/10"
          >
            💬 Message
          </a>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-white/15 pt-6 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Crazy Bin Store #2 · Site by{" "}
        <a href="https://www.tolley.io" className="font-black text-[#ffd60a] hover:underline">tolley.io</a>
      </div>
    </footer>
  );
}
