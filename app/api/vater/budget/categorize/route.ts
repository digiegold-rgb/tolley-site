import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { recategorizeNeedsReview } from "@/lib/budget/plaid-bridge";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST() {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const result = await recategorizeNeedsReview(auth.session.userId);
  return NextResponse.json({ ok: true, ...result });
}
