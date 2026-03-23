import type { Metadata } from "next";
import Link from "next/link";
import { blogPosts } from "@/lib/blog-posts";
import { JsonLd } from "@/components/blog/json-ld";

export const metadata: Metadata = {
  title: "Blog | T-Agent — Real Estate AI Insights",
  description:
    "AI lead scoring, Kansas City real estate guides, SMS follow-up strategies, and productivity playbooks for modern real estate agents.",
  alternates: {
    canonical: "https://tolley.io/blog",
  },
  openGraph: {
    title: "T-Agent Blog — Real Estate AI Insights",
    description:
      "AI tools, KC real estate market insights, and lead management strategies for real estate professionals.",
    type: "website",
    url: "https://tolley.io/blog",
  },
};

const categoryColors: Record<string, string> = {
  "AI Tools": "text-cyan-400 bg-cyan-500/10 border-cyan-500/25",
  "KC Real Estate": "text-teal-400 bg-teal-500/10 border-teal-500/25",
  "Productivity": "text-violet-400 bg-violet-500/10 border-violet-500/25",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const blogIndexJsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "T-Agent Blog",
  description: "AI tools and real estate insights for Kansas City agents",
  url: "https://tolley.io/blog",
  publisher: {
    "@type": "Organization",
    name: "Tolley.io",
    url: "https://tolley.io",
  },
};

export default function BlogIndexPage() {
  const sorted = [...blogPosts].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return (
    <>
      <JsonLd data={blogIndexJsonLd} id="blog-index-ld" />
      <main className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.4em] text-cyan-400/70 mb-3">
            T-Agent by Tolley.io
          </p>
          <h1 className="text-3xl font-bold text-white/95 sm:text-4xl">
            Real Estate AI Insights
          </h1>
          <p className="mt-4 mx-auto max-w-xl text-sm leading-7 text-white/55">
            Practical guides on AI lead management, Kansas City market intelligence, and
            tools that help agents close more deals with less overhead.
          </p>
          <div className="mt-6">
            <Link
              href="/leads/pricing"
              className="inline-block rounded-full bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-cyan-400"
            >
              Try T-Agent Free
            </Link>
          </div>
        </div>

        {/* Article Grid */}
        <div className="space-y-6">
          {sorted.map((post) => {
            const colorClass =
              categoryColors[post.category] ??
              "text-white/50 bg-white/5 border-white/10";
            return (
              <article key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block rounded-2xl border border-white/8 bg-white/[0.03] p-6 transition-all hover:border-white/15 hover:bg-white/[0.05] hover:-translate-y-0.5"
                >
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${colorClass}`}
                    >
                      {post.category}
                    </span>
                    <span className="text-xs text-white/35">
                      {formatDate(post.publishedAt)}
                    </span>
                    <span className="text-xs text-white/35">
                      {post.readingTime} min read
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white/90 leading-snug group-hover:text-white transition">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/50">
                    {post.description}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {post.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-white/5 px-2 py-0.5 text-[0.65rem] text-white/40"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 transition">
                    Read article →
                  </p>
                </Link>
              </article>
            );
          })}
        </div>

        {/* CTA Block */}
        <div className="mt-16 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-8 text-center">
          <h2 className="text-xl font-bold text-white/90">
            Ready to Put AI to Work for Your Real Estate Business?
          </h2>
          <p className="mt-3 text-sm text-white/55 max-w-lg mx-auto">
            T-Agent gives Kansas City agents AI lead scoring, automated SMS follow-up, and
            market intelligence — all in one platform.
          </p>
          <Link
            href="/leads/pricing"
            className="mt-6 inline-block rounded-full bg-cyan-500 px-8 py-3 text-sm font-bold text-black transition hover:bg-cyan-400"
          >
            Start Free Trial
          </Link>
        </div>
      </main>
    </>
  );
}
