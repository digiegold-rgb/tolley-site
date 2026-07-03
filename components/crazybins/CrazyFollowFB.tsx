import { CRAZY } from "@/app/crazybins/data";

export function CrazyFollowFB() {
  return (
    <section className="relative overflow-hidden px-5 py-20 sm:px-8 sm:py-28" style={{ background: "linear-gradient(135deg, #1877F2 0%, #1d2d50 100%)" }}>
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/[0.08] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="crazy-enter">
          <svg className="mx-auto h-14 w-14 fill-white" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>

          <h2 className="mt-5 text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
            Don't miss <span className="text-[#ffd60a]">tomorrow's deal.</span>
          </h2>
          <p className="mt-4 text-lg text-white/90 sm:text-xl">
            We post the day's price every morning on Facebook —
            <span className="font-black text-[#ffd60a]"> {CRAZY.brand.fbFollowers} </span>
            people are already in the know.
          </p>
          <p className="mt-2 text-base italic text-white/75">
            ¡Síguenos en Facebook para ver la oferta de cada día!
          </p>

          <a
            href={CRAZY.brand.fbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="crazy-glow mt-9 inline-flex items-center gap-3 rounded-full bg-[#ffd60a] px-10 py-5 text-lg font-black uppercase tracking-wider text-[#1d2d50] shadow-2xl transition-all hover:-translate-y-1 hover:bg-yellow-300 sm:text-xl"
          >
            <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Follow {CRAZY.brand.fbHandle}
          </a>

          <p className="mt-5 text-sm font-semibold text-white/70">
            🔔 Tip: hit "Following → Favorites" so deals show at the top of your feed
          </p>
        </div>
      </div>
    </section>
  );
}
