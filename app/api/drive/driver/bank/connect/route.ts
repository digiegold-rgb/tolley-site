import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { linkDriverBank } from "@/lib/dispatch/payouts";

const LEDGER_URL = "http://127.0.0.1:8920";
const BEARER = process.env.LEDGER_BEARER_TOKEN || "b9a081c92e68b3f874636bf6c687754edb130136312d012627bdbd61d6f584ed";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { public_token, account_id } = await request.json();
  if (!public_token) {
    return NextResponse.json({ error: "public_token required" }, { status: 400 });
  }

  // Find driver record for this user
  const driver = await prisma.deliveryDriver.findUnique({
    where: { userId: session.user.id },
  });
  if (!driver) {
    return NextResponse.json({ error: "Driver profile not found" }, { status: 404 });
  }

  try {
    // Get Stripe processor token from xero-ledger
    const setupResp = await fetch(`${LEDGER_URL}/pay/ach-setup`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BEARER}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ public_token, account_id }),
    });
    const setupData = await setupResp.json();
    if (setupData.error) throw new Error(setupData.error);

    // Link bank to driver's Stripe Connect account
    const result = await linkDriverBank(
      driver.id,
      setupData.stripeBankToken,
      setupData.accountMask || "****",
      setupData.accountName || "Bank",
      `plaid-driver-${driver.id}`,
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Bank linking failed" },
      { status: 500 },
    );
  }
}
