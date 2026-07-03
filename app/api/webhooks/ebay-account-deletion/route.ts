import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERIFICATION_TOKEN = process.env.EBAY_DELETION_VERIFICATION_TOKEN;
const ENDPOINT_URL = "https://www.tolley.io/api/webhooks/ebay-account-deletion";

export async function GET(req: NextRequest) {
  if (!VERIFICATION_TOKEN) {
    return NextResponse.json({ error: "EBAY_DELETION_VERIFICATION_TOKEN not set" }, { status: 500 });
  }
  const challengeCode = req.nextUrl.searchParams.get("challenge_code");
  if (!challengeCode) {
    return NextResponse.json({ error: "challenge_code missing" }, { status: 400 });
  }
  const hash = crypto
    .createHash("sha256")
    .update(challengeCode + VERIFICATION_TOKEN + ENDPOINT_URL)
    .digest("hex");
  return NextResponse.json({ challengeResponse: hash });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  console.log("[ebay-account-deletion]", JSON.stringify(body));
  return NextResponse.json({ received: true });
}
