import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAgentRequest } from "@/lib/agent-detection";

const PAGE_GUARDS = ["/agents", "/settings", "/admin", "/results"];
const API_GUARDS = ["/api/agents", "/api/admin", "/api/results"];

/**
 * Studio-only collaborators (VATER_STUDIO_ALLOWLIST_EMAILS, minus anyone who
 * is also a site/vater admin) are confined to Jelly Studio. They may reach
 * these prefixes and nothing else on tolley.io.
 */
const STUDIO_ONLY_ALLOWED = [
  "/animate",
  // Whole /api/vater tree: the studio Shell calls youtube, billing, voices,
  // topic, pipeline-status, social-accounts, chat and autopilot. The
  // owner-only subtrees under it (budget/*, observer/*, rss) keep their own
  // requireVaterAdminApiSession guard, which studio-only accounts fail — so
  // middleware is not the only thing standing between them and Plaid data.
  "/api/vater",
  "/api/analytics/video",
  "/api/auth",
  "/login",
  "/logout",
];

/**
 * Owner-only subtrees, denied even though they sit under an allowed prefix.
 * These already enforce requireVaterAdminApiSession at the route layer; this
 * is a second, independent lock on the financial data specifically.
 */
const STUDIO_ONLY_DENIED = [
  "/api/vater/direct/runner",
  "/api/vater/budget",
  "/api/vater/observer",
  "/api/vater/rss",
  "/vater",
];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/** Edge-safe copy of isStudioOnlyEmail — lib/admin-auth.ts can't run here. */
function isStudioOnly(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  const inList = (name: string) =>
    (process.env[name] || "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean)
      .includes(normalized);

  if (inList("ADMIN_ALLOWLIST_EMAILS") || inList("ADMIN_ALLOWLIST")) return false;
  if (inList("VATER_ADMIN_ALLOWLIST_EMAILS")) return false;
  return inList("VATER_STUDIO_ALLOWLIST_EMAILS");
}
const authSecret =
  process.env.AUTH_SECRET ||
  (process.env.NODE_ENV !== "production"
    ? "dev-only-secret-change-before-production"
    : undefined);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Agent detection — log AI agent traffic
  const ua = request.headers.get("user-agent") ?? undefined;
  const accept = request.headers.get("accept") ?? undefined;
  const { isAgent, agentName } = isAgentRequest(ua, accept);
  if (isAgent) {
    console.log(
      `[agent-detect] ${agentName} hit ${pathname} from ${request.headers.get("x-forwarded-for") ?? "unknown"}`
    );
  }

  const isPageProtected = PAGE_GUARDS.some((prefix) => pathname.startsWith(prefix));
  const isApiProtected = API_GUARDS.some((prefix) => pathname.startsWith(prefix));
  const secureCookie = request.nextUrl.protocol === "https:";
  const cookieName = secureCookie
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  // The matcher is site-wide so studio-only confinement can be enforced
  // everywhere. Decoding the JWT is the expensive part, so skip it entirely
  // for anonymous traffic (the overwhelming majority) unless the path is one
  // of the guarded prefixes that needs an auth decision anyway.
  const hasSessionCookie = Boolean(request.cookies.get(cookieName));
  const needsToken = hasSessionCookie || isPageProtected || isApiProtected;
  const token = needsToken
    ? await getToken({ req: request, secret: authSecret, cookieName })
    : null;
  const isAuthenticated = Boolean(token?.sub);

  // Studio-only collaborators: everything outside Jelly Studio is off-limits.
  if (isAuthenticated && isStudioOnly(token?.email as string | undefined)) {
    const matches = (prefix: string) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`);
    const allowed =
      STUDIO_ONLY_ALLOWED.some(matches) && !STUDIO_ONLY_DENIED.some(matches);
    if (!allowed) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/animate", request.url));
    }
  }

  if (pathname === "/api/ask" && request.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  if ((isPageProtected || isApiProtected) && !isAuthenticated) {
    if (isApiProtected) {
      return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
    }

    const callbackPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const redirectUrl = new URL("/login", request.url);
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
  // Site-wide, minus Next internals and static assets. Broadened from the old
  // per-prefix list so studio-only accounts can be confined on every route;
  // anonymous requests short-circuit before any JWT work (see above).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|mp4|webm|woff|woff2|ttf|otf|css|js|map)$).*)",
  ],
};
