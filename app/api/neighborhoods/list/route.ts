import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(_req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pages = await prisma.neighborhoodPage.findMany({
    orderBy: [{ state: "asc" }, { city: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      state: true,
      zip: true,
      published: true,
      generatedAt: true,
      faqJson: true,
      serpapiQueriesUsed: true,
    },
  });

  return NextResponse.json({
    pages: pages.map((p) => ({
      ...p,
      faqCount: Array.isArray(p.faqJson) ? p.faqJson.length : 0,
      faqJson: undefined,
    })),
  });
}
