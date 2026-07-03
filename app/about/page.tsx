import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | tolley.io",
  description:
    "About Jared & Ruthann Tolley — reseller, real estate agent, and creator behind tolley.io/shop in Kansas City.",
  alternates: { canonical: "https://www.tolley.io/about" },
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-white/85">
      <h1 className="text-3xl font-bold text-white">About tolley.io</h1>
      <p className="mt-2 text-sm text-white/60">
        Independence, MO &middot; Kansas City metro
      </p>

      <section className="mt-8 space-y-4 leading-relaxed">
        <p>
          Hi, I&rsquo;m <strong>Jared Tolley</strong>. My wife Ruthann and I
          run a small reseller operation out of Independence, Missouri.
          Ruthann sources products through liquidation bins and bid auctions,
          we photograph and describe each item, and we list them locally on
          Facebook Marketplace and ship orders nationally through our shop at{" "}
          <Link href="/shop" className="text-purple-300 underline">
            tolley.io/shop
          </Link>
          .
        </p>

        <p>
          I&rsquo;m also a licensed real estate agent in Missouri (Your KC
          Homes LLC) and a software engineer. The behind-the-scenes systems
          on tolley.io are something I&rsquo;ve built personally to automate
          the boring parts of resale: photo to FB Marketplace draft, eBay
          listing, multi-platform video distribution, and inventory tracking.
        </p>

        <p>
          You&rsquo;ll find us on social — I post short product videos on
          TikTok and YouTube. If something you see in a video catches your
          eye, you can buy it directly from us when we have it in stock, or
          follow the affiliate link to a similar product on Amazon when we
          don&rsquo;t.
        </p>

        <p>
          Everything in our shop is sourced legitimately. Every item is
          photographed by us. Every video is original. We disclose every
          affiliate relationship.
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-lg font-semibold text-white">Find us online</h2>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            <span className="text-white/40">Amazon storefront:</span>{" "}
            <a
              href="https://www.amazon.com/shop/digitaljared"
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="text-purple-300 underline"
            >
              amazon.com/shop/digitaljared
            </a>{" "}
            <span className="text-[0.65rem] text-white/30">(affiliate)</span>
          </li>
          <li>
            <span className="text-white/40">Facebook:</span>{" "}
            <a
              href="https://www.facebook.com/profile.php?id=534686507"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-300 underline"
            >
              Ruthann Tolley
            </a>
          </li>
          <li>
            <span className="text-white/40">TikTok:</span>{" "}
            <a
              href="https://www.tiktok.com/@cordlessintheoffice"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-300 underline"
            >
              @cordlessintheoffice
            </a>
          </li>
          <li>
            <span className="text-white/40">Email:</span>{" "}
            <a
              href="mailto:jared@yourkchomes.com"
              className="text-purple-300 underline"
            >
              jared@yourkchomes.com
            </a>
          </li>
        </ul>
      </section>

      <section className="mt-8 text-sm text-white/60">
        <Link href="/shop/disclosure" className="underline hover:text-white">
          Affiliate disclosure
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="underline hover:text-white">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline hover:text-white">
          Terms
        </Link>
      </section>
    </main>
  );
}
