import { validateShopAdmin } from "@/lib/shop-auth";
import { ActionPinGate } from "./pin-gate";
import { ActionDashboard } from "./action-client";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Action Cam — tolley.io",
  description: "Auto-edited adventure recaps from the DJI Action 6, organized and ready for Plex + social.",
};

export default async function ActionPage() {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) return <ActionPinGate />;
  // Token only reaches the browser after the admin gate passes.
  return <ActionDashboard token={process.env.ACTION_API_TOKEN || ""} />;
}
