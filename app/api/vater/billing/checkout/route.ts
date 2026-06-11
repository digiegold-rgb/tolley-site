/**
 * POST /api/vater/billing/checkout — RETIRED 2026-06-11.
 *
 * The $288/mo subscription model is dead. Card capture for pay-per-video
 * billing lives at POST /api/vater/billing/setup. This stub fails loudly so
 * any stale client surfaces the migration instead of silently creating a
 * subscription nobody wants.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "The Vater subscription checkout is retired. Use POST /api/vater/billing/setup to add a card (pay-per-video).",
      setupUrl: "/api/vater/billing/setup",
    },
    { status: 410 },
  );
}
