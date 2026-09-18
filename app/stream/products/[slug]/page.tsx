import { redirect } from "next/navigation";

import LineupClicker from "@/components/stream/LineupClicker";
import { validateWdAdmin } from "@/lib/wd-auth";

// tolley.io/stream/products/<slug> — the clicker: arrow keys walk the lineup and drive the big-screen Amazon window.
export default async function StreamClickerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { authed } = await validateWdAdmin();
  if (!authed) redirect(`/login?callbackUrl=${encodeURIComponent(`/stream/products/${slug}`)}`);
  return <LineupClicker slug={slug} />;
}
