import { NextResponse } from "next/server";
import { rateLimitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/csp-report — browser-fired CSP violation reports (the report-uri
 * in next.config.ts). Report-Only mode has been live since 7/6 with nowhere to
 * report, so promotion to enforcing has had zero data. Violations land in the
 * Vercel function logs (`vercel logs` / dashboard, filter "csp-violation");
 * a directive+blocked-URI summary line keeps noise greppable. Deliberately no
 * DB writes — this endpoint is unauthenticated by spec and browser-spammable.
 */
export async function POST(request: Request) {
  const limited = await rateLimitByIp(request, "csp-report", 30, 3600);
  if (limited) return new NextResponse(null, { status: 204 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const nested = body["csp-report"];
    const r = (typeof nested === "object" && nested !== null
      ? nested
      : body) as Record<string, unknown>;
    console.warn(
      "csp-violation",
      JSON.stringify({
        directive: r["effective-directive"] ?? r["violated-directive"],
        blocked: String(r["blocked-uri"] ?? "").slice(0, 300),
        page: String(r["document-uri"] ?? "").slice(0, 300),
        sample: String(r["script-sample"] ?? "").slice(0, 100),
      }),
    );
  } catch {
    // malformed report — drop silently, it's untrusted browser input
  }
  return new NextResponse(null, { status: 204 });
}
