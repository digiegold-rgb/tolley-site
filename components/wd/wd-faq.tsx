import {
  WD_CONTACT_EMAIL,
  WD_CONTACT_PHONE,
  WD_PRICE_WASHER,
  WD_PRICE_BUNDLE,
} from "@/lib/wd";

const faqs = [
  {
    q: "What\u2019s included in the rental?",
    a: "Every rental includes free delivery, professional installation, ongoing maintenance, and replacement coverage if a machine fails. You just pay the monthly subscription.",
  },
  {
    q: "How much does it cost?",
    a: `Washer only is $${WD_PRICE_WASHER}/mo. Washer + dryer bundle is $${WD_PRICE_BUNDLE}/mo. No hidden fees, no deposits.`,
  },
  {
    q: "How do I cancel?",
    a: "Cancel anytime before your next billing date \u2014 no cancellation fees. We\u2019ll schedule a pickup within 5 business days.",
  },
  {
    q: "What areas do you serve?",
    a: "We cover the Kansas City metro including Independence, Lee\u2019s Summit, Blue Springs, Raytown, Grandview, Overland Park, Olathe, Liberty, Gladstone, Belton, and both Kansas City MO & KS.",
  },
  {
    q: "What if my machine breaks down?",
    a: "We repair or replace within 48 hours at no extra cost. Just report the issue and we handle the rest.",
  },
  {
    q: "Do you offer referral discounts?",
    a: "Yes \u2014 refer a friend and get 50% off your next month. Ask us for details when you sign up.",
  },
  {
    q: "How do I get support?",
    a: `Email ${WD_CONTACT_EMAIL} or call ${WD_CONTACT_PHONE}. We\u2019re a local Kansas City business and respond fast.`,
  },
];

export function WdFaq() {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-blue-100/50 sm:p-8">
      <h2 className="text-xl font-bold text-blue-900">FAQ</h2>
      <div className="mt-4 space-y-3">
        {faqs.map((item) => (
          <div
            key={item.q}
            className="wd-card rounded-xl border border-blue-100 bg-blue-50/30 p-5"
          >
            <h3 className="font-bold text-blue-900">{item.q}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
