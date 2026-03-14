import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const wallets = await prisma.cryptoWallet.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    wallets: wallets.map((w) => ({
      id: w.id,
      provider: w.provider,
      network: w.network,
      address: w.address,
      balanceUsd: w.balanceUsd,
      balances: w.balances,
      mode: w.mode,
      updatedAt: w.updatedAt.toISOString(),
    })),
  });
}
