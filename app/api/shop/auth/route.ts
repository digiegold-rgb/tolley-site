import { NextRequest, NextResponse } from "next/server";
import { verifyPin, buildAdminCookie, validateShopAdmin } from "@/lib/shop-auth";
import { rateLimitByIp } from "@/lib/rate-limit";

export async function GET() {
  const authenticated = await validateShopAdmin();
  return NextResponse.json({ authenticated });
}

export async function POST(request: NextRequest) {
  // Brute-force lockout — 5 PIN attempts per IP per 15 min.
  const limited = await rateLimitByIp(request, "shop:auth", 5, 900);
  if (limited) return limited;

  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "PIN required" }, { status: 400 });
    }

    if (!verifyPin(pin)) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    const cookie = buildAdminCookie();
    response.cookies.set(cookie.name, cookie.value, {
      maxAge: cookie.maxAge,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
