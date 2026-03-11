import { TR_CONTACT_EMAIL, TR_CONTACT_PHONE } from "@/lib/trailer";

const faqs = [
  {
    q: "Do the trailers have license plates?",
    a: "No. Our trailers do not have license plates. When hooked to your vehicle, coverage falls under your auto insurance. Check your state\u2019s requirements if you\u2019re unsure.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Everything \u2014 cash, card, Venmo, Zelle, CashApp. There\u2019s a cash box at the trailer location for after-hours or weekend pickups.",
  },
  {
    q: "Do I need insurance?",
    a: "Your vehicle\u2019s insurance covers the trailer while it\u2019s hooked up. We recommend confirming with your insurer that you have trailer liability coverage.",
  },
  {
    q: "What if something gets damaged?",
    a: "You\u2019re responsible for any damage during the rental period. Return it how you got it. Normal wear is expected \u2014 abuse and neglect are not.",
  },
  {
    q: "How do I book?",
    a: `Call ${TR_CONTACT_PHONE}. We\u2019ll confirm availability, you show up with your driver\u2019s license, and you\u2019re on your way.`,
  },
  {
    q: "What sizes are available?",
    a: "We have a 16ft single axle (2,500 lbs), an 18ft dual axle (7,000 lbs), a 20ft utility (7,000 lbs), and a 20ft car hauler (10,000 lbs). Check our Facebook for current availability and photos.",
  },
  {
    q: "Do I need to sign a waiver?",
    a: "Yes. All renters agree to our rental terms before pickup. A digital waiver is coming soon.",
  },
];

export function TrailerFaq() {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 sm:p-8">
      <h2 className="text-2xl font-black tracking-wide text-amber-400 uppercase sm:text-3xl">
        FAQ
      </h2>
      <div className="mt-5 space-y-3">
        {faqs.map((item) => (
          <div
            key={item.q}
            className="trailer-card rounded-lg border border-neutral-800 bg-neutral-950 p-5"
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
