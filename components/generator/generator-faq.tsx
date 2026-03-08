import { GEN_CONTACT_PHONE, GEN_PRICE_DAY, GEN_PRICE_WEEK, GEN_PRICE_MONTH, GEN_WATTAGE_START, GEN_WATTAGE_RUN } from "@/lib/generator";

const faqs = [
  {
    q: "What fuel types does it use?",
    a: "This is a tri-fuel generator \u2014 it runs on gasoline, propane (LP), or natural gas. You pick whichever is most convenient for your setup.",
  },
  {
    q: "How much does it cost to rent?",
    a: `$${GEN_PRICE_DAY}/day (24 hours), $${GEN_PRICE_WEEK}/week (7 full days), or $${GEN_PRICE_MONTH}/month (30 days). All forms of payment accepted \u2014 cash, card, Venmo, Zelle, CashApp.`,
  },
  {
    q: "Do you deliver?",
    a: `Yes! Free delivery within 5 miles and free pickup when you\u2019re done. Call ${GEN_CONTACT_PHONE} to coordinate.`,
  },
  {
    q: "What about fuel?",
    a: "The gas tank comes filled on delivery. You just need to fill it back up before return. An empty propane tank is included \u2014 fill it at any propane exchange if you\u2019re running on propane.",
  },
  {
    q: "How do I book?",
    a: `You can rent online through our checkout link or call ${GEN_CONTACT_PHONE}. We\u2019ll confirm availability and get you set up.`,
  },
  {
    q: "What can it power?",
    a: `With ${GEN_WATTAGE_START} starting watts and ${GEN_WATTAGE_RUN} running watts, it can handle bounce houses, refrigerators, A/C units, power tools, DJ equipment, outdoor lighting, and more \u2014 often several at once.`,
  },
  {
    q: "Can I use it for a bounce house / inflatables?",
    a: "Absolutely! Bounce house blowers typically draw 1,000\u20131,500W. This generator can power multiple inflatables at once with plenty of headroom for lights and speakers too.",
  },
  {
    q: "What if something goes wrong?",
    a: `Call us immediately at ${GEN_CONTACT_PHONE}. You\u2019re responsible for the generator during your rental period, but we\u2019re here to help troubleshoot.`,
  },
];

export function GeneratorFaq() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1030] p-6 sm:p-8">
      <h2 className="gen-neon-text text-2xl font-black tracking-wide text-yellow-400 uppercase sm:text-3xl">
        FAQ
      </h2>
      <div className="mt-5 space-y-3">
        {faqs.map((item) => (
          <div
            key={item.q}
            className="gen-card rounded-lg border border-slate-700/50 bg-[#0a0e27] p-5"
          >
            <h3 className="font-black tracking-wide text-white uppercase">
              {item.q}
            </h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-slate-400">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
