import { WD_STRIPE_CHECKOUT_URL, WD_STRIPE_PORTAL_URL, WD_FACEBOOK_URL } from "@/lib/wd";

function WavyText({ text }: { text: string }) {
  return (
    <>
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="wd-wave-char"
          style={{ "--d": `${i * 0.07}s` } as React.CSSProperties}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </>
  );
}

const tags = ["Free Delivery & Install", "Kansas City Local", "Cancel Anytime"];

export function WdHero() {
  return (
    <section className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-400 pb-20 sm:pb-24">
      {/* Decorative background circles */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-white/[0.07]" />
        <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute bottom-1/4 left-1/3 h-28 w-28 rounded-full bg-blue-300/15" />
        {/* Spinning ring decoration */}
        <div className="wd-spin-slow absolute top-16 right-[15%] h-48 w-48 rounded-full border-2 border-dashed border-white/10" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-12 sm:px-8 sm:pt-16">
        <p className="text-sm font-semibold tracking-[0.3em] text-blue-200 uppercase">
          Your KC Homes LLC
        </p>

        <h1 className="mt-4 text-4xl font-extrabold text-white sm:text-5xl lg:text-6xl">
          <WavyText text="Skip the" />
          <br />
          <WavyText text="Laundromat!" />
        </h1>

        <p className="mt-4 max-w-xl text-lg leading-relaxed text-blue-100">
          Washer &amp; dryer rentals delivered to your door. Free install,
          maintenance included, no contracts. Kansas City metro.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold tracking-wider text-white backdrop-blur-sm"
            >
              {tag}
            </span>
          ))}
        </div>

        <a
          href={WD_FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
        >
          <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Find us on Facebook — Reviews &amp; Updates
        </a>

        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={WD_STRIPE_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="wd-glow inline-flex items-center rounded-full bg-white px-8 py-3 text-sm font-bold text-blue-700 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
          >
            Start Renting
          </a>
          <a
            href={WD_STRIPE_PORTAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full border-2 border-white/30 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-white/10"
          >
            Manage My Account
          </a>
        </div>
      </div>

      {/* Foam wave transition */}
      <div className="absolute right-0 bottom-0 left-0" aria-hidden="true">
        <svg
          viewBox="0 0 1440 100"
          preserveAspectRatio="none"
          className="block h-[60px] w-full sm:h-[80px]"
          fill="#f0f7ff"
        >
          <circle cx="80" cy="50" r="18" />
          <circle cx="200" cy="44" r="14" />
          <circle cx="350" cy="42" r="22" />
          <circle cx="500" cy="48" r="16" />
          <circle cx="650" cy="44" r="20" />
          <circle cx="800" cy="50" r="14" />
          <circle cx="950" cy="42" r="24" />
          <circle cx="1100" cy="48" r="16" />
          <circle cx="1250" cy="44" r="20" />
          <circle cx="1380" cy="50" r="15" />
          <path d="M0,62 Q180,82 360,62 Q540,42 720,62 Q900,82 1080,62 Q1260,42 1440,62 L1440,100 L0,100 Z" />
        </svg>
      </div>
    </section>
  );
}
