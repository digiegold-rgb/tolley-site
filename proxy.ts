import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PAGE_GUARDS = ["/agents", "/settings", "/admin", "/results"];
const API_GUARDS = ["/api/agents", "/api/admin", "/api/results"];
const authSecret =
  process.env.AUTH_SECRET ||
  (process.env.NODE_ENV !== "production"
    ? "dev-only-secret-change-before-production"
    : undefined);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPageProtected = PAGE_GUARDS.some((prefix) => pathname.startsWith(prefix));
  const isApiProtected = API_GUARDS.some((prefix) => pathname.startsWith(prefix));
  const token = await getToken({ req: request, secret: authSecret });
  const isAuthenticated = Boolean(token?.sub);

  if (pathname === "/api/ask" && request.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  if ((isPageProtected || isApiProtected) && !isAuthenticated) {
    if (isApiProtected) {
      return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
    }

    const callbackPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("callbackUrl", callbackPath);
    return NextResponse.redirect(redirectUrl);
  }

  const headers = new Headers(request.headers);
  if (
    (pathname === "/api/ask" || isApiProtected) &&
    !headers.has("x-request-id")
  ) {
    headers.set("x-request-id", crypto.randomUUID());
  }

  return NextResponse.next({
    request: {
      headers,
    },
  });
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/agents/:path*",
    "/results/:path*",
    "/settings/:path*",
    "/api/admin/:path*",
    "/api/agents/:path*",
    "/api/results/:path*",
    "/api/ask",
  ],
};
