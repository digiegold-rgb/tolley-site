import { validateShopAdmin } from "@/lib/shop-auth";
import { ResearchPinGate } from "./research-pin-gate";
import { ResearchClient } from "./research-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Deep Research — tolley.io",
  description:
    "Ask any question. Cached answers are instant; new questions get a live AI deep-research run with cited, verified sources.",
};

export default async function ResearchPage() {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) return <ResearchPinGate />;
  return <ResearchClient />;
}
