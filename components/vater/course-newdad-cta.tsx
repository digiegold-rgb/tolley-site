import { NEWDAD_COURSE } from "@/lib/vater";

export function CourseNewdadCta() {
  return (
    <section className="relative z-10 mx-auto max-w-4xl px-6 py-16">
      <div className="vater-card flex flex-col items-center p-10 text-center">
        <span className="mb-4 text-5xl" role="img" aria-label="Baby">
          {NEWDAD_COURSE.icon}
        </span>

        <h2 className="vater-neon text-3xl font-bold tracking-wide sm:text-4xl">
          Ready to Crush Fatherhood?
        </h2>

        <p className="mt-4 max-w-lg text-lg text-slate-400">
          The no-BS playbook from a dad who survived it &mdash; delivery room
          to toddler tantrums, every stage covered.
        </p>

        <div className="mt-6 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-amber-400">
            ${NEWDAD_COURSE.price}
          </span>
          <span className="text-slate-400">one-time payment</span>
        </div>

        <a
          href="#"
          data-stripe-price="STRIPE_NEWDAD_PRICE_ID"
          className="vater-cta mt-8"
        >
          Get the Course
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
            />
          </svg>
        </a>

        <p className="mt-6 text-sm text-slate-500">
          30-day money-back guarantee. No questions asked.
        </p>
      </div>
    </section>
  );
}
