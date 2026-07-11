import { NextRequest, NextResponse } from "next/server";
import { verifyWdPin, buildWdAdminCookie } from "@/lib/wd-auth";
import { rateLimitByIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "wd:auth", 5, 900);
  if (limited) return limited;

  try {
    const { pin } = await request.json();

    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "PIN required" }, { status: 400 });
    }

    const { valid, role } = verifyWdPin(pin);
    if (!valid || !role) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, role });
    const cookie = buildWdAdminCookie(role);
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
