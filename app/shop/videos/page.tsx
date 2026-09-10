import { SHOP_VIDEO_WHERE } from "@/lib/shop-video-visibility";
import { redirect } from "next/navigation";
import { routeDestination, type RouteSearchParams } from "@/lib/public-route-policy";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import VideoTile from "@/components/shop/VideoTile";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Product Videos | tolley.io/shop",
  description:
    "Watch quick product videos before you buy. Real items, real condition, no surprises.",
  alternates: { canonical: "https://www.tolley.io/shop/videos" },
  openGraph: {
    title: "Product Videos | tolley.io/shop",
    description: "Quick portrait videos of every item we list.",
    url: "https://www.tolley.io/shop/videos",
    type: "website",
  },
};

export default async function VideosPage({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  const products = await prisma.product.findMany({
    where: SHOP_VIDEO_WHERE,
    orderBy: { createdAt: "desc" },
    include: {
      listings: { where: { platform: "shop" }, take: 1 },
    },
  });

  if (products.length === 0) redirect(routeDestination("/shop", await searchParams));

  const tiles = products.map((p) => ({
    id: p.id,
    title: p.title,
    price: p.listings[0]?.price ?? p.targetPrice ?? p.soldPrice ?? 0,
    shipPrice: p.shipPrice ?? null,
    amazonAsin: p.amazonAsin ?? null,
    description: p.description,
    category: p.category,
    imageUrls: p.imageUrls,
    videoUrl: p.videoUrl,
    videoThumbnailUrl: p.videoThumbnailUrl ?? null,
    videoDurationSec: p.videoDurationSec ?? null,
    status: p.status,
    createdAt: p.createdAt,
    fbListingId: p.fbListingId,
  }));

  return (
    <div>
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/70">
        <span className="font-semibold text-white/90">Product videos.</span>{" "}
        Tap any tile to watch the walkaround and see full details. Portrait
        videos play in the same modal as photos.
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {tiles.map((p) => (
          <VideoTile key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
