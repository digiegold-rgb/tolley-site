import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Disclosure | tolley.io/shop",
  description:
    "Affiliate and FTC disclosure for tolley.io/shop, including Amazon Associates Program participation.",
  alternates: { canonical: "https://www.tolley.io/shop/disclosure" },
};

export default function DisclosurePage() {
  return (
    <article className="prose prose-invert mx-auto max-w-2xl text-white/85">
      <h1 className="text-2xl font-bold text-white">Affiliate Disclosure</h1>
      <p className="text-sm text-white/60">Last updated: April 28, 2026</p>

      <h2 className="mt-6 text-lg font-semibold text-white">Amazon Associates Program</h2>
      <p>
        <em>
          tolley.io/shop is a participant in the Amazon Services LLC Associates
          Program, an affiliate advertising program designed to provide a means
          for sites to earn advertising fees by advertising and linking to
          Amazon.com. As an Amazon Associate I earn from qualifying purchases.
        </em>
      </p>

      <h2 className="mt-6 text-lg font-semibold text-white">What this means for you</h2>
      <p>
        Many of the products you see on tolley.io/shop are real items we
        physically own and resell from our home in Independence, Missouri. When
        an item sells out — or when we make a video about a product we don&rsquo;t
        currently have in stock — we may include an affiliate link to a similar
        product on Amazon.com.
      </p>
      <p>
        If you click an affiliate link and complete a purchase on Amazon, we
        may earn a small commission at <strong>no extra cost to you</strong>.
        These commissions help us keep the lights on and bring you more
        product videos and reviews.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-white">FTC compliance</h2>
      <p>
        In accordance with the Federal Trade Commission&rsquo;s 16 CFR Part 255:
        Guides Concerning the Use of Endorsements and Testimonials in
        Advertising, we disclose that this site contains affiliate links. We
        only recommend products we have personally used, tested, or believe
        will provide value to our readers and viewers.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-white">Amazon Influencer storefront</h2>
      <p>
        Jared is also a member of the Amazon Influencer Program with a
        personalized Amazon storefront at{" "}
        <a
          href="https://www.amazon.com/shop/digitaljared"
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="text-purple-300 underline"
        >
          amazon.com/shop/digitaljared
        </a>
        . Idea Lists and Shoppable Videos linked from that page generate
        affiliate commissions for purchases made on Amazon.com under the
        same disclosure rules described above.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-white">Other affiliate programs</h2>
      <p>
        We may also participate in other affiliate programs in the future,
        including but not limited to TikTok Shop Affiliate, eBay Partner
        Network, and Walmart Affiliate Program. Any links to those retailers
        on this site or in our social media content may also generate a
        commission to us.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-white">Honest opinions only</h2>
      <p>
        Affiliate relationships do not influence our editorial coverage or the
        opinions we express in product videos. If we recommend a product, it
        is because we genuinely believe in it.
      </p>

      <h2 className="mt-6 text-lg font-semibold text-white">Questions</h2>
      <p>
        If you have questions about this disclosure, please email{" "}
        <a href="mailto:jared@yourkchomes.com" className="text-purple-300 underline">
          jared@yourkchomes.com
        </a>
        .
      </p>
    </article>
  );
}
