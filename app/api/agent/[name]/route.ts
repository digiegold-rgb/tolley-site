import { capabilities } from "@/lib/company/catalog";
import { NextResponse } from "next/server";
import { getSubsite, publicSubsites } from "@/lib/subsites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://www.tolley.io";

/**
 * GET /api/agent/[name]
 *
 * Returns the per-subsite manifest as JSON. Optionally fetches and inlines
 * declared `jsonEndpoints` snapshots (?include=data).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  const m = getSubsite(name);
  if (!m || !publicSubsites().some(s => s.name === name)) {
    return NextResponse.json({ error: "Unknown subsite" }, { status: 404 });
  }

  const url = new URL(req.url);
  const include = url.searchParams.get("include")?.split(",") ?? [];

  const body: Record<string, unknown> = {
    ...m,
    capabilities: capabilities().filter(c => c.subsite === m.name),
    taskEndpoint: "/api/v1/tasks",
    quoteEndpoint: "/api/v1/quotes",
    fullUrl: `${BASE}${m.url}`,
    manifestUrl: `${BASE}/api/agent/${m.name}`,
  };

  if (include.includes("data") && m.jsonEndpoints.length) {
    const snapshots: Record<string, unknown> = {};
    await Promise.all(
      m.jsonEndpoints.map(async (ep) => {
        try {
          const target = ep.startsWith("http") ? ep : `${BASE}${ep}`;
          const r = await fetch(target, { cache: "no-store" });
          if (r.ok) snapshots[ep] = await r.json();
        } catch {
          // ignore individual endpoint failures
        }
      }),
    );
    body.snapshots = snapshots;
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
