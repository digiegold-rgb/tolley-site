import { NextRequest, NextResponse } from "next/server";
import { heatCookieOptions, heatPinMatches, validateHeatAccess } from "@/lib/heat/auth";
import { rateLimitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ authenticated: await validateHeatAccess() });
}

export async function POST(request: NextRequest) {
  if (process.env.DATABASE_URL) {
    try {
      const limited = await rateLimitByIp(request, "heat:auth", 5, 900);
      if (limited) return limited;
    } catch {
      console.error("[heat] pin rate limit failed");
      return NextResponse.json({ error: "Try again shortly" }, { status: 503 });
    }
  }

  let pin: unknown;
  try {
    pin = (await request.json()).pin;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!pin || typeof pin !== "string") {
    return NextResponse.json({ error: "PIN required" }, { status: 400 });
  }
  if (!heatPinMatches(pin)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }
  let cookie;
  try {
    cookie = heatCookieOptions();
  } catch {
    return NextResponse.json({ error: "Heat access is not configured" }, { status: 503 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookie.name, cookie.value, {
    maxAge: cookie.maxAge,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
  });
  return response;
}
