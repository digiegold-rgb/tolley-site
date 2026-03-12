import { GOVBIDS_FAQ } from "@/lib/vater";

export function GovBidsFaq() {
  return (
    <section>
      <h2 className="vater-section-title mb-2">FAQ</h2>
      <p className="vater-section-subtitle mb-10">
        Common questions about government contracting.
      </p>

      <div>
        {GOVBIDS_FAQ.map((faq) => (
          <div key={faq.q} className="vater-faq-item">
            <p className="vater-faq-q">{faq.q}</p>
            <p className="vater-faq-a">{faq.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
