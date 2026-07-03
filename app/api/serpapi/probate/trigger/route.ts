import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { serpapiKey } from "@/lib/serpapi";
import { validateShopAdmin } from "@/lib/shop-auth";
import {
  runProbateDiscovery,
  enrichRecentDiscovered,
} from "@/lib/serpapi/probate-runner";

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
      const discovery = await runProbateDiscovery();
      const enrichment = await enrichRecentDiscovered(6);
      console.log("[probate-trigger]", { discovery, enrichment });
    } catch (err) {
      console.error("[probate-trigger] failed", err);
    }
  });

  return NextResponse.json({ scheduled: true });
}
