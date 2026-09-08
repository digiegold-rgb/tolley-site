import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LeadsSettingsPage from "@/components/leads/LeadsSettingsPage";

export const revalidate = 0;

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/leads/settings");
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId: session.user.id },
  });

  if (!sub || sub.status !== "active") redirect("/leads/pricing");

  return (
    <LeadsSettingsPage
      tier={sub.tier}
      farmZips={sub.farmZips}
      specialties={sub.specialties}
      smsUsed={sub.smsUsed}
      smsLimit={sub.smsLimit}
    />
  );
}
