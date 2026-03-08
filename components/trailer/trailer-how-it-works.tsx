const steps = [
  {
    number: "01",
    title: "Call Us",
    description: "Give us a call to check availability and pick your trailer.",
  },
  {
    number: "02",
    title: "Show Your License",
    description: "Present a valid driver\u2019s license before pickup. That\u2019s it.",
  },
  {
    number: "03",
    title: "Hook Up & Go",
    description: "We\u2019ll help you hitch up. No plates needed \u2014 your vehicle insurance covers the trailer.",
  },
  {
    number: "04",
    title: "Return When Done",
    description: "Bring it back in the same condition. Pay however you want \u2014 even the cash box.",
  },
];

export function TrailerHowItWorks() {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
      <h2 className="text-2xl font-black tracking-wide text-amber-400 uppercase sm:text-3xl">
        How It Works
      </h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => (
          <div
            key={step.number}
            className="trailer-card rounded-lg border border-neutral-800 bg-neutral-950 p-5"
          >
            <span className="trailer-neon-text text-3xl font-black text-amber-500/60">
              {step.number}
            </span>
            <h3 className="mt-2 text-lg font-black tracking-wide text-white uppercase">
              {step.title}
            </h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-neutral-400">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
