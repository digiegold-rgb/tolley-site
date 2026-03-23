import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getBlogPost, blogPosts } from "@/lib/blog-posts";
import { JsonLd } from "@/components/blog/json-ld";
import { BlogBody } from "@/components/blog/blog-body";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  const url = `https://tolley.io/blog/${post.slug}`;

  return {
    title: post.title,
    description: post.description,
    keywords: post.tags.join(", "),
    authors: [{ name: "Jared Tolley", url: "https://tolley.io" }],
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: ["https://tolley.io"],
      tags: post.tags,
      siteName: "T-Agent by Tolley.io",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const categoryColors: Record<string, string> = {
  "AI Tools": "text-cyan-400 bg-cyan-500/10 border-cyan-500/25",
  "KC Real Estate": "text-teal-400 bg-teal-500/10 border-teal-500/25",
  Productivity: "text-violet-400 bg-violet-500/10 border-violet-500/25",
};

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const colorClass =
    categoryColors[post.category] ?? "text-white/50 bg-white/5 border-white/10";

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: {
      "@type": "Person",
      name: "Jared Tolley",
      url: "https://tolley.io",
      jobTitle: "Real Estate Agent & AI Developer",
    },
    publisher: {
      "@type": "Organization",
      name: "Tolley.io",
      url: "https://tolley.io",
    },
    keywords: post.tags.join(", "),
    url: `https://tolley.io/blog/${post.slug}`,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://tolley.io/blog/${post.slug}`,
    },
  };

  // Related: same category first, then fill with any other posts
  const related = blogPosts.filter(
    (p) => p.slug !== post.slug && p.category === post.category
  );
  const others = blogPosts.filter(
    (p) => p.slug !== post.slug && p.category !== post.category
  );
  const relatedPosts = [...related, ...others].slice(0, 2);

  return (
    <>
      <JsonLd data={articleJsonLd} id={`article-ld-${post.slug}`} />
      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-xs text-white/35">
          <Link href="/blog" className="hover:text-white/60 transition">
            Blog
          </Link>
          <span>/</span>
          <span className="text-white/50">{post.category}</span>
        </nav>

        {/* Article Header */}
        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span
              className={`inline-block rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${colorClass}`}
            >
              {post.category}
            </span>
            <span className="text-xs text-white/35">{formatDate(post.publishedAt)}</span>
            <span className="text-xs text-white/35">{post.readingTime} min read</span>
          </div>
          <h1 className="text-2xl font-bold leading-snug text-white/95 sm:text-3xl">
            {post.title}
          </h1>
          <p className="mt-4 text-base leading-7 text-white/55">{post.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-white/5 px-2 py-0.5 text-[0.65rem] text-white/40"
              >
                {tag}
              </span>
            ))}
          </div>
        </header>

        {/* Article Body — rendered via html-react-parser, static content only */}
        <BlogBody html={post.body} />

        {/* Mid-Article CTA */}
        <div className="my-12 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-6 text-center">
          <p className="text-sm font-semibold text-white/80">
            Ready to put AI to work for your real estate business?
          </p>
          <p className="mt-1 text-xs text-white/45">
            T-Agent gives KC agents AI lead scoring, automated SMS follow-up, and market
            intelligence.
          </p>
          <Link
            href="/leads/pricing"
            className="mt-4 inline-block rounded-full bg-cyan-500 px-6 py-2 text-sm font-bold text-black transition hover:bg-cyan-400"
          >
            See Pricing & Start Free Trial →
          </Link>
        </div>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <section className="mt-14">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-5">
              More Articles
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.slug}
                  href={`/blog/${rp.slug}`}
                  className="group rounded-xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <p className="text-sm font-bold text-white/85 leading-snug group-hover:text-white transition">
                    {rp.title}
                  </p>
                  <p className="mt-1 text-xs text-white/40 line-clamp-2">{rp.description}</p>
                  <p className="mt-3 text-xs font-semibold text-cyan-400">Read →</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Back link */}
        <div className="mt-12 text-center">
          <Link
            href="/blog"
            className="text-xs text-white/35 hover:text-white/60 transition"
          >
            ← All articles
          </Link>
        </div>
      </main>
    </>
  );
}
