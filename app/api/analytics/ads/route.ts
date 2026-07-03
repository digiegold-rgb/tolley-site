import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function GET() {
  return NextResponse.json(
    { error: "Google Ads integration retired 2026-04-09", code: "RETIRED" },
    { status: 410 },
  );
}
