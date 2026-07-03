import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { syncPlaidToBudget } from "@/lib/budget/plaid-bridge";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  try {
    const report = await syncPlaidToBudget(auth.session.userId);
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
