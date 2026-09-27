import { redirect } from "next/navigation";

import LineupBuilder from "@/components/stream/LineupBuilder";
import { validateWdAdmin } from "@/lib/wd-auth";

// tolley.io/stream/products — build the run-of-show for a live sale + the per-item prep worksheet.
// Gate: same as /stream and /hq — owner session + MFA.
export default async function StreamProductsPage({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const { authed } = await validateWdAdmin();
  if (!authed) redirect("/login?callbackUrl=/stream/products");
  const { l } = await searchParams;
  return <LineupBuilder initialSlug={typeof l === "string" ? l : null} />;
}
