import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface FAQItem {
  question: string;
  answer: string;
}

async function getPage(slug: string) {
  return prisma.neighborhoodPage.findUnique({
    where: { slug },
  });
}

/**
 * Safely serialize a JSON-LD schema object for embedding in a <script>.
 * Escapes `<`, `>`, `&` so the value can never close the script tag or
 * trigger XSS even if a string field contained user-controlled content.
 * (Our schema is currently fully internal-controlled, but this is the
 * defensive pattern Next.js docs recommend.)
 */
function jsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page || !page.published) {
    return { title: "Real estate agent | tolley.io" };
  }
  const title = `Real estate agent in ${page.name} | Your KC Homes`;
  const description = page.intro
    ? page.intro.slice(0, 160)
    : `Looking to buy or sell a home in ${page.name}? Jared Tolley with Your KC Homes serves the ${page.city}, ${page.state} market with local expertise.`;
  return {
    title,
    description,
    alternates: { canonical: `https://www.tolley.io/real-estate-agent/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://www.tolley.io/real-estate-agent/${slug}`,
      type: "website",
    },
  };
}

export default async function NeighborhoodPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page || !page.published) notFound();

  const faq: FAQItem[] = Array.isArray(page.faqJson)
    ? (page.faqJson as unknown as FAQItem[])
    : [];

  const faqSchema =
    faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "Jared Tolley — Your KC Homes",
    url: `https://www.tolley.io/real-estate-agent/${slug}`,
    areaServed: {
      "@type": "City",
      name: page.city,
      addressRegion: page.state,
      ...(page.zip && { postalCode: page.zip }),
    },
    parentOrganization: {
      "@type": "Organization",
      name: "Your KC Homes",
    },
  };

  const related = Array.isArray(page.relatedSearches)
    ? (page.relatedSearches as string[])
    : [];

  return (
    <main className="min-h-screen bg-[#06050a] text-white">
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(faqSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(localBusinessSchema) }}
      />

      <div
        aria-hidden="true"
        className="site-dot-grid-purple pointer-events-none fixed inset-0 z-0"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10">
        <nav className="text-xs text-white/40">
          <Link href="/" className="hover:text-white/70">
            tolley.io
          </Link>{" "}
          /{" "}
          <Link href="/real-estate-agent" className="hover:text-white/70">
            real estate agent
          </Link>{" "}
          / <span className="text-white/70">{page.name}</span>
        </nav>

        <header className="mt-6">
          <h1 className="text-3xl font-bold tracking-tight">
            Real estate agent in{" "}
            <span className="bg-gradient-to-r from-purple-300 to-violet-400 bg-clip-text text-transparent">
              {page.name}
            </span>
          </h1>
          <p className="mt-2 text-white/60">
            Jared Tolley with Your KC Homes — serving {page.city}, {page.state}{" "}
            {page.zip ? `(${page.zip})` : ""} buyers, sellers, and investors.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="tel:+18164019555"
              className="rounded-full bg-purple-500/20 px-4 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-500/30"
            >
              Call Jared
            </a>
            <Link
              href="/leads/onboard"
              className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
            >
              Get a free dossier
            </Link>
          </div>
        </header>

        {page.intro && (
          <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm leading-relaxed text-white/80">{page.intro}</p>
          </section>
        )}

        {faq.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold">
              Common questions about {page.name}
            </h2>
            <div className="mt-4 space-y-3">
              {faq.map((f, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-white/10 bg-white/5 p-4 open:bg-white/10"
                >
                  <summary className="cursor-pointer list-none text-sm font-medium text-white/90 group-open:text-white">
                    {f.question}
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">
                    {f.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-base font-semibold text-white/80">
              Also searched
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {related.map((r) => (
                <span
                  key={r}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60"
                >
                  {r}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-12 rounded-2xl border border-purple-500/20 bg-purple-500/10 p-6 text-center">
          <h2 className="text-xl font-semibold">
            Thinking about {page.name} real estate?
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Get a free, fully-researched property dossier — owner background,
            comps, school zones, and AI risk flags — in 5 minutes.
          </p>
          <Link
            href="/leads/onboard"
            className="mt-4 inline-block rounded-full bg-purple-500 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-400"
          >
            Start free dossier →
          </Link>
        </section>

        <footer className="mt-12 text-xs text-white/40">
          <p>
            Last updated{" "}
            {page.generatedAt
              ? new Date(page.generatedAt).toLocaleDateString()
              : "—"}
            . Content sourced from public Google search data + Your KC Homes
            local expertise.
          </p>
        </footer>
      </div>
    </main>
  );
}
