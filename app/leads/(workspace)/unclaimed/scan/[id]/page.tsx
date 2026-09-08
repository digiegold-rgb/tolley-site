import { auth } from "@/auth";
import { redirect } from "next/navigation";
import UnclaimedScanResults from "@/components/leads/UnclaimedScanResults";

export default async function ScanResultsPage({
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
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <a
          href="/leads/unclaimed"
          className="text-sm text-blue-600 hover:underline"
        >
          &larr; Back to Unclaimed Funds
        </a>
      </div>
      <UnclaimedScanResults scanId={id} />
    </main>
  );
}
