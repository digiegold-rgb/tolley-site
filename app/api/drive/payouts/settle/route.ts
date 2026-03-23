import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { processDriverPayouts } from "@/lib/dispatch/payouts";

export async function POST() {
  const check = await requireAdminApiSession();
  if (check instanceof NextResponse) return check;

  try {
    const result = await processDriverPayouts();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Settlement failed" },
      { status: 500 },
    );
  }
}
