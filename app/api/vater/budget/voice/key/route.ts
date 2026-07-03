import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const key = process.env.VATER_BUDGET_VOICE_KEY ?? "";
  if (!key || key.length < 24) {
    return NextResponse.json({ key: null, configured: false });
  }
  return NextResponse.json({ key, configured: true });
}
