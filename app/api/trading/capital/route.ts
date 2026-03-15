import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const VALID_ASSET_CLASSES = ["crypto", "stocks_conservative", "stocks_aggressive", "polymarket"];
const VALID_FLOW_TYPES = ["deposit", "withdrawal"];

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const assetClass = searchParams.get("assetClass");

  try {
    const where: any = {};
    if (assetClass && VALID_ASSET_CLASSES.includes(assetClass)) {
      where.assetClass = assetClass;
    }

    const flows = await prisma.tradingCapitalFlow.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Aggregates
    const [deposits, withdrawals] = await Promise.all([
      prisma.tradingCapitalFlow.aggregate({
        where: { ...where, flowType: "deposit" },
        _sum: { amount: true },
      }),
      prisma.tradingCapitalFlow.aggregate({
        where: { ...where, flowType: "withdrawal" },
        _sum: { amount: true },
      }),
    ]);

    return NextResponse.json({
      flows: flows.map((f) => ({
        id: f.id,
        assetClass: f.assetClass,
        flowType: f.flowType,
        amount: f.amount,
        currency: f.currency,
        broker: f.broker,
        note: f.note,
        createdAt: f.createdAt.toISOString(),
      })),
      totals: {
        deposits: deposits._sum.amount || 0,
        withdrawals: withdrawals._sum.amount || 0,
        net: (deposits._sum.amount || 0) - (withdrawals._sum.amount || 0),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  try {
    const body = await request.json();
    const { assetClass, flowType, amount, currency, broker, note } = body;

    if (!assetClass || !VALID_ASSET_CLASSES.includes(assetClass)) {
      return NextResponse.json({ error: "Invalid assetClass" }, { status: 400 });
    }
    if (!flowType || !VALID_FLOW_TYPES.includes(flowType)) {
      return NextResponse.json({ error: "Invalid flowType (deposit|withdrawal)" }, { status: 400 });
    }
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const flow = await prisma.tradingCapitalFlow.create({
      data: {
        assetClass,
        flowType,
        amount,
        currency: currency || "USD",
        broker: broker || null,
        note: note || null,
      },
    });

    return NextResponse.json({
      ok: true,
      flow: {
        id: flow.id,
        assetClass: flow.assetClass,
        flowType: flow.flowType,
        amount: flow.amount,
        currency: flow.currency,
        broker: flow.broker,
        note: flow.note,
        createdAt: flow.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
