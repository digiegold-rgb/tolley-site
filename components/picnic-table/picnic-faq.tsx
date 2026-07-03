const faqs = [
  {
    q: "How much does the picnic table cost to rent?",
    a: "$28 per day. Multi-day rentals are the same daily rate — just let us know how long you need it.",
  },
  {
    q: "Is there a deposit?",
    a: "Yes, there's a $30 refundable deposit. You get it back when the table is returned in good condition.",
  },
  {
    q: "Do you deliver?",
    a: "Yes! Delivery is available for $2 per mile from Independence, MO. We handle delivery and pickup.",
  },
  {
    q: "Is it a folding picnic table?",
    a: "Yes — it folds flat for easy transport and storage. Quick to set up and break down.",
  },
  {
    q: "How do I book?",
    a: "Message us on Facebook Marketplace — tap the listing and hit Message. Same-day booking available when the table is not already rented.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All forms — cash, credit/debit card, Venmo, Zelle, and CashApp.",
  },
];

export function PicnicFaq() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0d1f12] p-6 sm:p-8">
      <h2 className="pt-neon-text text-2xl font-black tracking-wide text-[#c4a56e] uppercase sm:text-3xl">
        Frequently Asked Questions
      </h2>

      <div className="mt-6 space-y-4">
        {faqs.map((faq) => (
          <div key={faq.q} className="rounded-lg border border-slate-700/40 bg-[#0b1a0f] p-5">
            <h3 className="font-bold text-white">{faq.q}</h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-slate-400">
              {faq.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
