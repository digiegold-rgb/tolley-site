/**
 * GET /api/vater/billing/rate — the published per-minute rates, for anything
 * that has to quote a price in the browser.
 *
 * PUBLIC and unauthenticated on purpose: these four numbers are printed on the
 * marketing page already, and the pricing calculator that reads them renders
 * for signed-out visitors. There is nothing per-user here — no balance, no
 * account state, no project.
 *
 * It exists because the ops rate is CONFIG, not code (env
 * VATER_OPS_RATE_PER_MIN, read via lib/vater/billing/ops-fee.ts). A client
 * component cannot read that env var, and hardcoding 0.35 in the calculator
 * would make it the one surface that silently goes stale the day Jared changes
 * the rate.
 *
 * { opsRatePerMinute, stillsUsdPerMinute, motionUsdPerMinute, wordsPerMinute }
 */

import { NextResponse } from "next/server";

import { getOpsRate } from "@/lib/vater/billing/ops-fee";
import {
  ESTIMATE_WORDS_PER_MINUTE,
  MOTION_USD_PER_MIN,
  STILLS_USD_PER_MIN,
} from "@/lib/vater/billing/estimate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      opsRatePerMinute: getOpsRate(),
      stillsUsdPerMinute: STILLS_USD_PER_MIN,
      motionUsdPerMinute: MOTION_USD_PER_MIN,
      wordsPerMinute: ESTIMATE_WORDS_PER_MINUTE,
    },
    // Config, but config that changes without a deploy. A minute of CDN cache
    // keeps a rate change visible fast without hitting a function per visitor.
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
  );
}
