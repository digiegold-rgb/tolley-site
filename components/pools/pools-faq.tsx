import { POOLS_CONTACT_EMAIL, POOLS_CONTACT_PHONE } from "@/lib/pools";

const faqs = [
  {
    q: "How is your pricing so low?",
    a: "We buy directly from Pool Corp at contractor pricing — the same distributor professionals use. We pass those savings on to you with a small markup, and delivery is included in the price.",
  },
  {
    q: "Where do you deliver?",
    a: "We cover the entire Kansas City metro — Independence, Lee\u2019s Summit, Blue Springs, Overland Park, Lenexa, and everywhere in between. We pick up from Pool Corp locations in Lenexa and Lee\u2019s Summit.",
  },
  {
    q: "How fast is delivery?",
    a: "Most orders placed before noon are delivered same-day. Afternoon orders typically arrive next morning. We\u2019ll text you a delivery window.",
  },
  {
    q: "Do I need a membership?",
    a: "No memberships, no subscriptions, no accounts. Just browse, add to cart, and check out. Pay with any credit or debit card.",
  },
  {
    q: "Can I return products?",
    a: "Unopened products in original packaging can be returned within 7 days for a full refund. Chemicals that have been opened cannot be returned for safety reasons.",
  },
  {
    q: "Do you handle pool chemicals safely?",
    a: "Yes. All chemicals are transported in a dedicated vehicle section, kept upright and separated by type. We follow manufacturer handling guidelines for every delivery.",
  },
  {
    q: "Can I order something not listed?",
    a: `Absolutely. We have access to Pool Corp\u2019s full catalog. Email ${POOLS_CONTACT_EMAIL} or call ${POOLS_CONTACT_PHONE} with what you need and we\u2019ll get you a quote.`,
  },
];

export function PoolsFaq() {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-lg shadow-cyan-100/50 sm:p-8">
      <h2 className="text-xl font-bold text-cyan-900">FAQ</h2>
      <div className="mt-4 space-y-3">
        {faqs.map((item) => (
          <div
            key={item.q}
            className="pools-card rounded-xl border border-cyan-100 bg-cyan-50/30 p-5"
          >
            <h3 className="font-bold text-cyan-900">{item.q}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {item.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
