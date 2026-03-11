import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import UnclaimedDashboard from "@/components/leads/UnclaimedDashboard";

export const revalidate = 30;

export default async function UnclaimedFundsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/leads/unclaimed");
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });

  if (!sub || sub.status !== "active") {
    redirect("/leads/pricing");
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Unclaimed Funds</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search government databases for unclaimed property, tax surplus, and
          escheated funds owed to property owners.
        </p>
      </div>
      <UnclaimedDashboard />
    </main>
  );
}
