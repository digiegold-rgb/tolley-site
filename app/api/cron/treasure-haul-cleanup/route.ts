/**
 * Treasure Haul brand-Page cleanup cron.
 *
 * Safety net for removing already-sold items from Ruthann's Treasure Haul FB
 * Page (facebook.com/RuthannsTreasureHaul). The fb-sync route deletes a
 * product's Page post inline when it flips to sold, but that only covers
 * mirror-driven transitions. This sweep catches EVERY sold product that still
 * carries an un-deleted Page post — including ones marked sold from the admin
 * UI or any other path — so nothing already-sold lingers on the Page.
 *
 * Idempotent: each removed post is stamped with `treasureHaulPage.deletedAt`,
 * so repeated runs are no-ops once everything is cleaned.
 */

import { NextRequest, NextResponse } from "next/server";
import { sweepSoldTreasureHaulPosts } from "@/lib/shop/treasure-haul-cleanup";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sweepSoldTreasureHaulPosts(200);

  if (result.noToken) {
    return NextResponse.json(
      { ok: false, error: "FACEBOOK_PAGE_TOKEN_TREASURE not set" },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, ...result });
}
