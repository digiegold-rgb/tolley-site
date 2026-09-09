import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, rateLimitByIp } from "@/lib/rate-limit";
import { readMfaIdentity } from "./mfa-session";

export async function requireMfaRequest(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) {
    return { response: NextResponse.json({ error: "Invalid request origin" }, { status: 403 }) };
  }
  const limited = await rateLimitByIp(request, "mfa", 30, 900);
  if (limited) return { response: limited };
  const identity = await readMfaIdentity();
  if (!identity || !identity.fresh) {
    return { response: NextResponse.json({ error: "Please sign out and sign in again to verify your identity.",
      code: "REAUTH_REQUIRED" }, { status: 401 }) };
  }
  const rate = await consumeRateLimit(`mfa:user:${identity.userId}`, 15, 900);
  if (!rate.allowed) return { response: NextResponse.json({ error: "Too many attempts. Try again later." },
    { status: 429, headers: { "Retry-After": "900" } }) };
  return { identity };
}
