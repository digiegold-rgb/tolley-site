import { KP_PRICE_DAY, KP_DEPOSIT, KP_DELIVERY_PER_MILE, KP_FACEBOOK_URL } from "@/lib/kerplunk";

export function KerplunkPricing() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#180d28] p-6 sm:p-8">
      <h2 className="kp-neon-text text-2xl font-black tracking-wide text-[#e040a0] uppercase sm:text-3xl">
        Pricing
      </h2>

      {/* Pricing card */}
      <div className="mt-6 mx-auto max-w-sm">
        <a
          href={KP_FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="kp-card group flex flex-col items-center rounded-lg border border-[#e040a0]/30 bg-[#e040a0]/[0.06] p-8 text-center transition-all hover:border-[#e040a0]/50"
        >
          <span className="text-xs font-bold tracking-[0.3em] text-[#e040a0]/70 uppercase">
            Per Day
          </span>
          <span className="mt-2 text-5xl font-black text-white">
            ${KP_PRICE_DAY}
          </span>
          <span className="mt-1 text-xs font-light text-slate-500">
            Giant Kerplunk game
          </span>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded bg-[#e040a0]/10 px-4 py-1.5 text-xs font-bold text-[#e040a0] uppercase transition group-hover:bg-[#e040a0] group-hover:text-white">
            Message on Facebook
          </span>
        </a>
      </div>

      {/* Important info */}
      <div className="mt-6 rounded-lg border border-[#e040a0]/15 bg-[#e040a0]/[0.04] p-5">
        <h3 className="font-black tracking-wide text-[#e040a0] uppercase">
          Important Info
        </h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            `$${KP_DEPOSIT} refundable deposit`,
            `Delivery available — $${KP_DELIVERY_PER_MILE}/mile`,
            "All payment methods accepted — cash, card, Venmo, Zelle, CashApp",
            "Message us on Facebook — same-day booking available",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm">
              <span className="kp-bullet" />
              <span className="font-light text-slate-300">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
