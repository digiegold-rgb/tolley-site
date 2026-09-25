import Link from "next/link";
import { getSubsite } from "@/lib/subsites";
import { discoveryQuestions, discoveryFaqJsonLd } from "@/lib/discovery";
import { buildJsonLd, serializeJsonLd } from "@/lib/json-ld";
import { DiscoveryInquiry } from "@/components/discovery/inquiry";

/** Rendered on public landing pages only; never attached to app layouts. */
export function PublicOfferDetails({ name }: { name: string }) {
  const s = getSubsite(name);
  if (!s || s.discovery?.disposition !== "offering") return null;
  const faqJsonLd = discoveryFaqJsonLd(s);
  return <section id="service-details" aria-label={`${s.title} details`} className="border-t border-neutral-700 bg-neutral-950 px-6 py-12 text-neutral-100">
    <div className="mx-auto max-w-4xl space-y-6">
      <h2 className="text-2xl font-semibold">{s.title}</h2>
      <p className="max-w-3xl leading-relaxed">{s.purpose}</p>
      {s.discovery.phone && <p>Call <a className="underline" href={`tel:+1${s.discovery.phone.replace(/\D/g, "")}`}>{s.discovery.phone}</a>{s.discovery.operator ? ` · ${s.discovery.operator}` : ""}</p>}
      {!!s.pricing?.length && <ul className="list-disc pl-5">{s.pricing.map((p, i) => <li key={i}>{p.currency} {p.amount} {p.unit}{p.notes ? ` — ${p.notes}` : ""}</li>)}</ul>}
      <p className="text-sm text-neutral-300">{s.discovery.pricingNote}</p>
      <div className="space-y-3">{discoveryQuestions(s).slice(1).map(f => <details key={f.q}><summary className="cursor-pointer font-medium">{f.q}</summary><p className="mt-2 leading-relaxed text-neutral-300">{f.a}</p></details>)}</div>
      {!!s.discovery.evidence.length && <div className="flex flex-wrap gap-4">{s.discovery.evidence.map(href => <Link key={href} className="underline" href={href}>{href.includes("demo") ? "Watch a finished example" : href.includes("reviews") ? "Customer reviews" : href.includes("sold") ? "Sold examples" : "See our work"}</Link>)}</div>}
      {["cleanouts", "estate", "homes", "real-estate-agent", "housing"].includes(name) && <p>Preparing a property? <Link href="/cleanouts" className="underline">Cleanouts</Link> · <Link href="/estate" className="underline">Estate sales</Link> · <Link href="/homes" className="underline">Buyer and seller consultations</Link></p>}
      {["wd", "moving", "trailer"].includes(name) && <p>Clearing space first? <Link href="/cleanouts" className="underline">Ask about cleanouts and appliance haul-away</Link>.</p>}
      {s.discovery.operator && !["cleanouts", "wd", "housing", "estate"].includes(name) && <DiscoveryInquiry offering={name} />}
      <Link href="/services" className="inline-block underline">Explore all Tolley services and tools</Link>
    </div>
    {!s.skipJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildJsonLd(s)) }} />}
    {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }} />}
  </section>;
}
