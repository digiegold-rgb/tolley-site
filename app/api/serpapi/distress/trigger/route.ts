import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { serpapiKey } from "@/lib/serpapi";
import { validateShopAdmin } from "@/lib/shop-auth";
import { runDistressDiscovery } from "@/lib/serpapi/distress-runner";

export const maxDuration = 120;

export async function POST(_req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serpapiKey()) {
    return NextResponse.json({ error: "SERPAPI_KEY missing" }, { status: 503 });
  }

  after(async () => {
    try {
      const discovery = await runDistressDiscovery();
      console.log("[distress-trigger]", {
        scanned: discovery.scanned,
        newSignals: discovery.newSignals,
        duplicates: discovery.duplicates,
        failures: discovery.failures,
      });
    } catch (err) {
      console.error("[distress-trigger] failed", err);
    }
  });

  return NextResponse.json({ scheduled: true });
}
