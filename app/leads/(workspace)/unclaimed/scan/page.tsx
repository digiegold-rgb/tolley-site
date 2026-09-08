import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import UnclaimedScanForm from "@/components/leads/UnclaimedScanForm";
import type { LeadsTier } from "@/lib/leads-subscription";

export default async function NewUnclaimedScanPage() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/login?callbackUrl=/leads/unclaimed/scan");
  }

  const sub = await prisma.leadSubscriber.findUnique({
    where: { userId },
  });

  if (!sub || sub.status !== "active") {
    redirect("/leads/pricing");
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          New Unclaimed Funds Scan
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Search state unclaimed property databases by owner name.
        </p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <UnclaimedScanForm
          tier={sub.tier as LeadsTier}
          fundScanUsed={sub.fundScanUsed}
          fundScanLimit={sub.fundScanLimit}
        />
      </div>
    </main>
  );
}
