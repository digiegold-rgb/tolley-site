/**
 * POST /api/vater/social-billing/run
 *
 * Daily sweep for the $6/month-per-connected-account social billing
 * (lib/vater/billing/social-billing.ts). Hit by a DGX cron — auth is the
 * same Bearer CONTENT_API_KEY (or /hq PIN cookie) every operator route uses.
 * ?dryRun=1 reports without charging or disconnecting.
 */
import { NextRequest, NextResponse } from "next/server";
import { authorizeConcierge } from "@/lib/vater/concierge-auth";
import { runSocialBilling } from "@/lib/vater/billing/social-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authed = await authorizeConcierge(req);
  if (!authed.ok) return authed.response;
  const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
  const summary = await runSocialBilling(new Date(), { dryRun });
  console.log(
    `[social-billing] scanned=${summary.scanned} charged=${summary.charged} already=${summary.already} unmetered=${summary.unmetered} disconnected=${summary.disconnected.length} errors=${summary.errors.length}${dryRun ? " (dry run)" : ""}`,
  );
  return NextResponse.json({ dryRun, ...summary });
}
