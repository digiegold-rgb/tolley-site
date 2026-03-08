import {
  GEN_MODEL,
  GEN_WATTAGE_START,
  GEN_WATTAGE_RUN,
  GEN_PRICE_DAY,
  GEN_PRICE_WEEK,
  GEN_PRICE_MONTH,
  GEN_FUEL_TYPES,
  GEN_STRIPE_CHECKOUT_URL,
} from "@/lib/generator";

const fuelIcons: Record<string, string> = {
  Gasoline: "\u26FD",
  Propane: "\uD83D\uDD25",
  "Natural Gas": "\uD83D\uDCA8",
};

const powerExamples = [
  { item: "Bounce House Blower", watts: "1,500W" },
  { item: "Refrigerator", watts: "600W" },
  { item: "Window A/C Unit", watts: "1,200W" },
  { item: "Power Tools (Circular Saw)", watts: "1,800W" },
  { item: "Outdoor Lighting String (x10)", watts: "500W" },
  { item: "PA System / DJ Setup", watts: "2,000W" },
  { item: "Sump Pump", watts: "1,500W" },
  { item: "Space Heater", watts: "1,500W" },
];

const pricingTiers = [
  { label: "Day", duration: "24 hours", price: GEN_PRICE_DAY },
  { label: "Week", duration: "7 full days", price: GEN_PRICE_WEEK },
  { label: "Month", duration: "Full 30 days", price: GEN_PRICE_MONTH },
];

export function GeneratorSpecs() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1030] p-6 sm:p-8">
      <h2 className="gen-neon-text text-2xl font-black tracking-wide text-yellow-400 uppercase sm:text-3xl">
        {GEN_MODEL} — Tri-Fuel Power
      </h2>
      <p className="mt-2 text-sm font-light text-slate-400">
        {GEN_WATTAGE_START} starting / {GEN_WATTAGE_RUN} running — three fuel options, one beast of a generator.
      </p>

      {/* Pricing tiers */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {pricingTiers.map((tier) => (
          <a
            key={tier.label}
            href={GEN_STRIPE_CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="gen-card group flex flex-col items-center rounded-lg border border-yellow-400/20 bg-yellow-400/[0.04] p-5 text-center transition-all hover:border-yellow-400/50"
          >
            <span className="text-xs font-bold tracking-[0.3em] text-yellow-400/70 uppercase">
              {tier.label}
            </span>
            <span className="mt-2 text-4xl font-black text-white">
              ${tier.price}
            </span>
            <span className="mt-1 text-xs font-light text-slate-500">
              {tier.duration}
            </span>
            <span className="mt-3 inline-block rounded bg-yellow-400/10 px-3 py-1 text-xs font-bold text-yellow-400 uppercase transition group-hover:bg-yellow-400 group-hover:text-[#0a0e27]">
              Rent Now
            </span>
          </a>
        ))}
      </div>

      {/* Included with rental */}
      <div className="mt-6 rounded-lg border border-yellow-400/15 bg-yellow-400/[0.04] p-5">
        <h3 className="font-black tracking-wide text-yellow-400 uppercase">
          Included With Every Rental
        </h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            "Free delivery within 5 miles",
            "Free pickup when you\u2019re done",
            "Gas tank filled on delivery",
            "Empty propane tank included",
            "All payment methods accepted",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm">
              <span className="gen-bullet" />
              <span className="font-light text-slate-300">{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs font-light text-slate-500">
          Gas tank must be filled upon return. All forms of payment accepted — cash, card, Venmo, Zelle, CashApp.
        </p>
      </div>

      {/* Fuel type cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {GEN_FUEL_TYPES.map((fuel) => (
          <div
            key={fuel}
            className="gen-card flex items-center gap-4 rounded-lg border border-slate-700/50 bg-[#0a0e27] p-5"
          >
            <span className="text-3xl">{fuelIcons[fuel]}</span>
            <div>
              <h3 className="font-black tracking-wide text-white uppercase">{fuel}</h3>
              <p className="text-xs font-light text-slate-500">Supported fuel type</p>
            </div>
          </div>
        ))}
      </div>

      {/* Key specs + what can it power */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="font-black tracking-wide text-yellow-400 uppercase">
            Key Specs
          </h3>
          <ul className="mt-3 space-y-2.5">
            {[
              { label: "Model", value: GEN_MODEL },
              { label: "Starting Watts", value: GEN_WATTAGE_START },
              { label: "Running Watts", value: GEN_WATTAGE_RUN },
              { label: "Fuel Types", value: GEN_FUEL_TYPES.join(", ") },
              { label: "Location", value: "Independence, MO" },
            ].map((spec) => (
              <li key={spec.label} className="flex items-start gap-3">
                <span className="gen-bullet" />
                <div>
                  <span className="text-sm font-bold text-white">{spec.label}:</span>{" "}
                  <span className="text-sm font-light text-slate-400">{spec.value}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-black tracking-wide text-yellow-400 uppercase">
            What Can It Power?
          </h3>
          <ul className="mt-3 space-y-2">
            {powerExamples.map((ex) => (
              <li key={ex.item} className="flex items-start gap-3">
                <span className="gen-bullet" />
                <div className="flex w-full justify-between text-sm">
                  <span className="font-light text-slate-300">{ex.item}</span>
                  <span className="font-bold text-yellow-400/80">{ex.watts}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

    </section>
  );
}
