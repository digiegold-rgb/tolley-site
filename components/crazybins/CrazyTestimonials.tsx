import { CRAZY } from "@/app/crazybins/data";

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className="text-2xl text-[#ffd60a] drop-shadow-sm">
          {i < count ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

export function CrazyTestimonials() {
  return (
    <section className="bg-[#fff7ec] px-5 py-20 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="crazy-enter text-center">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#e63946]">What Customers Say</p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-[#1d2d50] sm:text-5xl">
            <span className="text-[#ff6b1a]">{CRAZY.social.recommendPercent}%</span> recommend us.
          </h2>
          <p className="mt-3 text-base text-[#5b6b85]">Real Facebook reviews from real shoppers</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {CRAZY.testimonials.map((t, i) => (
            <figure
              key={t.name}
              className="crazy-tile crazy-enter relative rounded-3xl border-2 border-orange-200 bg-white p-8 shadow-md"
              style={{ "--enter-delay": `${i * 0.1}s` } as React.CSSProperties}
            >
              <div className="absolute -top-5 left-7 select-none text-7xl leading-none text-[#ffd60a]" aria-hidden="true">
                "
              </div>
              <Stars count={t.stars} />
              <blockquote className="mt-3 text-lg leading-relaxed text-[#1d2d50]">
                {t.quote}
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#ff6b1a] to-[#e63946] text-base font-black text-white">
                  {t.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <div className="font-black text-[#1d2d50]">{t.name}</div>
                  <div className="text-xs font-semibold text-[#5b6b85]">Verified Facebook reviewer</div>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-10 text-center">
          <a
            href={CRAZY.social.reviewsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[#1877F2] underline-offset-4 hover:underline"
          >
            Read all {CRAZY.social.reviewCount} reviews on Facebook →
          </a>
        </div>
      </div>
    </section>
  );
}
