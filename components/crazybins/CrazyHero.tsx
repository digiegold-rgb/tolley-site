import { CRAZY } from "@/app/crazybins/data";
import { CrazyDealOfDay } from "./CrazyDealOfDay";

function WavyText({ text }: { text: string }) {
  return (
    <>
      {text.split("").map((char, i) => (
        <span
          key={`${char}-${i}`}
          className="crazy-wave-char"
          style={{ "--d": `${i * 0.06}s` } as React.CSSProperties}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </>
  );
}

export function CrazyHero() {
  return (
    <section className="relative overflow-hidden pb-24 sm:pb-32" style={{ background: "linear-gradient(135deg, #ffd60a 0%, #ff6b1a 55%, #e63946 100%)" }}>
      {/* Background photo collage */}
      <div className="absolute inset-0 opacity-20" aria-hidden="true">
        <img
          src="/crazybins/photos/cover.jpg"
          alt=""
          className="h-full w-full object-cover"
          loading="eager"
        />
      </div>

      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-yellow-300/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-red-500/35 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-44 w-44 rounded-full bg-orange-300/25 blur-2xl" />
        <div className="crazy-spin-slow absolute top-12 right-[10%] h-56 w-56 rounded-full border-4 border-dashed border-white/30" />
      </div>

      {/* Floating embers */}
      <div className="crazy-embers" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="crazy-ember"
            style={{
              "--x": `${(i * 8.5 + 5) % 100}%`,
              "--s": `${6 + (i % 4) * 4}px`,
              "--dur": `${7 + (i % 5) * 1.4}s`,
              "--delay": `${(i * 0.7) % 6}s`,
              "--drift": `${(i % 2 ? 1 : -1) * (20 + (i % 3) * 18)}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 sm:px-8 sm:pt-20">
        <p className="text-xs font-black uppercase tracking-[0.4em] text-white/95 drop-shadow-md sm:text-sm">
          {CRAZY.hero.eyebrow}
        </p>

        <h1 className="mt-5 font-black leading-[0.95] text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.3)] text-5xl sm:text-7xl lg:text-[6.5rem]">
          <WavyText text={CRAZY.hero.headline1} />
          <br />
          <WavyText text={CRAZY.hero.headline2} />
        </h1>

        <p className="mt-6 max-w-2xl text-lg font-semibold text-white/95 drop-shadow sm:text-xl">
          {CRAZY.hero.sub}
        </p>
        <p className="mt-2 max-w-2xl text-base font-medium italic text-yellow-100/90">
          {CRAZY.hero.subEs}
        </p>

        <div className="mt-7 inline-block rounded-full bg-white/20 px-5 py-2 backdrop-blur-sm ring-2 ring-white/30">
          <span className="text-sm font-extrabold uppercase tracking-wider text-white">
            🔥 {CRAZY.brand.sale} 🔥
          </span>
        </div>

        <CrazyDealOfDay />

        <div className="mt-10 flex flex-wrap gap-3">
          <a
            href={CRAZY.location.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="crazy-glow inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-black uppercase tracking-wide text-[#e63946] shadow-2xl transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.25)]"
          >
            📍 Get Directions
          </a>
          <a
            href={CRAZY.brand.messengerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border-2 border-white/70 bg-white/10 px-8 py-4 text-base font-black uppercase tracking-wide text-white backdrop-blur-sm transition-all hover:bg-white/25"
          >
            💬 Message Us
          </a>
          <a
            href={CRAZY.brand.fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#1877F2] px-7 py-4 text-base font-black uppercase tracking-wide text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#0c5fcc]"
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Follow on Facebook
          </a>
        </div>
      </div>

      {/* Bottom flame transition */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none" className="block h-[70px] w-full sm:h-[100px]" fill="#fff7ec">
          <path d="M0,30 Q120,80 240,40 Q360,0 480,50 Q600,90 720,40 Q840,0 960,50 Q1080,90 1200,40 Q1320,0 1440,50 L1440,100 L0,100 Z" />
        </svg>
      </div>
    </section>
  );
}
