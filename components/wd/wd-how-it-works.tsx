const steps = [
  {
    number: "1",
    title: "Sign Up",
    description: "Pick your plan and check out through Stripe. No long-term contracts.",
  },
  {
    number: "2",
    title: "We Deliver & Install",
    description:
      "We bring the machines to your door, hook everything up, and make sure it runs.",
  },
  {
    number: "3",
    title: "Enjoy",
    description:
      "Do laundry on your schedule. Maintenance included — 48-hour repair or replacement if anything breaks.",
  },
  {
    number: "4",
    title: "Cancel Anytime",
    description:
      "No minimum commitment. Cancel before your next billing date and we pick up the equipment.",
  },
];

export function WdHowItWorks() {
  return (
    <section className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(45,175,180,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
      <h2 className="text-lg font-semibold text-white/95">How It Works</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <div
            key={step.number}
            className="rounded-2xl border border-white/12 bg-black/22 p-4"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-600/30 text-sm font-bold text-teal-200">
              {step.number}
            </span>
            <h3 className="mt-3 text-sm font-semibold text-white/90">{step.title}</h3>
            <p className="mt-1 text-sm leading-6 text-white/74">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
