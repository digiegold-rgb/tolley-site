import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";

// Owner-only stream controls (OBS/director, lineups, coach, stock, growth).
// The public product slideshow lives in the sibling (public) group at /stream/slideshow
// so an OBS Browser Source can load it without this session. Do not move that page here.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stream",
  robots: { index: false, follow: false },
};

export default async function StreamLayout({ children }: { children: React.ReactNode }) {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=/stream");
  return children;
}
