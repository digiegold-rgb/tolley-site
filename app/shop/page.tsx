import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatPrice, timeAgo, FACEBOOK_PROFILE_URL } from "@/lib/shop";
import BuyButton from "@/components/shop/BuyButton";

export const revalidate = 300;

interface DisplayItem {
  id: string;
  title: string;
  price: number;
  description: string | null;
  category: string | null;
  imageUrls: string[];
  createdAt: Date;
  source: "product" | "shopItem";
}

async function getActiveItems(): Promise<DisplayItem[]> {
  // Try Product model first (new)
  try {
    const products = await prisma.product.findMany({
      where: {
        status: "listed",
        listings: { some: { platform: "shop", status: "active" } },
      },
      include: { listings: { where: { platform: "shop", status: "active" } } },
      orderBy: { createdAt: "desc" },
    });

    if (products.length > 0) {
      return products.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.listings[0]?.price ?? p.targetPrice ?? 0,
        description: p.description,
        category: p.category,
        imageUrls: p.imageUrls,
        createdAt: p.createdAt,
        source: "product" as const,
      }));
    }
  } catch {
    // Product model query failed — fall through to ShopItem
  }

  // Fallback to ShopItem (legacy)
  const items = await prisma.shopItem.findMany({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
  });

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    price: item.price,
    description: item.description,
    category: item.category,
    imageUrls: item.imageUrls,
    createdAt: item.createdAt,
    source: "shopItem" as const,
  }));
}

export default async function ShopPage() {
  const items = await getActiveItems();

  if (items.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <p className="text-4xl">🛍️</p>
        <h2 className="mt-4 text-xl font-bold text-white">
          Check back soon — new items daily!
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Items get posted regularly. Follow on Facebook for first dibs.
        </p>
        <a
          href={FACEBOOK_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shop-cta mt-6 rounded-full px-5 py-2 text-sm font-semibold text-white"
        >
          Follow on Facebook
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="shop-card shop-enter rounded-xl"
            style={{ animationDelay: `${Math.min(i, 5) * 50}ms` }}
          >
            {/* Image */}
            {item.imageUrls.length > 0 && (
              <div className="relative aspect-square w-full overflow-hidden bg-white/5">
                <Image
                  src={item.imageUrls[0]}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>
            )}

            {/* Info */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-white leading-snug">
                  {item.title}
                </h3>
                <span className="shrink-0 text-lg font-bold text-purple-300">
                  {formatPrice(item.price)}
                </span>
              </div>

              {item.description && (
                <p className="mt-1.5 text-sm text-white/50 line-clamp-2">
                  {item.description}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-white/30">
                  {timeAgo(item.createdAt)}
                </span>
                {item.category && (
                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[0.65rem] text-white/50">
                    {item.category}
                  </span>
                )}
              </div>

              <div className="mt-3">
                <BuyButton itemId={item.id} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-8 text-center">
        <p className="text-sm text-white/40">
          Interested in something? Message to claim it.
        </p>
        <a
          href={FACEBOOK_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="shop-cta mt-3 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-white"
        >
          Message on Facebook
        </a>
      </div>
    </div>
  );
}
