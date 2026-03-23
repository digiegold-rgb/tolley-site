import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const LEDGER_URL = "http://127.0.0.1:8920";
const BEARER = process.env.LEDGER_BEARER_TOKEN || "b9a081c92e68b3f874636bf6c687754edb130136312d012627bdbd61d6f584ed";

export async function GET() {
  const check = await requireAdminApiSession();
  if (check instanceof NextResponse) return check;

  try {
    const resp = await fetch(`${LEDGER_URL}/reconciliation`, {
      headers: { Authorization: `Bearer ${BEARER}` },
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch reconciliation data" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const check = await requireAdminApiSession();
  if (check instanceof NextResponse) return check;

  try {
    // Sync Stripe payouts first
    await fetch(`${LEDGER_URL}/stripe/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${BEARER}` },
    });

    // Then run reconciliation
    const resp = await fetch(`${LEDGER_URL}/reconcile`, {
      method: "POST",
      headers: { Authorization: `Bearer ${BEARER}` },
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reconciliation failed" },
      { status: 500 },
    );
  }
}
