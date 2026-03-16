import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const link = await prisma.affiliateLink.findUnique({
    where: { shortCode: code },
  });

  if (!link || !link.isActive) {
    return NextResponse.redirect(new URL("/shop", _req.url));
  }

  // Increment click counter (fire and forget)
  prisma.affiliateLink.update({
    where: { id: link.id },
    data: { clicks: { increment: 1 } },
  }).catch(() => {});

  return NextResponse.redirect(link.affiliateUrl);
}
