/**
 * GET  /api/vater/arbitrage — List pairs (optional ?status= filter)
 * POST /api/vater/arbitrage — Create a new arbitrage pair
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeMargin } from "@/lib/vater/arbitrage-scanner";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where = status ? { status } : {};

  const pairs = await prisma.arbitragePair.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ pairs });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const body = await req.json();

  const required = ["ebayTitle", "ebayPrice", "amazonTitle", "amazonPrice"];
  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return NextResponse.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );
    }
  }

  const ebayPrice = Number(body.ebayPrice);
  const amazonPrice = Number(body.amazonPrice);
  const feeRate = body.ebayFeeRate ? Number(body.ebayFeeRate) : 0.13;

  const { ebayFees, profit, marginPercent, roi } = computeMargin(
    ebayPrice,
    amazonPrice,
    feeRate
  );

  const pair = await prisma.arbitragePair.create({
    data: {
      ebayTitle: body.ebayTitle,
      ebayPrice,
      ebayUrl: body.ebayUrl ?? null,
      ebayImageUrl: body.ebayImageUrl ?? null,
      ebayItemId: body.ebayItemId ?? null,
      amazonTitle: body.amazonTitle,
      amazonPrice,
      amazonUrl: body.amazonUrl ?? null,
      amazonImageUrl: body.amazonImageUrl ?? null,
      amazonAsin: body.amazonAsin ?? null,
      ebayFeeRate: feeRate,
      ebayFees,
      profit,
      marginPercent,
      roi,
      source: body.source ?? "manual",
      submittedBy: body.submittedBy ?? null,
      category: body.category ?? null,
      notes: body.notes ?? null,
    },
  });

  return NextResponse.json({ ok: true, pair }, { status: 201 });
}
