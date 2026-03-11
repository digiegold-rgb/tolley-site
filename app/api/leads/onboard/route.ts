import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/leads/onboard
 *
 * Save agent's farm area and specialties after subscribing.
 * Body: { farmZips: string[], farmCities: string[], specialties: string[] }
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });

  if (!sub) {
    return NextResponse.json(
      { error: "No leads subscription found. Subscribe first." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const farmZips: string[] = Array.isArray(body.farmZips)
    ? body.farmZips.filter((z: unknown) => typeof z === "string" && /^\d{5}$/.test(z))
    : [];
  const farmCities: string[] = Array.isArray(body.farmCities)
    ? body.farmCities.filter((c: unknown) => typeof c === "string" && c.length > 0)
    : [];
  const specialties: string[] = Array.isArray(body.specialties)
    ? body.specialties.filter((s: unknown) => typeof s === "string")
    : [];

  if (farmZips.length === 0 && farmCities.length === 0) {
    return NextResponse.json(
      { error: "Select at least one zip code or city for your farm area." },
      { status: 400 }
    );
  }

  const updated = await prisma.leadSubscriber.update({
    where: { userId },
    data: {
      farmZips,
      farmCities,
      specialties,
      onboarded: true,
    },
  });

  return NextResponse.json({ ok: true, subscriber: updated });
}

/**
 * GET /api/leads/onboard
 *
 * Get current subscriber's farm area config.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });

  if (!sub) {
    return NextResponse.json({ subscriber: null });
  }

  return NextResponse.json({ subscriber: sub });
}
