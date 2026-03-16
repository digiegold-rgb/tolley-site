import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const check = await requireAdminApiSession();
  if (!check.ok) return check.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const drivers = await prisma.deliveryDriver.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } },
      _count: { select: { orders: true, earnings: true } },
    },
  });

  return NextResponse.json({ drivers });
}
