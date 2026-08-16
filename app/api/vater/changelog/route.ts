/**
 * GET /api/vater/changelog — public release notes for Jelly Studio.
 *
 * Deliberately NOT tier-gated and NOT session-gated: the landing page, a
 * prospect, and a support conversation all need to be able to answer "what
 * version is this and what changed" without an account. The payload is the
 * same static list the in-app "What's new" panel renders.
 */
import { NextResponse } from "next/server";
import { APP_VERSION, CHANGELOG } from "@/lib/vater/changelog";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION, entries: CHANGELOG },
    {
      headers: {
        // Static content — let the CDN hold it for an hour, revalidate after.
        "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
