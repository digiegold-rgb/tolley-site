import { routeDestination, type RouteSearchParams } from "@/lib/public-route-policy";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StudioClient } from "./studio-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default async function StudioPage({ searchParams }: { searchParams: Promise<RouteSearchParams> }) {
  const session = await auth();

  // New visitors enter through the current product; existing customers keep their workspace.
  if (!session?.user?.id) {
    redirect(routeDestination("/animate", await searchParams));
  }

  const isAdmin =
    !!session.user.email &&
    ADMIN_EMAILS.includes(session.user.email.toLowerCase());

  // Ensure user has a credit record
  if (!isAdmin) {
    await prisma.videoCredit.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, balance: 0 },
      update: {},
    });
  }

  // Get credit balance for non-admin users
  const credit = isAdmin
    ? null
    : await prisma.videoCredit.findUnique({
        where: { userId: session.user.id },
        select: { balance: true, subscriptionTier: true },
      });

  return (
    <StudioClient
      isAdmin={isAdmin}
      userId={session.user.id}
      creditBalance={isAdmin ? -1 : (credit?.balance ?? 0)}
      subscriptionTier={credit?.subscriptionTier ?? null}
    />
  );
}
