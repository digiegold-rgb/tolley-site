/**
 * GET/POST /api/cron/distress-scan — Weekly distressed-seller signal scan.
 *
 * Schedule: Thursdays 09:30 UTC (vercel.json crons entry) — a day after
 * probate so the two don't burst the SerpAPI 200/hr cap together.
 *
 * Scans 6 SerpAPI google queries for pre-foreclosure / trustee & sheriff
 * sales, tax-delinquency lists, and code-violation dockets in Jackson County,
 * dedupes into DistressSignal rows, then PUSHES the new finds to Cordless via
 * Telegram + email (notifyRoutineBrief). The whole point: leads come to him.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}, OR x-sync-secret = SYNC_SECRET
 * (lets Cordless trigger a manual run via curl).
 */

import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { serpapiKey } from "@/lib/serpapi";
import { runDistressDiscovery } from "@/lib/serpapi/distress-runner";
import { KIND_LABEL, type DistressKind } from "@/lib/serpapi/distress-config";
import { notifyRoutineBrief } from "@/lib/routine-notify";

export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${process.env.CRON_SECRET}`) return true;
  const sync = req.headers.get("x-sync-secret");
  if (sync && sync === process.env.SYNC_SECRET) return true;
  return false;
}

function buildDigest(
  created: Awaited<ReturnType<typeof runDistressDiscovery>>["created"]
): string {
  // Group by kind for a scannable brief.
  const byKind = new Map<string, typeof created>();
  for (const c of created) {
    const arr = byKind.get(c.kind) ?? [];
    arr.push(c);
    byKind.set(c.kind, arr);
  }

  const lines: string[] = [];
  for (const [kind, rows] of byKind) {
    lines.push(`\n${KIND_LABEL[kind as DistressKind] ?? kind} (${rows.length})`);
    for (const r of rows.slice(0, 8)) {
      const where = [r.addressGuess, r.city].filter(Boolean).join(", ");
      const who = r.ownerGuess ? ` — owner: ${r.ownerGuess}` : "";
      const loc = where ? ` — ${where}` : "";
      const link = r.sourceUrl ? `\n  ${r.sourceUrl}` : "";
      lines.push(`• ${r.title.slice(0, 120)}${loc}${who}${link}`);
    }
    if (rows.length > 8) lines.push(`  …and ${rows.length - 8} more`);
  }
  lines.push(`\nReview & promote at tolley.io/shop/dashboard/serpapi/distress`);
  return lines.join("\n");
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
      const discovery = await runDistressDiscovery();
      console.log("[distress-scan] done", {
        scanned: discovery.scanned,
        newSignals: discovery.newSignals,
        duplicates: discovery.duplicates,
        failures: discovery.failures,
      });

      // Feed Cordless: only push when there's something new to act on.
      if (discovery.created.length > 0) {
        notifyRoutineBrief({
          slug: "distress-scan",
          title: `🏚️ ${discovery.created.length} new distressed-seller lead${
            discovery.created.length === 1 ? "" : "s"
          } this week`,
          body: buildDigest(discovery.created),
          severity: "action",
          email: true,
        });
      }
    } catch (err) {
      console.error("[distress-scan] failed", err);
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
