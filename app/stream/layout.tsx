import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { validateWdAdmin } from "@/lib/wd-auth";

// /stream and everything under it is an owner-only control surface. The pages gate themselves
// (client 401 flow on /stream, server redirect on /stream/products/*); this only keeps them uncrawled.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stream",
  robots: { index: false, follow: false },
};

export default async function StreamLayout({ children }: { children: React.ReactNode }) {
  if (!(await validateWdAdmin()).authed) redirect("/login?callbackUrl=/stream");
  return children;
}
