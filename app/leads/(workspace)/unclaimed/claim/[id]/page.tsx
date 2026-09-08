import { auth } from "@/auth";
import { redirect } from "next/navigation";
import UnclaimedClaimTracker from "@/components/leads/UnclaimedClaimTracker";

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/leads/unclaimed");
  }

  const { id } = await params;

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <a
          href="/leads/unclaimed"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Unclaimed Funds
        </a>
      </div>
      <UnclaimedClaimTracker claimId={id} />
    </main>
  );
}
