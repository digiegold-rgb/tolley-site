import { MERCH_FAQ } from "@/lib/vater";

export function MerchFaq() {
  return (
    <section>
      <h2 className="vater-section-title mb-8">FAQ</h2>

      <div className="flex flex-col">
        {MERCH_FAQ.map((entry) => (
          <div key={entry.q} className="vater-faq-item">
            <p className="vater-faq-q">{entry.q}</p>
            <p className="vater-faq-a">{entry.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
