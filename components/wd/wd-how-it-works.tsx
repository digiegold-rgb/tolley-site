const steps = [
  {
    number: "1",
    emoji: "\uD83D\uDCDD",
    title: "Sign Up",
    description:
      "Pick your plan and check out through Stripe. No long-term contracts, no deposits.",
  },
  {
    number: "2",
    emoji: "\uD83D\uDE9A",
    title: "We Deliver & Install",
    description:
      "We bring the machines to your door, hook everything up, and make sure it runs perfectly.",
  },
  {
    number: "3",
    emoji: "\uD83E\uDDFA",
    title: "Enjoy",
    description:
      "Do laundry on your schedule. Maintenance included \u2014 48-hour repair or replacement if anything breaks.",
  },
  {
    number: "4",
    emoji: "\u2705",
    title: "Cancel Anytime",
    description:
      "No minimum commitment. Cancel before your next billing date and we\u2019ll pick up the equipment.",
  },
];

export function WdHowItWorks() {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-blue-100/50 sm:p-8">
      <h2 className="text-xl font-bold text-blue-900">How It Works</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <div
            key={step.number}
            className="wd-card rounded-xl border border-blue-100 bg-blue-50/50 p-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-md shadow-blue-600/30">
                {step.number}
              </span>
              <span className="text-2xl">{step.emoji}</span>
            </div>
            <h3 className="mt-3 font-bold text-blue-900">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
