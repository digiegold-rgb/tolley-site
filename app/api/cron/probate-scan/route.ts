import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { serpapiKey } from "@/lib/serpapi";
import {
  runProbateDiscovery,
  enrichRecentDiscovered,
} from "@/lib/serpapi/probate-runner";

// 300s, not 120s: discovery (6 throttled targets) plus enrichment (6 signals ×
// up to 2 queries) now includes 1.2s spacing and a 1.5s retry back-off. A slow
// run could otherwise exceed the limit mid-`after()`, which truncates silently
// and loses the scan for that day.
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

async function handler(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!serpapiKey()) {
    return NextResponse.json({ skipped: true }, { status: 200 });
  }

  after(async () => {
    try {
      const discovery = await runProbateDiscovery();
      const enrichment = await enrichRecentDiscovered(6);
      console.log("[probate-scan] done", { discovery, enrichment });
    } catch (err) {
      console.error("[probate-scan] failed", err);
    }
  });

  return NextResponse.json({ scheduled: true });
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
