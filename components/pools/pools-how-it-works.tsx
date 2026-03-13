const steps = [
  {
    number: "1",
    emoji: "\uD83D\uDCF1",
    title: "Browse Online",
    description:
      "Shop our pool supplies right here. Chemicals, equipment, accessories — all at contractor pricing.",
  },
  {
    number: "2",
    emoji: "\uD83D\uDED2",
    title: "Add to Cart & Checkout",
    description:
      "Build your order and pay securely with Stripe. No accounts, no membership fees.",
  },
  {
    number: "3",
    emoji: "\uD83D\uDE9A",
    title: "We Pick Up From the Distributor",
    description:
      "We grab your order from Pool Corp at contractor rates you can't get retail.",
  },
  {
    number: "4",
    emoji: "\uD83C\uDFE0",
    title: "Delivered to Your Door",
    description:
      "Same-day delivery in the KC metro. Delivery cost is baked into the price — no surprise fees.",
  },
];

export function PoolsHowItWorks() {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-cyan-100/50 sm:p-8">
      <h2 className="text-xl font-bold text-cyan-900">How It Works</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <div
            key={step.number}
            className="pools-card rounded-xl border border-cyan-100 bg-cyan-50/50 p-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white shadow-md shadow-cyan-600/30">
                {step.number}
              </span>
              <span className="text-2xl">{step.emoji}</span>
            </div>
            <h3 className="mt-3 font-bold text-cyan-900">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
