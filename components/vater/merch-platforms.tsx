import { MERCH_PLATFORMS } from "@/lib/vater";

const PLATFORM_ICONS: Record<string, string> = {
  Etsy: "🛍️",
  Printful: "🖨️",
  Printify: "🧩",
};

export function MerchPlatforms() {
  return (
    <section>
      <h2 className="vater-section-title mb-2">Platform Integrations</h2>
      <p className="vater-section-subtitle mb-10">
        Three platforms working together so you never touch a product.
      </p>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {MERCH_PLATFORMS.map((p) => (
          <div key={p.name} className="vater-card flex flex-col p-6">
            <span className="mb-3 text-3xl" role="img" aria-label={p.name}>
              {PLATFORM_ICONS[p.name] ?? "🔗"}
            </span>
            <h3 className="mb-1 text-lg font-bold text-slate-100">{p.name}</h3>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-sky-400">
              {p.role}
            </p>
            <p className="text-sm leading-relaxed text-slate-400">{p.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
