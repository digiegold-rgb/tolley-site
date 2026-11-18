import type { Metadata } from "next";
import { validateHeatAccess } from "@/lib/heat/auth";
import { emptyHeatView, loadHeatView } from "@/lib/heat/store";
import { HeatDashboard } from "./dashboard";
import { HeatPinGate } from "./pin-gate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Heat",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default async function HeatPage() {
  const unlocked = await validateHeatAccess();
  if (!unlocked) return <HeatPinGate />;
  try {
    return <HeatDashboard initial={await loadHeatView()} />;
  } catch (error) {
    console.error("[heat] dashboard read failed", error instanceof Error ? error.name : "error");
    return <HeatDashboard initial={emptyHeatView()} unavailable />;
  }
}
