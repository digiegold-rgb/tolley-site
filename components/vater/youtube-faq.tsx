import { YOUTUBE_FAQ } from "@/lib/vater";

export function YouTubeFaq() {
  return (
    <section>
      <h2 className="vater-section-title">FAQ</h2>
      <p className="vater-section-subtitle mt-2">
        Common questions about the faceless YouTube pipeline.
      </p>

      <div className="mt-8">
        {YOUTUBE_FAQ.map((item) => (
          <div key={item.q} className="vater-faq-item">
            <p className="vater-faq-q">{item.q}</p>
            <p className="vater-faq-a">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
