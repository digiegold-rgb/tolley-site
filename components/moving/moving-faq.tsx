import { MV_CONTACT_PHONE, MV_PRICE_DAY, MV_PRICE_WEEK, MV_PRICE_2WEEK } from "@/lib/moving";

const faqs = [
  {
    q: "What's included in the bundle?",
    a: "20 heavy-duty reusable totes, 17 giant rubber bands to keep them secure, and 25 thick moving blankets to protect your furniture. Easy labels are included too.",
  },
  {
    q: "How much does it cost?",
    a: `$${MV_PRICE_DAY}/day (24 hours), $${MV_PRICE_WEEK}/week (7 full days), or $${MV_PRICE_2WEEK} for 2 weeks (14 days). All forms of payment accepted \u2014 cash, card, Venmo, Zelle, CashApp. Payments processed via Stripe.`,
  },
  {
    q: "Are the items for sale?",
    a: "No \u2014 this is rental only. Everything is returned when you\u2019re done with your move.",
  },
  {
    q: "Do you deliver?",
    a: `Local moves only. Call ${MV_CONTACT_PHONE} to coordinate pickup or delivery.`,
  },
  {
    q: "How do I book?",
    a: `Call or text ${MV_CONTACT_PHONE}. We\u2019ll confirm availability and get you set up.`,
  },
  {
    q: "What if something gets damaged?",
    a: `Normal wear and tear is expected. If something is lost or seriously damaged, call us at ${MV_CONTACT_PHONE} so we can work it out.`,
  },
  {
    q: "Why totes instead of boxes?",
    a: "Totes are sturdier, stackable, waterproof, and reusable. They don\u2019t collapse under weight, don\u2019t need tape, and make your move way faster and cleaner.",
  },
];

export function MovingFaq() {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
      <h2 className="mv-neon-text text-2xl font-black tracking-wide text-emerald-400 uppercase sm:text-3xl">
        FAQ
      </h2>
      <div className="mt-5 space-y-3">
        {faqs.map((item) => (
          <div
            key={item.q}
            className="mv-card rounded-lg border border-neutral-800 bg-neutral-950 p-5"
          >
            <h3 className="font-black tracking-wide text-white uppercase">
              {item.q}
            </h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-neutral-400">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
