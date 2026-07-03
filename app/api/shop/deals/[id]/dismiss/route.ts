/**
 * POST /api/shop/deals/[id]/dismiss — hide a deal from the active queue.
 * Auth: shop admin session. Body: { undo?: boolean } to restore to "new".
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let undo = false;
  try {
    undo = (await req.json())?.undo === true;
  } catch {
    /* no body */
  }

  const deal = await prisma.retailDeal.update({
    where: { id },
    data: undo
      ? { status: "new", dismissedAt: null }
      : { status: "dismissed", dismissedAt: new Date() },
    select: { id: true, status: true },
  });

  return NextResponse.json({ ok: true, deal });
}
