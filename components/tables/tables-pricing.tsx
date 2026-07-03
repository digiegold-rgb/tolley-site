import {
  TBL_PRICE_TABLE,
  TBL_PRICE_CHAIR,
  TBL_DEPOSIT_PER_TABLE,
  TBL_DEPOSIT_CHAIRS,
  TBL_DEPOSIT_PICNIC,
  TBL_DELIVERY_PER_MILE,
  TBL_FACEBOOK_URLS,
} from "@/lib/tables";

const pricingCards = [
  { label: "Per Table", price: TBL_PRICE_TABLE, unit: "/day", note: "Any size" },
  { label: "4 Chairs (Set)", price: TBL_PRICE_CHAIR, unit: "/day", note: "Set of 4 — only option" },
];

export function TablesPricing() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1e14] p-6 sm:p-8">
      <h2 className="tbl-neon-text text-2xl font-black tracking-wide text-[#c8a84e] uppercase sm:text-3xl">
        Pricing
      </h2>
      <p className="mt-2 text-sm font-light text-slate-400">
        Simple daily rates — mix and match tables, chairs, and picnic tables.
      </p>

      {/* Pricing cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {pricingCards.map((card) => (
          <a
            key={card.label}
            href={TBL_FACEBOOK_URLS[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="tbl-card group flex flex-col items-center rounded-lg border border-[#c8a84e]/20 bg-[#c8a84e]/[0.04] p-5 text-center transition-all hover:border-[#c8a84e]/50"
          >
            <span className="text-xs font-bold tracking-[0.3em] text-[#c8a84e]/70 uppercase">
              {card.label}
            </span>
            <span className="mt-2 text-4xl font-black text-white">
              ${card.price}
            </span>
            <span className="mt-1 text-xs font-light text-slate-500">
              {card.unit} &middot; {card.note}
            </span>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded bg-[#c8a84e]/10 px-3 py-1 text-xs font-bold text-[#c8a84e] uppercase transition group-hover:bg-[#c8a84e] group-hover:text-[#0a1a12]">
              Message on Facebook
            </span>
          </a>
        ))}
      </div>

      {/* Important info */}
      <div className="mt-6 rounded-lg border border-[#c8a84e]/15 bg-[#c8a84e]/[0.04] p-5">
        <h3 className="font-black tracking-wide text-[#c8a84e] uppercase">
          Important Info
        </h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            `Refundable deposit: $${TBL_DEPOSIT_PER_TABLE}/table, $${TBL_DEPOSIT_CHAIRS} for chairs, $${TBL_DEPOSIT_PICNIC} for picnic table`,
            `Delivery available — $${TBL_DELIVERY_PER_MILE}/mile`,
            "All payment methods accepted — cash, card, Venmo, Zelle, CashApp",
            "Message us on Facebook — same-day booking available",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm">
              <span className="tbl-bullet" />
              <span className="font-light text-slate-300">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
