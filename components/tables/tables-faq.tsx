const faqs = [
  {
    q: "How much do tables cost to rent?",
    a: "All tables are $5 per day regardless of size — round, 4ft, 6ft, or 8ft. Chairs are also $5 each per day. Or grab the bundle: 1 table + 4 chairs for $28/day.",
  },
  {
    q: "Is there a deposit?",
    a: "Yes, there's a $30 refundable deposit on all rentals. You get it back when everything is returned in good condition.",
  },
  {
    q: "Do you deliver?",
    a: "Yes! Delivery is available for $2 per mile from Independence, MO. We can deliver and pick up at your convenience.",
  },
  {
    q: "What sizes of tables do you have?",
    a: "We have round tables (31\" diameter, 43½\" tall), 6ft folding tables, 8ft folding tables, and 4ft folding tables with adjustable height.",
  },
  {
    q: "How do I book?",
    a: "Message us on Facebook Marketplace — tap the listing and hit Message. Same-day booking available when inventory allows.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all forms of payment — cash, credit/debit card, Venmo, Zelle, and CashApp.",
  },
  {
    q: "Can I rent tables and chairs for multiple days?",
    a: "Absolutely. The rate is per day, so just let us know how long you need them when you message us.",
  },
  {
    q: "Are the tables and chairs clean?",
    a: "Yes, all tables and chairs are cleaned and inspected between rentals. Please return them in the same condition.",
  },
];

export function TablesFaq() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#0c1e14] p-6 sm:p-8">
      <h2 className="tbl-neon-text text-2xl font-black tracking-wide text-[#c8a84e] uppercase sm:text-3xl">
        Frequently Asked Questions
      </h2>

      <div className="mt-6 space-y-4">
        {faqs.map((faq) => (
          <div key={faq.q} className="rounded-lg border border-slate-700/40 bg-[#0a1a12] p-5">
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
