import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getUserBillingState, isSubscribed } from "@/lib/billing-state";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const billingState = await getUserBillingState(userId);
  return NextResponse.json({
    ...billingState,
    subscribed: isSubscribed(billingState),
  });
}
