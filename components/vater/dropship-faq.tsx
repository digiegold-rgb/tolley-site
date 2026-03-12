import { DROPSHIP_FAQ } from "@/lib/vater";

export function DropshipFaq() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <h2 className="vater-section-title mb-3">FAQ</h2>
      <p className="vater-section-subtitle mb-10">
        Common questions about the Amazon-to-eBay arbitrage model.
      </p>

      <div className="vater-card p-6 sm:p-8">
        {DROPSHIP_FAQ.map((faq, i) => (
          <div key={i} className="vater-faq-item">
            <p className="vater-faq-q">{faq.q}</p>
            <p className="vater-faq-a">{faq.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
