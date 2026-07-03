import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StudioClient } from "./studio-client";
import { StudioLanding } from "./studio-landing";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export default async function StudioPage() {
  const session = await auth();

  // Not logged in → show landing page
  if (!session?.user?.id) {
    return <StudioLanding />;
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
