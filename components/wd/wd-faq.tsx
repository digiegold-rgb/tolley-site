import { WD_CONTACT_EMAIL, WD_CONTACT_PHONE, WD_PRICE_WASHER, WD_PRICE_BUNDLE } from "@/lib/wd";

const faqs = [
  {
    q: "What's included in the rental?",
    a: "Every rental includes free delivery, professional installation, ongoing maintenance, and replacement coverage if a machine fails. You just pay the monthly subscription.",
  },
  {
    q: "How much does it cost?",
    a: `Washer only is $${WD_PRICE_WASHER}/mo. Washer + dryer bundle is $${WD_PRICE_BUNDLE}/mo. No hidden fees, no deposits.`,
  },
  {
    q: "How do I cancel?",
    a: "Cancel anytime before your next billing date — no cancellation fees. We'll schedule a pickup within 5 business days.",
  },
  {
    q: "What areas do you serve?",
    a: "We cover the Kansas City metro including Independence, Lee's Summit, Blue Springs, Raytown, Grandview, Overland Park, Olathe, Liberty, Gladstone, Belton, and both Kansas City MO & KS. Contact us if you're unsure about your area.",
  },
  {
    q: "What if my machine breaks down?",
    a: "We repair or replace within 48 hours at no extra cost. Just report the issue and we handle the rest.",
  },
  {
    q: "Do you offer referral discounts?",
    a: "Yes — refer a friend and get 50% off your next month. Ask us for details when you sign up.",
  },
  {
    q: "How do I get support?",
    a: `Email ${WD_CONTACT_EMAIL} or call ${WD_CONTACT_PHONE}. We're a local Kansas City business and respond fast.`,
  },
];

export function WdFaq() {
  return (
    <section className="rounded-3xl border border-white/18 bg-[linear-gradient(160deg,rgba(255,255,255,0.16),rgba(45,175,180,0.1)),rgba(8,7,15,0.58)] p-6 shadow-[0_20px_48px_rgba(3,2,10,0.62)] backdrop-blur-2xl sm:p-8">
      <h2 className="text-lg font-semibold text-white/95">FAQ</h2>
      <div className="mt-4 space-y-4">
        {faqs.map((item) => (
          <div key={item.q} className="rounded-2xl border border-white/12 bg-black/22 p-4">
            <h3 className="text-sm font-semibold text-white/90">{item.q}</h3>
            <p className="mt-1 text-sm leading-7 text-white/74">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
