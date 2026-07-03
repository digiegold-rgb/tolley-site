import { NextResponse } from "next/server";
import { requireVaterAdminApiSession } from "@/lib/admin-auth";
import { getCategoryStates, getMonthHero, getRecentEntries } from "@/lib/budget/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireVaterAdminApiSession();
  if (!auth.ok) return auth.response;

  const userId = auth.session.userId;
  const [hero, categories, recent] = await Promise.all([
    getMonthHero(userId),
    getCategoryStates(userId, "month"),
    getRecentEntries(userId, 20),
  ]);

  return NextResponse.json({ hero, categories, recent });
}
