import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/** Explicit owner-only workspace activation. Does not create a Stripe subscription. */
export async function POST(request: NextRequest) {
  const guard = await requireAdminApiSession();
  if (!guard.ok) return guard.response;
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  await prisma.leadSubscriber.upsert({ where: { userId: guard.session.userId },
    create: { userId: guard.session.userId, tier: "team", status: "active", onboarded: true, farmZips: [], farmCities: [], specialties: [], dailyContactGoal: 3, smsLimit: 0 },
    update: { status: "active", onboarded: true },
  });
  return NextResponse.json({ ok: true });
}
