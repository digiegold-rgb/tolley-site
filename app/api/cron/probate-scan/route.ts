import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { serpapiKey } from "@/lib/serpapi";
import {
  runProbateDiscovery,
  enrichRecentDiscovered,
} from "@/lib/serpapi/probate-runner";

export const maxDuration = 120;

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
