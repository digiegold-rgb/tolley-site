const faqs = [
  {
    q: "What is Giant Kerplunk?",
    a: "It's a life-sized version of the classic Kerplunk game. Sticks are threaded through a cage holding balls — players take turns pulling sticks without letting the balls drop. Last player standing wins!",
  },
  {
    q: "How many people can play?",
    a: "2 to 8 players works great, but spectators love watching too. It's a perfect party game for groups of all sizes.",
  },
  {
    q: "What ages is it good for?",
    a: "All ages! Kids and adults both love it. Younger kids may need a little help reaching the sticks, but it's fun for everyone.",
  },
  {
    q: "Can it be used indoors?",
    a: "It's designed for outdoor use — patios, backyards, parks. It can work indoors if you have enough space and don't mind the balls bouncing around.",
  },
  {
    q: "How much does it cost?",
    a: "$18 per day with a $30 refundable deposit. Delivery is available for $2 per mile from Independence, MO.",
  },
  {
    q: "How do I book?",
    a: "Message us on Facebook Marketplace — tap the listing and hit Message. Same-day booking available when the game is not already rented.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All forms — cash, credit/debit card, Venmo, Zelle, and CashApp.",
  },
];

export function KerplunkFaq() {
  return (
    <section className="rounded-xl border border-slate-700/50 bg-[#180d28] p-6 sm:p-8">
      <h2 className="kp-neon-text text-2xl font-black tracking-wide text-[#e040a0] uppercase sm:text-3xl">
        Frequently Asked Questions
      </h2>

      <div className="mt-6 space-y-4">
        {faqs.map((faq) => (
          <div key={faq.q} className="rounded-lg border border-slate-700/40 bg-[#12081e] p-5">
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
