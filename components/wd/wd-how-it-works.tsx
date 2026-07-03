// NOTE: 4-step flow preserved intentionally; handoff shows 3 steps — check with designer (plan i-got-3-new-flickering-backus.md workstream-B).
const steps = [
  {
    number: "1",
    title: "Sign Up",
    description:
      "Pick your plan and check out through Stripe. No long-term contracts, no deposits.",
  },
  {
    number: "2",
    title: "Deliver & Install",
    description:
      "We bring the machines to your door, hook everything up, and make sure it runs perfectly.",
  },
  {
    number: "3",
    title: "Enjoy",
    description:
      "Do laundry on your schedule. Maintenance included \u2014 48-hour repair or replacement if anything breaks.",
  },
  {
    number: "4",
    title: "Cancel Anytime",
    description:
      "No minimum commitment. Cancel before your next billing date and we\u2019ll pick up the equipment.",
  },
];

export function WdHowItWorks() {
  return (
    <section>
      <h2 className="text-xl font-bold text-blue-900 sm:text-2xl">How It Works</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <div
            key={step.number}
            className="wd-card rounded-2xl border border-blue-100 bg-white p-6 text-center"
          >
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white shadow-md shadow-blue-600/30">
              {step.number}
            </div>
            <h3 className="text-lg font-bold text-blue-900">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
