import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { amazonAffiliateUrl } from "@/lib/shop";
import { ensureSubtagsLoaded } from "@/lib/amazon/subtags";

export const metadata: Metadata = {
  title:
    "Best Kitchen Gadgets Under $50 (2026): Tested Picks from Ruthann's Treasure Haul",
  description:
    "Eight kitchen gadgets under $50 we actually use, tested in a Kansas-City kitchen. What's worth the money, what's hype, and which Amazon ASINs we still recommend after a year of weekly use.",
  alternates: {
    canonical:
      "https://www.tolley.io/shop/guides/best-kitchen-gadgets-under-50",
  },
  openGraph: {
    title: "Best Kitchen Gadgets Under $50 (2026)",
    description:
      "Eight kitchen gadgets under $50 we actually use — what's worth it, what's not, and the Amazon ASINs we recommend.",
    url: "https://www.tolley.io/shop/guides/best-kitchen-gadgets-under-50",
    type: "article",
  },
};

export const revalidate = 3600;

interface PickRow {
  id: string;
  goSlug: string | null;
  title: string;
  description: string | null;
  imageUrl: string | null;
  asin: string | null;
  inStock: boolean;
  ourPrice: number | null;
}

async function fetchKitchenPicks(limit = 8): Promise<PickRow[]> {
  await ensureSubtagsLoaded();
  const products = await prisma.product
    .findMany({
      where: {
        amazonAsin: { not: null },
        category: { in: ["Kitchen", "Home"] },
      },
      orderBy: [
        { amazonClicks: "desc" },
        { asinMatchedAt: "desc" },
      ],
      take: limit * 3,
      select: {
        id: true,
        goSlug: true,
        title: true,
        description: true,
        imageUrls: true,
        amazonAsin: true,
        status: true,
        targetPrice: true,
      },
    })
    .catch(() => []);
  return products
    .filter((p) => p.imageUrls.length > 0 && p.amazonAsin)
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      goSlug: p.goSlug,
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrls[0],
      asin: p.amazonAsin,
      inStock: p.status === "listed",
      ourPrice: p.targetPrice,
    }));
}

function pickHref(p: PickRow): string {
  if (p.goSlug) return `/go/${p.goSlug}?src=shop&platform=amazon`;
  return amazonAffiliateUrl(p.asin, undefined, "shop") ?? "/shop";
}

const FAQS = [
  {
    q: "What's the single most-used kitchen gadget under $50?",
    a: "Honestly, a 10-inch cast-iron skillet earns its space more than anything else on this list. One pan replaces three (saute pan, oven dish, pizza pan), it lasts forever, and at around $25 it's the highest-ROI thing in this guide. The catch is the learning curve - read our care section before you commit.",
  },
  {
    q: "Are kitchen gadgets bought used (yard sales, estate sales) worth it?",
    a: "Most of them, yes. We resell out of our Kansas-City home and the gear that consistently shows up in good shape is heavy stuff people don't want to move: stand mixers, cast iron, large stoneware. Skip electrics that have been sitting in a damp basement.",
  },
  {
    q: "Why do you link to Amazon if you're a reseller?",
    a: "When an item we own sells out, we still want readers to be able to grab the same thing. Amazon's the most reliable way to ship the exact ASIN nationwide. Buying through our affiliate link supports the shop at no extra cost to you.",
  },
  {
    q: "Are these picks reviewed or sponsored by Amazon?",
    a: "No. Amazon doesn't see this list before it's published and doesn't approve picks. Every product on this page is something we own, have used, or have personally inspected on the shelves at our local liquidation stores.",
  },
  {
    q: "How often is this page updated?",
    a: "The product cards update automatically as we restock and match ASINs in our system. We re-review the editorial picks (intro, buying guide, FAQs) at least quarterly, and we date-stamp the page footer when we touch the educational content.",
  },
];

const BUYING_CHECKLIST = [
  {
    title: "Buy heavy, buy once",
    body: "Anything that uses a motor, hinges, or screws gets replaced every 3-5 years. Cast iron, ceramic, and stainless steel don't. If you're under $50 and the choice is a fancy electric vs. a sturdy mechanical equivalent, default to the mechanical one.",
  },
  {
    title: "Watch the pad-of-butter test",
    body: "When you're picking a small skillet or grill pan, look for a flat-bottom interior. If a quarter doesn't lie flat, butter pools at the edge - and so does your egg. This kills cheap nonstick pans more often than the coating wearing off.",
  },
  {
    title: "Beware of \"as seen on TikTok\" copies",
    body: "The Amazon ecosystem moves quickly: when a viral kitchen gadget hits its 90-day peak, dozens of unbranded clones flood the listing. Stick to ASINs that have been on the market for 18+ months, are sold-by Amazon (not just shipped-by), and have at least 5,000 reviews.",
  },
  {
    title: "Storage is half the battle",
    body: "A $20 utensil rest from this list is worthless if you don't have counter space for it. Before you buy any new gadget, picture exactly which drawer or cabinet shelf it lives on. If you can't picture it, skip it.",
  },
];

interface JsonLdBlock {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

function buildJsonLd(picks: PickRow[]): JsonLdBlock[] {
  const breadcrumb: JsonLdBlock = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "tolley.io",
        item: "https://www.tolley.io",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: "https://www.tolley.io/shop",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Guides",
        item: "https://www.tolley.io/shop/guides",
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Best Kitchen Gadgets Under $50",
      },
    ],
  };

  const itemList: JsonLdBlock = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Best Kitchen Gadgets Under $50",
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    numberOfItems: picks.length,
    itemListElement: picks.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: p.title,
        image: p.imageUrl ?? undefined,
        description: p.description ?? undefined,
      },
    })),
  };

  const faq: JsonLdBlock = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return [breadcrumb, itemList, faq];
}

// JSON.stringify already escapes quotes and backslashes, but a raw `</script>`
// substring inside a string value would break out of the script tag. Replacing
// the slash with the unicode escape / is the standard hardening.
function safeJsonLd(blocks: JsonLdBlock[]): string {
  return JSON.stringify(blocks).replace(/<\/script/gi, "<\\u002Fscript");
}

export default async function BestKitchenGadgetsPage() {
  const picks = await fetchKitchenPicks(8);
  const jsonLd = safeJsonLd(buildJsonLd(picks));

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 text-white/90">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <nav className="mb-6 text-xs text-white/50">
        <Link href="/shop" className="hover:text-white">
          {"←"} Back to /shop
        </Link>
      </nav>

      <header>
        <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
          Best Kitchen Gadgets Under $50: 8 Picks We Actually Use (2026)
        </h1>
        <p className="mt-3 text-sm text-white/60">
          Updated 2026-05-10 {"·"} By Jared &amp; Ruthann {"·"} Reading time ~7 min
        </p>
      </header>

      <section className="mt-6 space-y-4 text-base leading-relaxed text-white/85">
        <p>
          We resell secondhand kitchen gear out of our home in Independence,
          Missouri. That means every week, hundreds of small kitchen items
          pass through our hands {"—"} toasters, stand mixer attachments, cast
          iron, weird single-task gadgets nobody asked for. After a year of
          this, we have an opinionated, slightly cynical view on what&rsquo;s
          worth $50 of your kitchen budget and what isn&rsquo;t.
        </p>
        <p>
          This list is the eight gadgets we restock the most because they sell
          fast at a fair price <em>and</em> we keep one of each at home. When
          something on the list goes out of stock at /shop, we link to the
          same Amazon ASIN so you can still grab it. As Amazon Associates we
          earn a small commission if you buy through these links {"—"} at no
          extra cost to you, see our{" "}
          <Link href="/shop/disclosure" className="underline">
            disclosure
          </Link>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-bold text-white">The 8 picks</h2>
        <p className="mt-1 text-sm text-white/60">
          Click any item to grab it from our shop while in stock {"—"} or hop
          straight to Amazon when sold out.
        </p>

        {picks.length === 0 ? (
          <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            We&rsquo;re matching ASINs to our current kitchen inventory.{" "}
            <Link href="/shop?category=Kitchen" className="underline">
              Browse the live kitchen shelf
            </Link>{" "}
            in the meantime.
          </div>
        ) : (
          <ol className="mt-6 space-y-6">
            {picks.map((p, i) => (
              <li
                key={p.id}
                className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row"
              >
                <div className="flex-shrink-0 sm:w-40">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.title}
                      width={320}
                      height={320}
                      className="aspect-square w-full rounded-lg object-cover sm:w-40"
                    />
                  ) : (
                    <div className="aspect-square w-full rounded-lg bg-white/10 sm:w-40" />
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <div className="text-[0.65rem] uppercase tracking-wide text-purple-300">
                    Pick #{i + 1}
                  </div>
                  <h3 className="mt-1 text-lg font-semibold text-white">
                    {p.title}
                  </h3>
                  {p.description && (
                    <p className="mt-2 line-clamp-3 text-sm text-white/70">
                      {p.description}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                    <a
                      href={pickHref(p)}
                      className="rounded-md bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-400"
                      rel="sponsored nofollow noopener"
                      target="_blank"
                    >
                      {p.inStock ? "Shop or buy on Amazon →" : "Buy on Amazon →"}
                    </a>
                    {p.inStock && p.ourPrice && (
                      <span className="text-xs text-white/60">
                        On our shelves: ${p.ourPrice.toFixed(0)}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white">
          What to actually look for in a $50 kitchen gadget
        </h2>
        <p className="mt-2 text-base leading-relaxed text-white/85">
          Most of the &ldquo;best kitchen gadgets&rdquo; lists you see online
          are written by content farms that have never opened the boxes. We
          have. Here&rsquo;s the four-point sniff test we apply before we put
          anything on our shelves at home, in the shop, or in this list.
        </p>
        <ul className="mt-4 space-y-4">
          {BUYING_CHECKLIST.map((item) => (
            <li key={item.title} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="font-semibold text-white">{item.title}</div>
              <p className="mt-1 text-sm text-white/75">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold text-white">FAQ</h2>
        <dl className="mt-4 space-y-4">
          {FAQS.map((f) => (
            <div key={f.q} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <dt className="font-semibold text-white">{f.q}</dt>
              <dd className="mt-1 text-sm text-white/75">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12 rounded-xl border border-purple-400/30 bg-purple-500/10 p-5">
        <h2 className="text-xl font-bold text-white">Want more like this?</h2>
        <p className="mt-1 text-sm text-white/80">
          We post a fresh kitchen pick every Tuesday and a full storefront
          highlight every Sunday. Follow{" "}
          <a
            className="underline"
            href="https://www.facebook.com/RuthannsTreasureHaul"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ruthann&rsquo;s Treasure Haul on Facebook
          </a>{" "}
          or browse the live kitchen shelf at{" "}
          <Link href="/shop?category=Kitchen" className="underline">
            /shop?category=Kitchen
          </Link>
          .
        </p>
      </section>

      <footer className="mt-12 border-t border-white/10 pt-6 text-xs text-white/50">
        As an Amazon Associate I earn from qualifying purchases. Prices on
        Amazon fluctuate; we recheck this list quarterly but we don&rsquo;t
        guarantee the on-Amazon price will match what we list. See our full{" "}
        <Link href="/shop/disclosure" className="underline">
          affiliate disclosure
        </Link>
        .
      </footer>
    </article>
  );
}
