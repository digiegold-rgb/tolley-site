import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Amazon Picks | tolley.io/shop",
  description:
    "Three Amazon picks. As an Amazon Associate I earn from qualifying purchases.",
  alternates: { canonical: "https://www.tolley.io/shop/picks" },
};

const TAG = "tolleyshop-20";

const PICKS = [
  {
    asin: "B0DSP85F1P",
    title: "10-pack rain ponchos",
    href: `https://www.amazon.com/dp/B0DSP85F1P?tag=${TAG}`,
    price: "$11.99",
  },
  {
    asin: "B0GFFVDY83",
    title: "Kitsch Root Hair Texture Spray",
    href: `https://www.amazon.com/dp/B0GFFVDY83?tag=${TAG}`,
  },
  {
    asin: "B0DQ4K7DLY",
    title: "punch-needle coaster kit",
    href: `https://www.amazon.com/dp/B0DQ4K7DLY?tag=${TAG}`,
  },
] as const;

export default function ShopPicksPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-white">Amazon Picks</h1>
      <p className="mt-2 text-xs leading-relaxed text-white/60">
        As an Amazon Associate I earn from qualifying purchases. Each card
        below is an affiliate link (paid link).
      </p>
      <ul className="mt-4 space-y-3">
        {PICKS.map((p) => (
          <li key={p.asin}>
            <a
              href={p.href}
              target="_blank"
              rel="nofollow sponsored noopener noreferrer"
              className="block rounded-xl border border-white/15 bg-white/5 px-4 py-4 transition hover:border-amber-400/50 hover:bg-white/[0.07]"
            >
              <p className="text-base font-semibold text-white">{p.title}</p>
              {"price" in p ? (
                <p className="mt-0.5 text-sm text-white/70">{p.price}</p>
              ) : null}
              <p className="mt-2 text-xs font-medium text-amber-300">
                Amazon (paid link) →
              </p>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[0.7rem] leading-relaxed text-white/40">
        Affiliate tag {TAG}.{" "}
        <Link href="/shop/disclosure" className="underline hover:text-white/60">
          Full disclosure
        </Link>
        .{" "}
        <Link href="/shop" className="underline hover:text-white/60">
          Back to /shop
        </Link>
        .
      </p>
    </div>
  );
}
