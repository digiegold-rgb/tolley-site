import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { InitiateCheckoutPixel } from "@/components/shop/initiate-checkout-pixel";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout | tolley.io/shop",
  robots: { index: false, follow: false },
};

/**
 * Meta Shop "checkout on another website" landing page.
 * Commerce Manager sends buyers here as:
 *   /checkout?products=<productId>:<qty>[,<id>:<qty>...]&coupon=<code>
 * Meta's automated checkout review loads this URL and verifies every product
 * (with quantity) appears in the cart, so this must render a real cart
 * summary — not redirect. Product ids match /api/shop/meta-feed.
 */

const CART_SELECT = {
  id: true,
  goSlug: true,
  title: true,
  imageUrls: true,
  targetPrice: true,
  soldPrice: true,
  status: true,
  listings: {
    where: { platform: "shop" },
    select: { price: true, status: true },
  },
} satisfies Prisma.ProductSelect;

type CartProduct = Prisma.ProductGetPayload<{ select: typeof CART_SELECT }>;

function productPrice(p: CartProduct): number {
  const active = p.listings.find((l) => l.status === "active");
  return active?.price ?? p.soldPrice ?? p.listings[0]?.price ?? p.targetPrice ?? 0;
}

function parseCart(raw: string): { id: string; qty: number }[] {
  return raw
    .split(",")
    .map((entry) => {
      const [id, qty] = entry.split(":");
      return { id: id?.trim() ?? "", qty: Math.max(1, parseInt(qty ?? "1", 10) || 1) };
    })
    .filter((e) => e.id.length > 0);
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ products?: string; coupon?: string }>;
}) {
  const { products: rawProducts = "", coupon } = await searchParams;
  const entries = parseCart(rawProducts);
  const ids = entries.map((e) => e.id);

  const found = ids.length
    ? await prisma.product.findMany({
        where: { OR: [{ id: { in: ids } }, { goSlug: { in: ids } }] },
        select: CART_SELECT,
      })
    : [];
  const byKey = new Map<string, CartProduct>();
  for (const p of found) {
    byKey.set(p.id, p);
    if (p.goSlug) byKey.set(p.goSlug, p);
  }

  const lines = entries.map((e) => {
    const product = byKey.get(e.id) ?? null;
    const price = product ? productPrice(product) : 0;
    return { ...e, product, price, total: price * e.qty };
  });
  const cartTotal = lines.reduce((sum, l) => sum + l.total, 0);
  const matchedIds = lines.filter((l) => l.product).map((l) => l.product!.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <InitiateCheckoutPixel
        ids={matchedIds}
        value={cartTotal}
        numItems={lines.reduce((n, l) => n + l.qty, 0)}
      />
      <h1 className="text-2xl font-bold">Your cart</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Ruthann&apos;s Treasure Haul — local pickup in the Kansas City metro.
      </p>

      {lines.length === 0 ? (
        <div className="mt-8 rounded-lg border border-neutral-200 p-6 text-center">
          <p>Your cart is empty.</p>
          <Link href="/shop" className="mt-2 inline-block font-semibold underline">
            Browse the shop
          </Link>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
          {lines.map((line, i) => (
            <li key={`${line.id}-${i}`} className="flex items-center gap-4 p-4">
              {line.product?.imageUrls?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={line.product.imageUrls[0]}
                  alt={line.product.title}
                  className="h-20 w-20 flex-none rounded-md object-cover"
                />
              ) : (
                <div className="h-20 w-20 flex-none rounded-md bg-neutral-100" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {line.product?.title ?? `Item ${line.id}`}
                </p>
                <p className="text-sm text-neutral-500">Quantity: {line.qty}</p>
                {line.product ? (
                  <Link
                    href={`/shop/${line.product.goSlug ?? line.product.id}`}
                    className="text-sm underline"
                  >
                    View item
                  </Link>
                ) : (
                  <p className="text-sm text-neutral-500">
                    This item is no longer available.
                  </p>
                )}
              </div>
              <div className="text-right font-semibold">
                {line.product ? `$${line.total.toFixed(2)}` : "—"}
              </div>
            </li>
          ))}
        </ul>
      )}

      {coupon ? (
        <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
          Promo code <span className="font-mono font-semibold">{coupon}</span> noted
          — it will be applied when you complete your purchase.
        </p>
      ) : null}

      {lines.length > 0 ? (
        <div className="mt-4 flex items-center justify-between border-t border-neutral-200 pt-4">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold">${cartTotal.toFixed(2)}</span>
        </div>
      ) : null}

      <div className="mt-8 rounded-lg bg-neutral-50 p-4 text-sm text-neutral-600">
        <p className="font-semibold text-neutral-800">How buying works</p>
        <p className="mt-1">
          Everything is sold for local pickup in the Kansas City metro. Open an
          item above and use its message button to claim it — we&apos;ll confirm
          availability, pickup time, and payment.
        </p>
      </div>
    </main>
  );
}
