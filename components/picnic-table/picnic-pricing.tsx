import { PT_PRICE_DAY, PT_DEPOSIT, PT_DELIVERY_PER_MILE, PT_FACEBOOK_URL } from "@/lib/picnic-table";

export function PicnicPricing() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0d1f12] p-6 sm:p-8">
      <h2 className="pt-neon-text text-2xl font-black tracking-wide text-[#c4a56e] uppercase sm:text-3xl">
        Pricing
      </h2>

      {/* Pricing card */}
      <div className="mt-6 mx-auto max-w-sm">
        <a
          href={PT_FACEBOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="pt-card group flex flex-col items-center rounded-lg border border-[#c4a56e]/30 bg-[#c4a56e]/[0.06] p-8 text-center transition-all hover:border-[#c4a56e]/50"
        >
          <span className="text-xs font-bold tracking-[0.3em] text-[#c4a56e]/70 uppercase">
            Per Day
          </span>
          <span className="mt-2 text-5xl font-black text-white">
            ${PT_PRICE_DAY}
          </span>
          <span className="mt-1 text-xs font-light text-slate-500">
            Folding picnic table
          </span>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded bg-[#c4a56e]/10 px-4 py-1.5 text-xs font-bold text-[#c4a56e] uppercase transition group-hover:bg-[#c4a56e] group-hover:text-[#0b1a0f]">
            Message on Facebook
          </span>
        </a>
      </div>

      {/* Important info */}
      <div className="mt-6 rounded-lg border border-[#c4a56e]/15 bg-[#c4a56e]/[0.04] p-5">
        <h3 className="font-black tracking-wide text-[#c4a56e] uppercase">
          Important Info
        </h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            `$${PT_DEPOSIT} refundable deposit`,
            `Delivery available — $${PT_DELIVERY_PER_MILE}/mile`,
            "All payment methods accepted — cash, card, Venmo, Zelle, CashApp",
            "Message us on Facebook — same-day booking available",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm">
              <span className="pt-bullet" />
              <span className="font-light text-slate-300">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
