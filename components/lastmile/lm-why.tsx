import { LM_DELIVERIES, LM_PAYMENT_METHODS, LM_STARS, LM_YEARS } from "@/lib/lastmile";

const WHY_ITEMS = [
  {
    title: "Dedicated Routes",
    desc: "Consistent B2B service — your loads, your schedule, same reliable driver.",
    icon: (
      <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    title: "Fully Equipped",
    desc: "8 vehicles & trailers up to 10,000 lbs. Covered, open, car hauler, temp-controlled.",
    icon: (
      <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: "Every Payment",
    desc: `${LM_PAYMENT_METHODS.join(", ")}. All services invoiced on request.`,
    icon: (
      <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    title: "Always Available",
    desc: "Weekdays, weekends, overnight. When your job site needs it, we're rolling.",
    icon: (
      <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
] as const;

export function LmWhy() {
  return (
    <section>
      <h2 className="lm-neon-text text-center text-3xl font-bold tracking-tight text-red-500 sm:text-4xl">
        Why Red Alert
      </h2>

      <div className="lm-route-line" />

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {WHY_ITEMS.map((item) => (
          <div
            key={item.title}
            className="lm-card rounded-xl border border-red-500/15 bg-red-500/[0.04] p-6 text-center"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-red-500/20 bg-red-500/[0.08]">
              {item.icon}
            </div>
            <h3 className="mt-4 text-lg font-bold text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Stats callout */}
      <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-6 py-4 text-center">
        <p className="text-lg font-bold tracking-wide text-amber-300">
          {LM_DELIVERIES} deliveries &middot; {LM_STARS} stars &middot; {LM_YEARS} years
        </p>
      </div>
    </section>
  );
}
