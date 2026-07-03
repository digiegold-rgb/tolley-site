import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { resolveAmazonTag } from "@/lib/shop";
import BatchClient, { type BatchProduct } from "./BatchClient";

export const metadata: Metadata = {
  title: "Amazon Batch | tolley.io/shop",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function isAdmin() {
  const c = await cookies();
  return !!c.get("shop_admin");
}

export default async function AmazonBatchPage() {
  if (!(await isAdmin())) redirect("/shop");

  const products = await prisma.product.findMany({
    where: { status: "listed" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      imageUrls: true,
      category: true,
      amazonAsin: true,
      asinMatchedAt: true,
    },
  });

  const items: BatchProduct[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    imageUrl: p.imageUrls[0] || null,
    category: p.category,
    amazonAsin: p.amazonAsin,
    alreadyDone: !!p.amazonAsin || !!p.asinMatchedAt,
  }));

  return <BatchClient items={items} amazonTag={resolveAmazonTag()} />;
}
