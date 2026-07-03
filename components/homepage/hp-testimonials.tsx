const testimonials = [
  {
    quote:
      "We moved from scattered tools to one agent workflow and cut follow-up time in half.",
    byline: "Ops Lead, Mid-Market Brokerage",
    initials: "JR",
    stars: 5,
  },
  {
    quote:
      "Premium gave us the guardrails and reliability we needed for high-volume lead routing.",
    byline: "Broker/Owner, Multi-Team Office",
    initials: "MK",
    stars: 5,
  },
  {
    quote:
      "The billing and setup flow is clean. New agents are live without engineering overhead.",
    byline: "Director of Growth, Real Estate Group",
    initials: "TS",
    stars: 5,
  },
];

function Stars({ count }: { count: number }) {
  return (
    <div className="mb-3 flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <svg
          key={i}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-amber-400/80"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export function HpTestimonials() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
      <div className="mb-10 text-center">
        <p className="text-[0.72rem] font-medium tracking-[0.42em] text-white/68 uppercase">
          Testimonials
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[0.02em] text-white/95 sm:text-3xl">
          Trusted by teams that close
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {testimonials.map((item) => (
          <article
            key={item.byline}
            className="group rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),rgba(129,75,229,0.09)),rgba(8,7,15,0.56)] p-6 shadow-[0_18px_42px_rgba(3,2,10,0.58)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/28"
          >
            <Stars count={item.stars} />
            <p className="text-sm leading-7 text-white/82">&ldquo;{item.quote}&rdquo;</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-400/25 to-purple-500/25 text-xs font-bold text-violet-200/80">
                {item.initials}
              </div>
              <p className="text-xs tracking-[0.08em] text-white/62 uppercase">
                {item.byline}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
